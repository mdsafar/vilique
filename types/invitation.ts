export type InvitationCategory =
    | "wedding"
    | "birthday"
    | "engagement"
    | "housewarming"
    | "baby_shower"
    | "graduation"
    | "party"
    | "corporate"
    | "festival"
    | "custom";

export type RSVPStatus = "accepted" | "declined" | "maybe";

export interface InvitationData {
    id: string;
    slug: string;
    category: InvitationCategory;
    templateId: string;

    title: string;
    primaryName: string;
    secondaryName?: string;

    eventDate: string;
    eventTime: string;
    venueName: string;
    venueAddress: string;
    mapLink: string;

    phone?: string;
    whatsapp?: string;
    message: string;

    musicUrl?: string;
    tickSoundUrl?: string;
    defaultMusicUrl?: string;
    defaultTickSoundUrl?: string;
    coverImageUrl?: string;
    galleryUrls?: string[];

    theme: {
        primaryColor: string;
        secondaryColor: string;
        backgroundColor: string;
        textColor: string;
        fontStyle: string;
        musicDuration?: number;
        tickSoundUrl?: string;
    };
    sections?: Record<string, unknown>;
    status?: "draft" | "published" | "archived";
    publishedAt?: string;

    createdAt: string;
    updatedAt: string;

    lifecycleStatus?: "draft" | "published" | "completed" | "archived" | "unpublished";
    eventTimezone?: string;
    changeRiskStatus?: "low" | "medium" | "high";
    identitySnapshot?: any;
    identityFingerprint?: string;
    firstPublishedAt?: string;
    completedAt?: string;
    archivedAt?: string;
}
