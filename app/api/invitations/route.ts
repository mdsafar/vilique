import { NextResponse } from "next/server";
import { createDefaultInvitation } from "@/lib/defaultInvitation";
import { mapInvitationRow, type InvitationRowWithTemplate } from "@/features/invitations/mappers";
import { createClient } from "@/lib/supabase/server";
import { invitationCreateSchema } from "@/features/invitations/validation";
import { buildInvitationSlug } from "@/features/invitations/slug";
import { getInvitationLifecycle } from "@/lib/lifecycle";
import type { Json } from "@/types/database";

const INVITATION_LIMIT_DEFAULT = 10;
const INVITATION_LIMIT_MAX = 30;
const invitationSorts = {
    updated_desc: { field: "created_at", ascending: false },
    newest: { field: "created_at", ascending: false },
    oldest: { field: "created_at", ascending: true },
    event_soonest: { field: "event_date", ascending: true },
} as const;
type InvitationSort = keyof typeof invitationSorts;
type InvitationStatusFilter = "all" | "upcoming" | "completed" | "draft" | "offline";

export async function GET(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim();
    const status = parseInvitationStatus(url.searchParams.get("status"));
    const sort = parseInvitationSort(url.searchParams.get("sort"));
    const limit = parseLimit(url.searchParams.get("limit"), INVITATION_LIMIT_DEFAULT, INVITATION_LIMIT_MAX);
    const cursor = decodeCursor(url.searchParams.get("cursor"));
    const sortConfig = invitationSorts[sort];
    const paidInvitationIdsForUser = await getPaidInvitationIdsForUser(user.id);

    let query = supabase
        .from("invitations")
        .select("*, invitation_templates(template_key, default_music_url, default_tick_sound_url)")
        .eq("user_id", user.id);

    query = applyInvitationSearch(query, search);
    query = query
        .order(sortConfig.field, { ascending: sortConfig.ascending, nullsFirst: false })
        .order("id", { ascending: sortConfig.ascending })
        .range(0, 999);

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows = (data || []) as InvitationRowWithTemplate[];
    const itemsWithRows = rows.map((row) => {
        const item = mapInvitationRow(row);
        return {
            item: paidInvitationIdsForUser.includes(row.id) ? { ...item, paymentStatus: "paid" as const } : item,
            row,
        };
    });
    const filteredItemsWithRows = itemsWithRows.filter(({ item }) => isInvitationVisibleForStatus(item, status));
    const cursorFilteredItemsWithRows = applyCursorToItems(filteredItemsWithRows, sortConfig.field, sortConfig.ascending, cursor);
    const pageItemsWithRows = cursorFilteredItemsWithRows.slice(0, limit);
    const items = pageItemsWithRows.map(({ item }) => item);
    const lastRow = pageItemsWithRows[pageItemsWithRows.length - 1]?.row as Record<string, unknown> | undefined;
    const hasMore = items.length === limit && cursorFilteredItemsWithRows.length > limit;
    const filterStatuses: InvitationStatusFilter[] = ["all", "upcoming", "completed", "draft", "offline"];
    const counts = Object.fromEntries(
        filterStatuses.map((s) => [
            s,
            itemsWithRows.filter(({ item }) => isInvitationVisibleForStatus(item, s)).length,
        ])
    );
    const stats = await getInvitationStats(pageItemsWithRows.map(({ row }) => row.id));

    return NextResponse.json({
        items,
        nextCursor: hasMore && lastRow
            ? encodeCursor({ value: String(lastRow[sortConfig.field] || ""), id: String(lastRow.id) })
            : null,
        hasMore,
        totalCount: filteredItemsWithRows.length,
        counts,
        stats,
    });
}

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = invitationCreateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data: template, error: templateError } = await supabase
        .from("invitation_templates")
        .select("id, template_key, category, accent_color")
        .eq("template_key", parsed.data.templateKey)
        .single();

    if (templateError || !template) {
        return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    const defaults = createDefaultInvitation();
    const p = parsed.data;

    const title = p.title ?? defaults.title;
    const primaryName = p.primaryName ?? defaults.primaryName;
    const secondaryName = p.secondaryName !== undefined ? p.secondaryName : defaults.secondaryName;
    const eventDate = p.eventDate ?? defaults.eventDate;
    const eventTime = p.eventTime !== undefined ? p.eventTime : defaults.eventTime;
    const venueName = p.venueName !== undefined ? p.venueName : defaults.venueName;
    const venueAddress = p.venueAddress !== undefined ? p.venueAddress : defaults.venueAddress;
    const mapLink = p.mapLink !== undefined ? p.mapLink : defaults.mapLink;
    const phone = p.phone !== undefined ? p.phone : defaults.phone;
    const secondaryPhone = p.secondaryPhone !== undefined ? p.secondaryPhone : defaults.secondaryPhone;
    const whatsapp = p.whatsapp !== undefined ? p.whatsapp : defaults.whatsapp;
    const message = p.message !== undefined ? p.message : defaults.message;
    const musicUrl = p.musicUrl !== undefined ? p.musicUrl : defaults.musicUrl;
    const coverImageUrl = p.coverImageUrl !== undefined ? p.coverImageUrl : defaults.coverImageUrl;
    const galleryUrls = p.galleryUrls !== undefined ? p.galleryUrls : [];
    const theme = p.theme
        ? { ...defaults.theme, ...p.theme }
        : {
            ...defaults.theme,
            primaryColor: template.accent_color || defaults.theme.primaryColor,
        };
    const sections = p.sections !== undefined ? p.sections : {};

    let data = null as InvitationRowWithTemplate | null;
    let error = null as { code?: string; message?: string } | null;

    for (let attempt = 0; attempt < 3; attempt++) {
        const invitationId = crypto.randomUUID();
        const slug = p.slug || buildInvitationSlug(`${primaryName} ${secondaryName || ""}`, invitationId);

        const result = await supabase
            .from("invitations")
            .insert({
                id: invitationId,
                user_id: user.id,
                template_id: template.id,
                slug,
                category: p.category || template.category,
                title,
                primary_name: primaryName,
                secondary_name: secondaryName,
                event_date: eventDate,
                event_time: eventTime,
                venue_name: venueName,
                venue_address: venueAddress,
                map_link: mapLink,
                phone,
                secondary_phone: secondaryPhone,
                whatsapp,
                message,
                music_url: musicUrl,
                cover_image_url: coverImageUrl,
                theme: theme as Json,
                sections: sections as Json,
                gallery_urls: galleryUrls,
                status: "draft",
            })
            .select("*, invitation_templates(template_key)")
            .single();

        data = result.data as InvitationRowWithTemplate | null;
        error = result.error;
        if (!isUniqueSlugViolation(error)) break;
    }

    if (error || !data) {
        return NextResponse.json({ error: error?.message || "Failed to create invitation" }, { status: 400 });
    }

    return NextResponse.json(mapInvitationRow(data), { status: 201 });
}

