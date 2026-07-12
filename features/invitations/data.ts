import { unstable_cache } from "next/cache";
import { templates } from "@/data/templates";
import { createDefaultInvitation } from "@/lib/defaultInvitation";
import { createPublicServerClient } from "@/lib/supabase/public-server";
import { createClient } from "@/lib/supabase/server";
import { mapInvitationRow, mapTemplateRow } from "@/features/invitations/mappers";

const getCachedActiveTemplates = unstable_cache(
    async () => {
        const supabase = createPublicServerClient();
        const { data, error } = await supabase
            .from("invitation_templates")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: true });

        if (error || !data?.length) return templates;

        const implementedTemplateIds = new Set(templates.map((template) => template.id));
        const implementedRows = data.filter((row) => implementedTemplateIds.has(row.template_key));

        return implementedRows.length ? implementedRows.map(mapTemplateRow) : templates;
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
    } catch {
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
        .single();

    if (error || !data) return null;
    return mapInvitationRow(data);
}

export async function getBuilderInvitation(options: {
    id?: string;
    slug?: string;
    template?: string;
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

    const templateKey = options.template || "pastel-floral-wedding";
    const { data: template } = await supabase
        .from("invitation_templates")
        .select("id, template_key, category, accent_color")
        .eq("template_key", templateKey)
        .single();

    const fallback = createDefaultInvitation();
    const slug = `${fallback.primaryName}-${fallback.secondaryName || "invite"}-${crypto.randomUUID().slice(0, 8)}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const { data } = await supabase
        .from("invitations")
        .insert({
            user_id: user.id,
            template_id: template?.id || null,
            slug,
            category: template?.category || fallback.category,
            title: fallback.title,
            primary_name: fallback.primaryName,
            secondary_name: fallback.secondaryName,
            event_date: fallback.eventDate,
            event_time: fallback.eventTime,
            venue_name: fallback.venueName,
            venue_address: fallback.venueAddress,
            map_link: fallback.mapLink,
            phone: fallback.phone,
            message: fallback.message,
            theme: {
                ...fallback.theme,
                primaryColor: template?.accent_color || fallback.theme.primaryColor,
            },
            status: "draft",
        })
        .select("*")
        .single();

    return data ? mapInvitationRow(data) : fallback;
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

    const invitations = (invitationRows || []).map(mapInvitationRow);
    const invitationIds = invitations.map((invitation) => invitation.id);
    const rsvpEligibleInvitationIds = invitations
        .filter((invitation) => templateCollectsDetailedRsvps(invitation.templateId))
        .map((invitation) => invitation.id);

    const [rsvpRowsResult, viewResult, viewRowsResult] = invitationIds.length
        ? await Promise.all([
              rsvpEligibleInvitationIds.length
                  ? supabase.from("rsvps").select("invitation_id").in("invitation_id", rsvpEligibleInvitationIds)
                  : Promise.resolve({ data: [] }),
              supabase
                  .from("invitation_events")
                  .select("id", { count: "exact", head: true })
                  .in("invitation_id", invitationIds)
                  .eq("event_type", "view"),
              supabase
                  .from("invitation_events")
                  .select("invitation_id")
                  .in("invitation_id", invitationIds)
                  .eq("event_type", "view"),
          ])
        : [{ data: [] }, { count: 0 }, { data: [] }];

    const invitationStats = Object.fromEntries(
        invitations.map((invitation) => [
            invitation.id,
            {
                acceptsRsvps: templateCollectsDetailedRsvps(invitation.templateId),
                rsvps: templateCollectsDetailedRsvps(invitation.templateId)
                    ? (rsvpRowsResult.data || []).filter((row) => row.invitation_id === invitation.id).length
                    : 0,
                views: (viewRowsResult.data || []).filter((row) => row.invitation_id === invitation.id).length,
            },
        ])
    );
    const totalRsvps = (rsvpRowsResult.data || []).length;

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
        invitations,
        published: invitations.filter((item) => item.status === "published").length,
        drafts: invitations.filter((item) => item.status === "draft").length,
        views: viewResult.count || 0,
        rsvps: totalRsvps,
        invitationStats,
    };
}

function templateCollectsDetailedRsvps(templateId: string) {
    return !["pastel-floral-wedding"].includes(templateId);
}

function getUserMetadataString(metadata: unknown, key: string) {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" ? value : "";
}
