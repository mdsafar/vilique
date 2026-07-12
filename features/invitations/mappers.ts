import { templates } from "@/data/templates";
import { getTemplateAudioDefaults } from "@/lib/config/templateAudio";
import { createDefaultInvitation } from "@/lib/defaultInvitation";
import { Database, Json } from "@/types/database";
import { InvitationData } from "@/types/invitation";

export type InvitationRow = Database["public"]["Tables"]["invitations"]["Row"];
export type TemplateRow = Database["public"]["Tables"]["invitation_templates"]["Row"];
export type InvitationRowWithTemplate = InvitationRow & {
    invitation_templates?: {
        template_key?: string | null;
        default_music_url?: string | null;
        default_tick_sound_url?: string | null;
    } | null;
};

export function mapInvitationRow(row: InvitationRowWithTemplate): InvitationData {
    const fallback = createDefaultInvitation();
    const theme = isObject(row.theme) ? row.theme as Partial<typeof fallback.theme> : fallback.theme;

    // Use the template's built-in default sounds when the invitation
    // hasn't had custom audio uploaded yet.
    const templateDefaults = row.invitation_templates as {
        template_key?: string;
        default_music_url?: string | null;
        default_tick_sound_url?: string | null;
    } | undefined;

    const templateId = templateDefaults?.template_key || "pastel-floral-wedding";
    const localAudioDefaults = getTemplateAudioDefaults(templateId);
    const defaultMusicUrl = templateDefaults?.default_music_url || localAudioDefaults.musicUrl || "";
    const defaultTickSoundUrl =
        templateDefaults?.default_tick_sound_url ||
        localAudioDefaults.tickSoundUrl ||
        "";
    const musicUrl = row.music_url || defaultMusicUrl || "";
    const themeTickSoundUrl = isObject(row.theme) && typeof row.theme.tickSoundUrl === "string"
        ? row.theme.tickSoundUrl
        : null;
    const tickSoundUrl =
        themeTickSoundUrl ||
        defaultTickSoundUrl ||
        "";

    return {
        id: row.id,
        slug: row.slug,
        category: normalizeCategory(row.category),
        templateId,
        title: row.title,
        primaryName: row.primary_name,
        secondaryName: row.secondary_name || "",
        eventDate: row.event_date || fallback.eventDate,
        eventTime: row.event_time || "",
        venueName: row.venue_name || "",
        venueAddress: row.venue_address || "",
        mapLink: row.map_link || "",
        phone: row.phone || "",
        whatsapp: row.whatsapp || "",
        message: row.message || "",
        musicUrl,
        tickSoundUrl,
        defaultMusicUrl,
        defaultTickSoundUrl,
        coverImageUrl: row.cover_image_url || "",
        galleryUrls: Array.isArray(row.gallery_urls) ? row.gallery_urls.filter(isString) : [],
        theme: {
            ...fallback.theme,
            ...theme,
        },
        sections: isObject(row.sections) ? row.sections as Record<string, unknown> : {},
        status: row.status,
        publishedAt: row.published_at || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lifecycleStatus: row.lifecycle_status,
        eventTimezone: row.event_timezone,
        changeRiskStatus: row.change_risk_status,
        identitySnapshot: row.identity_snapshot,
        identityFingerprint: row.identity_fingerprint || undefined,
        firstPublishedAt: row.first_published_at || undefined,
        completedAt: row.completed_at || undefined,
        archivedAt: row.archived_at || undefined,
    };
}

type InvitationUpdateInput = {
    slug?: string;
    category?: string;
    title?: string;
    primaryName?: string;
    secondaryName?: string | null;
    eventDate?: string | null;
    eventTime?: string | null;
    venueName?: string | null;
    venueAddress?: string | null;
    mapLink?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    message?: string | null;
    musicUrl?: string | null;
    coverImageUrl?: string | null;
    galleryUrls?: string[];
    theme?: Record<string, unknown>;
    sections?: Record<string, unknown>;
    lifecycleStatus?: "draft" | "published" | "completed" | "archived" | "unpublished";
    eventTimezone?: string;
};

export function toInvitationUpdate(values: InvitationUpdateInput) {
    return {
        slug: values.slug,
        category: values.category,
        title: values.title,
        primary_name: values.primaryName,
        secondary_name: values.secondaryName,
        event_date: values.eventDate,
        event_time: values.eventTime,
        venue_name: values.venueName,
        venue_address: values.venueAddress,
        map_link: values.mapLink,
        phone: values.phone,
        whatsapp: values.whatsapp,
        message: values.message,
        music_url: values.musicUrl,
        cover_image_url: values.coverImageUrl,
        gallery_urls: values.galleryUrls as Json | undefined,
        theme: values.theme as Json | undefined,
        sections: values.sections as Json | undefined,
        lifecycle_status: values.lifecycleStatus,
        event_timezone: values.eventTimezone,
        updated_at: new Date().toISOString(),
    };
}

export function mapTemplateRow(row: TemplateRow) {
    const localTemplate = templates.find((template) => template.id === row.template_key);

    return {
        id: row.template_key,
        name: row.name,
        category: normalizeCategory(row.category),
        accent: row.accent_color || localTemplate?.accent || "#b99aad",
        gradient:
            localTemplate?.gradient ||
            `linear-gradient(145deg, ${row.accent_color || "#f8dfea"} 0%, #ffffff 100%)`,
        description: row.description || localTemplate?.description || "",
        mood: localTemplate?.mood || row.description || "Custom invitation",
        badge: row.is_premium ? "Premium" as const : "Free" as const,
        popularity: localTemplate?.popularity || "Newest" as const,
        features: localTemplate?.features || ["RSVP", "Wishes", "Music", "Analytics"],
        palette: localTemplate?.palette || [row.accent_color || "#b99aad", "#ffffff"],
        previewSections: localTemplate?.previewSections || ["Hero", "Details", "RSVP"],
    };
}

function normalizeCategory(category: string): InvitationData["category"] {
    const valid = [
        "wedding",
        "birthday",
        "engagement",
        "housewarming",
        "baby_shower",
        "graduation",
        "party",
        "corporate",
        "festival",
        "custom",
    ] as const;

    return valid.includes(category as InvitationData["category"])
        ? (category as InvitationData["category"])
        : "custom";
}

function isObject(value: Json): value is { [key: string]: Json | undefined } {
    return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}

function isString(value: unknown): value is string {
    return typeof value === "string";
}