function parseLimit(value: string | null, fallback: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(Math.floor(parsed), max);
}

function parseInvitationStatus(value: string | null): InvitationStatusFilter {
    return ["upcoming", "completed", "draft", "offline"].includes(value || "")
        ? value as InvitationStatusFilter
        : "all";
}

function parseInvitationSort(value: string | null): InvitationSort {
    return value && value in invitationSorts ? value as InvitationSort : "updated_desc";
}

function applyInvitationSearch<T>(query: T, search: string): T {
    if (!search) return query;
    const escaped = escapeLike(search);
    return (query as {
        or: (filters: string) => T;
    }).or([
        `title.ilike.%${escaped}%`,
        `primary_name.ilike.%${escaped}%`,
        `secondary_name.ilike.%${escaped}%`,
        `category.ilike.%${escaped}%`,
        `venue_name.ilike.%${escaped}%`,
        `slug.ilike.%${escaped}%`,
    ].join(","));
}

function applyCursorToItems<T extends { row: Record<string, unknown> }>(
    items: T[],
    field: string,
    ascending: boolean,
    cursor: { value: string; id: string } | null
) {
    if (!cursor?.value || !cursor.id) return items;
    return items.filter(({ row }) => {
        const rowValue = String(row[field] || "");
        const rowId = String(row.id || "");
        if (rowValue === cursor.value) return ascending ? rowId > cursor.id : rowId < cursor.id;
        return ascending ? rowValue > cursor.value : rowValue < cursor.value;
    });
}


async function getInvitationStats(invitationIds: string[]) {
    if (!invitationIds.length) return {};

    const supabase = await createClient();
    const [rsvpRowsResult, viewRowsResult] = await Promise.all([
        supabase.from("rsvps").select("invitation_id").in("invitation_id", invitationIds),
        supabase.from("invitation_events").select("invitation_id").in("invitation_id", invitationIds).eq("event_type", "view"),
    ]);

    return Object.fromEntries(invitationIds.map((id) => [
        id,
        {
            acceptsRsvps: true,
            rsvps: (rsvpRowsResult.data || []).filter((row) => row.invitation_id === id).length,
            views: (viewRowsResult.data || []).filter((row) => row.invitation_id === id).length,
        },
    ]));
}

async function getPaidInvitationIdsForUser(userId: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from("payments")
        .select("invitation_id")
        .eq("user_id", userId)
        .in("status", ["paid", "published"])
        .not("invitation_id", "is", null);

    return Array.from(new Set((data || []).map((row) => row.invitation_id).filter(Boolean)));
}

function isInvitationVisibleForStatus(
    invitation: ReturnType<typeof mapInvitationRow> & { paymentStatus?: string },
    status: InvitationStatusFilter
) {
    if (status === "all") return true;
    return getInvitationFilterBucket(invitation) === status;
}

function getInvitationFilterBucket(invitation: ReturnType<typeof mapInvitationRow> & { paymentStatus?: string }) {
    const isPaidPublishFailed = invitation.paymentStatus === "paid" &&
        !invitation.firstPublishedAt &&
        invitation.status !== "published";
    if (isPaidPublishFailed) return "offline";

    const lifecycleStatus = getInvitationLifecycle(invitation);
    if (lifecycleStatus === "draft") return "draft";
    if (lifecycleStatus === "offline") return "offline";
    if (lifecycleStatus === "completed") return "completed";
    return "upcoming";
}

function encodeCursor(cursor: { value: string; id: string }) {
    return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string | null): { value: string; id: string } | null {
    if (!value) return null;
    try {
        const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
        if (!parsed || typeof parsed !== "object") return null;
        const cursor = parsed as Record<string, unknown>;
        return typeof cursor.value === "string" && typeof cursor.id === "string"
            ? { value: cursor.value, id: cursor.id }
            : null;
    } catch {
        return null;
    }
}

function isUniqueSlugViolation(error: { code?: string; message?: string } | null) {
    return error?.code === "23505" && (error.message || "").toLowerCase().includes("slug");
}

function escapeLike(value: string) {
    return value.replace(/[%_]/g, (match) => `\\${match}`);
}
