import type { MetadataRoute } from "next";
import { templates } from "@/data/templates";
import { reportError } from "@/lib/observability";
import { createPublicServerClient } from "@/lib/supabase/public-server";
import type { Database } from "@/types/database";

const BASE_URL = "https://www.vilique.in";
const DATABASE_PAGE_SIZE = 1_000;
const STATIC_LAST_MODIFIED = "2026-07-24";

type SitemapEntry = MetadataRoute.Sitemap[number];
type InvitationSitemapRow = Pick<
    Database["public"]["Tables"]["invitations"]["Row"],
    "slug" | "updated_at"
>;
type TemplateSitemapRow = Pick<
    Database["public"]["Tables"]["invitation_templates"]["Row"],
    "template_key" | "updated_at"
>;

const STATIC_PAGES = [
    {
        path: "",
        changeFrequency: "weekly",
        priority: 1,
    },
    {
        path: "/pricing",
        changeFrequency: "monthly",
        priority: 0.7,
    },
    {
        path: "/about",
        changeFrequency: "monthly",
        priority: 0.6,
    },
    {
        path: "/contact",
        changeFrequency: "monthly",
        priority: 0.6,
    },
    {
        path: "/privacy",
        changeFrequency: "yearly",
        priority: 0.5,
    },
    {
        path: "/terms",
        changeFrequency: "yearly",
        priority: 0.5,
    },
    {
        path: "/refund-policy",
        changeFrequency: "yearly",
        priority: 0.5,
    },
] as const satisfies ReadonlyArray<{
    path: string;
    changeFrequency: NonNullable<SitemapEntry["changeFrequency"]>;
    priority: number;
}>;

// Keep the sitemap fresh without querying Supabase on every crawler request.
export const revalidate = 3_600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const [templateEntries, invitationEntries] = await Promise.all([
        getTemplateEntries(),
        getPublishedInvitationEntries(),
    ]);

    return [
        ...getStaticEntries(),
        ...templateEntries,
        ...invitationEntries,
    ];
}

function getStaticEntries(): MetadataRoute.Sitemap {
    return STATIC_PAGES.map((page) => ({
        url: `${BASE_URL}${page.path}`,
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
    }));
}

async function getTemplateEntries(): Promise<MetadataRoute.Sitemap> {
    const implementedTemplateKeys = new Set(
        templates.map((template) => template.id)
    );

    try {
        const supabase = createPublicServerClient();
        const { data, error } = await supabase
            .from("invitation_templates")
            .select("template_key, updated_at")
            .eq("is_active", true)
            .order("template_key", { ascending: true });

        if (error) {
            throw new Error(error.message);
        }

        const publishedTemplates = (data ?? []).filter((template) =>
            implementedTemplateKeys.has(template.template_key)
        );

        if (publishedTemplates.length > 0) {
            return publishedTemplates.map(getTemplateEntry);
        }
    } catch (error) {
        reportError(error, "sitemap.templates_fetch_failed");
    }

    // These templates remain routable when the database is unavailable.
    return templates.map((template) =>
        getTemplateEntry({
            template_key: template.id,
            updated_at: STATIC_LAST_MODIFIED,
        })
    );
}

async function getPublishedInvitationEntries(): Promise<MetadataRoute.Sitemap> {
    const entries: MetadataRoute.Sitemap = [];
    let lastSlug: string | null = null;

    try {
        const supabase = createPublicServerClient();

        while (true) {
            let query = supabase
                .from("invitations")
                .select("slug, updated_at")
                .eq("status", "published")
                .neq("lifecycle_status", "unpublished")
                .neq("event_status", "unpublished")
                .order("slug", { ascending: true })
                .limit(DATABASE_PAGE_SIZE);

            if (lastSlug) {
                query = query.gt("slug", lastSlug);
            }

            const { data, error } = await query;

            if (error) {
                throw new Error(error.message);
            }

            const rows = (data ?? []) as InvitationSitemapRow[];
            entries.push(...rows.map(getInvitationEntry));

            if (rows.length < DATABASE_PAGE_SIZE) {
                break;
            }

            const nextLastSlug = rows.at(-1)?.slug;
            if (!nextLastSlug || nextLastSlug === lastSlug) {
                throw new Error("Invitation sitemap pagination did not advance.");
            }
            lastSlug = nextLastSlug;
        }
    } catch (error) {
        reportError(error, "sitemap.invitations_fetch_failed", {
            entriesFetched: entries.length,
        });
    }

    return entries;
}

function getTemplateEntry(template: TemplateSitemapRow): SitemapEntry {
    return {
        url: `${BASE_URL}/templates/${encodeURIComponent(template.template_key)}`,
        lastModified: normalizeLastModified(template.updated_at),
        changeFrequency: "weekly",
        priority: 0.9,
    };
}

function getInvitationEntry(invitation: InvitationSitemapRow): SitemapEntry {
    return {
        url: `${BASE_URL}/i/${encodeURIComponent(invitation.slug)}`,
        lastModified: normalizeLastModified(invitation.updated_at),
        changeFrequency: "weekly",
        priority: 0.8,
    };
}

function normalizeLastModified(value: string): string {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp)
        ? STATIC_LAST_MODIFIED
        : new Date(timestamp).toISOString();
}
