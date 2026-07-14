import { NextResponse } from "next/server";
import { createDefaultInvitation } from "@/lib/defaultInvitation";
import { mapInvitationRow, type InvitationRowWithTemplate } from "@/features/invitations/mappers";
import { createClient } from "@/lib/supabase/server";
import { invitationCreateSchema } from "@/features/invitations/validation";

const INVITATION_LIMIT_DEFAULT = 12;
const INVITATION_LIMIT_MAX = 30;
const invitationSorts = {
    updated_desc: { field: "updated_at", ascending: false },
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

    let query = supabase
        .from("invitations")
        .select("*, invitation_templates(template_key, default_music_url, default_tick_sound_url)", { count: "exact" })
        .eq("user_id", user.id);

    query = applyInvitationSearch(query, search);
    query = applyInvitationStatusFilter(query, status);
    query = applyCursor(query, sortConfig.field, sortConfig.ascending, cursor);
    query = query
        .order(sortConfig.field, { ascending: sortConfig.ascending, nullsFirst: false })
        .order("id", { ascending: sortConfig.ascending })
        .limit(limit + 1);

    const { data, error, count } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows = data || [];
    const pageRows = rows.slice(0, limit) as InvitationRowWithTemplate[];
    const items = pageRows.map(mapInvitationRow);
    const lastRow = pageRows[pageRows.length - 1] as Record<string, unknown> | undefined;
    const hasMore = rows.length > limit;
    const [counts, stats] = await Promise.all([
        getInvitationCounts(user.id, search),
        getInvitationStats(pageRows.map((row) => row.id)),
    ]);

    return NextResponse.json({
        items,
        nextCursor: hasMore && lastRow
            ? encodeCursor({ value: String(lastRow[sortConfig.field] || ""), id: String(lastRow.id) })
            : null,
        hasMore,
        totalCount: count || 0,
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
    const slug = `${defaults.primaryName}-${defaults.secondaryName || "invite"}-${crypto.randomUUID().slice(0, 8)}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const { data, error } = await supabase
        .from("invitations")
        .insert({
            user_id: user.id,
            template_id: template.id,
            slug,
            category: template.category,
            title: defaults.title,
            primary_name: defaults.primaryName,
            secondary_name: defaults.secondaryName,
            event_date: defaults.eventDate,
            event_time: defaults.eventTime,
            venue_name: defaults.venueName,
            venue_address: defaults.venueAddress,
            map_link: defaults.mapLink,
            phone: defaults.phone,
            message: defaults.message,
            music_url: defaults.musicUrl,
            theme: {
                ...defaults.theme,
                primaryColor: template.accent_color || defaults.theme.primaryColor,
            },
            sections: {},
            gallery_urls: [],
            status: "draft",
        })
        .select("*, invitation_templates(template_key)")
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
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

function applyInvitationStatusFilter<T>(query: T, status: InvitationStatusFilter): T {
    type Builder = {
        eq: (column: string, value: string) => Builder;
        neq: (column: string, value: string) => Builder;
        or: (filters: string) => Builder;
    };
    const builder = query as unknown as Builder;

    if (status === "draft") return builder.eq("status", "draft") as T;
    if (status === "completed") return builder.or("lifecycle_status.eq.completed,event_status.eq.completed,completed_at.not.is.null") as T;
    if (status === "offline") return builder.neq("status", "published").neq("status", "draft") as T;
    if (status === "upcoming") return builder.eq("status", "published").or("lifecycle_status.eq.published,event_status.eq.published") as T;
    return query;
}

function applyCursor<T>(
    query: T,
    field: string,
    ascending: boolean,
    cursor: { value: string; id: string } | null
): T {
    if (!cursor?.value || !cursor.id) return query;
    const operator = ascending ? "gt" : "lt";
    return (query as { or: (filters: string) => T }).or(
        `${field}.${operator}.${cursor.value},and(${field}.eq.${cursor.value},id.${operator}.${cursor.id})`
    );
}

async function getInvitationCounts(userId: string, search: string) {
    const supabase = await createClient();
    const statuses: InvitationStatusFilter[] = ["all", "upcoming", "completed", "draft", "offline"];
    const entries = await Promise.all(statuses.map(async (status) => {
        let query = supabase
            .from("invitations")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId);
        query = applyInvitationSearch(query, search);
        query = applyInvitationStatusFilter(query, status);
        const { count } = await query;
        return [status, count || 0] as const;
    }));
    return Object.fromEntries(entries);
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

function escapeLike(value: string) {
    return value.replace(/[%_]/g, (match) => `\\${match}`);
}
