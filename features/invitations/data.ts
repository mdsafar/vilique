import { templates } from "@/data/templates";
import { createDefaultInvitation } from "@/lib/defaultInvitation";
import { createClient } from "@/lib/supabase/server";
import { mapInvitationRow, mapTemplateRow } from "@/features/invitations/mappers";

export async function getActiveTemplates() {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("invitation_templates")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: true });

        if (error || !data?.length) return templates;

        const implementedTemplateIds = new Set(templates.map((template) => template.id));
        const implementedRows = data.filter((row) => implementedTemplateIds.has(row.template_key));

        return implementedRows.length ? implementedRows.map(mapTemplateRow) : templates;
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
        if (data) return mapInvitationRow(data as any);
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
        };
    }

    const { data: invitationRows } = await supabase
        .from("invitations")
        .select("*, invitation_templates(template_key)")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

    const invitationIds = invitationRows?.map((row) => row.id) || [];
    const [rsvpResult, viewResult] = invitationIds.length
        ? await Promise.all([
              supabase.from("rsvps").select("id", { count: "exact", head: true }).in("invitation_id", invitationIds),
              supabase
                  .from("invitation_events")
                  .select("id", { count: "exact", head: true })
                  .in("invitation_id", invitationIds)
                  .eq("event_type", "view"),
          ])
        : [{ count: 0 }, { count: 0 }];

    const invitations = (invitationRows || []).map(mapInvitationRow);

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
        rsvps: rsvpResult.count || 0,
    };
}

function getUserMetadataString(metadata: unknown, key: string) {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" ? value : "";
}
