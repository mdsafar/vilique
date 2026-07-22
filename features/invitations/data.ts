import { unstable_cache } from "next/cache";
import { templates } from "@/data/templates";
import { createPublicServerClient } from "@/lib/supabase/public-server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultRatingSummary } from "@/lib/templateRatingFormat";
import { getTemplateRatingSummaryMap } from "@/lib/templateRatings";
import { mapInvitationRow, mapTemplateRow } from "@/features/invitations/mappers";
import { reportError } from "@/lib/observability";
import { getInvitationLifecycle } from "@/lib/lifecycle";

const getCachedActiveTemplates = unstable_cache(
    async () => {
        const supabase = createPublicServerClient();
        const { data, error } = await supabase
            .from("invitation_templates")
            .select("id, template_key, name, category, description, preview_image_url, accent_color, is_premium, is_active, created_at, updated_at, price_paise, currency, is_free, slug, is_paid, metadata")
            .eq("is_active", true)
            .order("created_at", { ascending: true });

        if (error || !data?.length) return templates;

        const implementedTemplateIds = new Set(templates.map((template) => template.id));
        const implementedRows = data.filter((row) => implementedTemplateIds.has(row.template_key));

        const mappedTemplates = implementedRows.length ? implementedRows.map(mapTemplateRow) : templates;
        const ratingSummaries = await getTemplateRatingSummaryMap(mappedTemplates.map((template) => template.id));

        return mappedTemplates.map((template) => {
            const summary = ratingSummaries.get(template.id) || getDefaultRatingSummary();
            return {
                ...template,
                ratingAverage: summary.average,
                ratingCount: summary.count,
            };
        });
    },
    ["active-invitation-templates"],
    {
        tags: ["invitation-templates"],
        revalidate: 300,
    }
);

export async function getActiveTemplates() {
    try {
        return await getCachedActiveTemplates();
    } catch (error) {
        reportError(error, "templates.get_cached_failed");
        return templates;
    }
}

export async function getPublishedInvitationBySlug(slug: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("invitations")
        .select("*, invitation_templates(template_key)")
        .eq("slug", slug)
        .eq("status", "published")
        .neq("lifecycle_status", "unpublished")
        .neq("event_status", "unpublished")
        .single();

    if (error || !data) return null;
    return mapInvitationRow(data);
}

export async function getBuilderInvitation(options: {
    id?: string;
    slug?: string;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    if (options.id || options.slug) {
        let query = supabase.from("invitations").select("*, invitation_templates(template_key)").eq("user_id", user.id);
        query = options.id ? query.eq("id", options.id) : query.eq("slug", options.slug || "");
        const { data } = await query.single();
        if (data) return mapInvitationRow(data);
    }

    // No matching invitation found — do not auto-create a draft.
    // Draft creation is handled exclusively via POST /api/invitations in the builder.
    return null;
}


export async function getDashboardData() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            profile: null,
            invitations: [],
            published: 0,
            drafts: 0,
            views: 0,
            rsvps: 0,
            invitationStats: {},
        };
    }

    const { data: invitationRows } = await supabase
        .from("invitations")
        .select("*, invitation_templates(template_key)")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

    const invitationItems = (invitationRows || []).map(mapInvitationRow);
    const invitationIds = invitationItems.map((invitation) => invitation.id);
    const rsvpEligibleInvitationIds = invitationRows
        ?.filter((invitation) => templateCollectsDetailedRsvps(getInvitationTemplateKey(invitation)))
        .map((invitation) => invitation.id) || [];

    const [rsvpRowsResult, viewResult, viewRowsResult, paymentsResult] = await Promise.all([
        invitationIds.length && rsvpEligibleInvitationIds.length
            ? supabase.from("rsvps").select("invitation_id").in("invitation_id", rsvpEligibleInvitationIds)
            : Promise.resolve({ data: [] as { invitation_id: string }[] }),
        invitationIds.length
            ? supabase.from("invitation_events").select("id", { count: "exact", head: true }).in("invitation_id", invitationIds).eq("event_type", "view")
            : Promise.resolve({ count: 0 }),
        invitationIds.length
            ? supabase.from("invitation_events").select("invitation_id").in("invitation_id", invitationIds).eq("event_type", "view")
            : Promise.resolve({ data: [] as { invitation_id: string }[] }),
        supabase.from("payments").select("amount_paise").eq("user_id", user.id).in("status", ["paid", "published"]),
    ]);

    const invitationStats = Object.fromEntries(
        invitationItems.map((invitation) => [
            invitation.id,
            {
                acceptsRsvps: templateCollectsDetailedRsvps(invitation.templateId || ""),
                rsvps: templateCollectsDetailedRsvps(invitation.templateId || "")
                    ? (rsvpRowsResult.data || []).filter((row) => row.invitation_id === invitation.id).length
                    : 0,
                views: (viewRowsResult.data || []).filter((row) => row.invitation_id === invitation.id).length,
            },
        ])
    );
    const totalRsvps = (rsvpRowsResult.data || []).length;
    const totalSpent = (paymentsResult.data || []).reduce((sum, p) => sum + p.amount_paise, 0) / 100;

    return {
        profile: {
            email: user.email || "",
            name:
                getUserMetadataString(user.user_metadata, "full_name") ||
                getUserMetadataString(user.user_metadata, "name") ||
                user.email?.split("@")[0] ||
                "Friend",
            avatarUrl: getUserMetadataString(user.user_metadata, "avatar_url"),
        },
        invitations: [],
        published: invitationItems.filter((item) => item.status === "published" && getInvitationLifecycle(item) !== "offline").length,
        drafts: invitationItems.filter((item) => getInvitationLifecycle(item) === "draft").length,
        views: viewResult.count || 0,
        rsvps: totalRsvps,
        invitationStats,
        totalSpent,
    };
}

function templateCollectsDetailedRsvps(templateId: string) {
    return !["pastel-floral-wedding"].includes(templateId);
}

function getInvitationTemplateKey(invitation: { template_id: string | null; invitation_templates?: { template_key?: string | null } | { template_key?: string | null }[] | null }) {
    const template = Array.isArray(invitation.invitation_templates)
        ? invitation.invitation_templates[0]
        : invitation.invitation_templates;
    return template?.template_key || invitation.template_id || "";
}

function getUserMetadataString(metadata: unknown, key: string) {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" ? value : "";
}
