import {
    toDateInputValue,
} from "@/features/builder/lib/builderDateUtils";
import {
    normalizeInvitationDateValue,
} from "@/lib/invitationDate";
import type {
    InvitationData,
} from "@/types/invitation";

export function buildSavePayload(
    source: InvitationData,
): string {
    const normalizedEventDate =
        normalizeInvitationDateValue(
            source.eventDate,
        ) ||
        toDateInputValue(new Date());

    return JSON.stringify({
        category: source.category,
        title: source.title,
        primaryName: source.primaryName,
        secondaryName:
            source.secondaryName || null,
        eventDate: normalizedEventDate,
        eventTime: source.eventTime,
        venueName: source.venueName,
        venueAddress: source.venueAddress,
        mapLink: source.mapLink,
        phone: source.phone || null,
        secondaryPhone:
            source.secondaryPhone || null,
        whatsapp: source.whatsapp || null,
        message: source.message,
        musicUrl:
            source.musicUrl &&
                source.musicUrl !==
                source.defaultMusicUrl
                ? source.musicUrl
                : null,
        coverImageUrl:
            source.coverImageUrl || null,
        galleryUrls:
            source.galleryUrls || [],
        theme: source.theme,
        sections: source.sections || {},
        templateKey: source.templateId,
    });
}

export function buildComparablePayload(
    source: InvitationData,
): string {
    const editablePayload = JSON.parse(
        buildSavePayload(source),
    ) as Record<string, unknown>;

    delete editablePayload.slug;

    return JSON.stringify(editablePayload);
}