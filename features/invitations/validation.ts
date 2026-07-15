import { z } from "zod";

export const invitationStatusSchema = z.enum(["draft", "published", "archived"]);
export const rsvpStatusSchema = z.enum(["accepted", "declined", "maybe"]);
export const eventTypeSchema = z.enum([
    "view",
    "share",
    "music_play",
    "map_click",
    "call_click",
    "whatsapp_click",
    "rsvp_submit",
]);

export const invitationCreateSchema = z.object({
    templateKey: z.string().min(1).default("pastel-floral-wedding"),
});

export const invitationUpdateSchema = z.object({
    slug: z.string().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    category: z.string().min(1).max(40).optional(),
    title: z.string().min(1).max(120).optional(),
    primaryName: z.string().min(1).max(80).optional(),
    secondaryName: z.string().max(80).nullable().optional(),
    eventDate: z.string().nullable().optional(),
    eventTime: z.string().max(80).nullable().optional(),
    venueName: z.string().max(160).nullable().optional(),
    venueAddress: z.string().max(260).nullable().optional(),
    mapLink: z.string().url().or(z.literal("")).nullable().optional(),
    phone: z.string().max(10).regex(/^\d*$/, "Phone must contain digits only.").nullable().optional(),
    secondaryPhone: z.string().max(10).regex(/^\d*$/, "Secondary phone must contain digits only.").nullable().optional(),
    whatsapp: z.string().max(32).nullable().optional(),
    message: z.string().max(600).nullable().optional(),
    musicUrl: z.string().url().or(z.literal("")).nullable().optional(),
    coverImageUrl: z.string().url().or(z.literal("")).nullable().optional(),
    galleryUrls: z.array(z.string().url()).optional(),
    theme: z.record(z.string(), z.unknown()).optional(),
    sections: z.record(z.string(), z.unknown()).optional(),
    eventTimezone: z.string().max(80).optional(),
});

export const rsvpCreateSchema = z.object({
    invitationId: z.string().uuid(),
    guestToken: z.string().min(16).max(160),
    guestName: z.string().min(1).max(100).default("Guest"),
    guestPhone: z.string().max(32).optional(),
    status: rsvpStatusSchema,
    guestCount: z.coerce.number().int().min(1).max(10).default(1),
    message: z.string().max(400).optional(),
});

export const rsvpLookupSchema = z.object({
    invitationId: z.string().uuid(),
    guestToken: z.string().min(16).max(160),
});

export const wishCreateSchema = z.object({
    invitationId: z.string().uuid(),
    guestName: z.string().min(1).max(100),
    message: z.string().min(2).max(500),
});

export const eventCreateSchema = z.object({
    invitationId: z.string().uuid(),
    eventType: eventTypeSchema,
    metadata: z.record(z.string(), z.unknown()).default({}),
});

export const mediaUploadSchema = z.object({
    invitationId: z.string().uuid(),
    kind: z.enum(["image", "music"]),
});
