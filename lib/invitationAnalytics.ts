import { createClient } from "@/lib/supabase/server";
import { mapInvitationRow } from "@/features/invitations/mappers";
import { Json } from "@/types/database";

type AnalyticsEventRow = {
    event_type: string;
    metadata: Json;
    created_at: string;
    visitor_token_hash?: string | null;
};
type RsvpAnalyticsRow = {
    id: string;
    status: "accepted" | "declined" | "maybe";
    guest_name: string;
    guest_count: number;
    created_at: string;
    updated_at: string;
};

export type RecentRsvpAnalyticsItem = {
    id: string;
    guestName: string;
    status: "accepted" | "declined" | "maybe";
    guestCount: number;
    createdAt: string;
    updatedAt: string;
};

export type InvitationAnalyticsData = {
    views: number;
    uniqueVisitors: number;
    rsvps: number;
    accepted: number;
    declined: number;
    responseRate: number;
    wishes: number;
    shares: number;
    devices: { label: string; count: number }[];
    browsers: { label: string; count: number }[];
    locations: { label: string; count: number }[];
    trafficByDay: { date: string; views: number }[];
    visitorKeys: string[];
    rsvpRows: RecentRsvpAnalyticsItem[];
    recentRsvps: RecentRsvpAnalyticsItem[];
    responded: number;
};

export async function getInvitationAnalytics(invitationId: string) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { status: "unauthorized" as const };

    const { data: invitation } = await supabase
        .from("invitations")
        .select("*, invitation_templates(template_key)")
        .eq("id", invitationId)
        .eq("user_id", user.id)
        .single();

    if (!invitation) return { status: "not_found" as const };

    if (!invitation.first_published_at && !invitation.published_at) {
        return {
            status: "draft" as const,
            invitation: mapInvitationRow(invitation),
        };
    }

    const [eventsResult, rsvpsResult, wishesResult] = await Promise.all([
        supabase
            .from("invitation_events")
            .select("event_type, metadata, created_at, visitor_token_hash")
            .eq("invitation_id", invitationId)
            .order("created_at", { ascending: true }),
        supabase
            .from("rsvps")
            .select("id, status, guest_name, guest_count, created_at, updated_at")
            .eq("invitation_id", invitationId)
            .order("updated_at", { ascending: false }),
        supabase
            .from("guest_wishes")
            .select("id, created_at")
            .eq("invitation_id", invitationId)
            .order("created_at", { ascending: true }),
    ]);

    const events = (eventsResult.data || []) as AnalyticsEventRow[];
    const viewEvents = events.filter((event) => event.event_type === "view");
    const rsvps = (rsvpsResult.data || []) as RsvpAnalyticsRow[];
    const wishes = wishesResult.data || [];
    const accepted = rsvps.filter((rsvp) => rsvp.status === "accepted").length;
    const declined = rsvps.filter((rsvp) => rsvp.status === "declined").length;
    const responded = accepted + declined;

    return {
        status: "ok" as const,
        invitation: mapInvitationRow(invitation),
        analytics: {
            views: viewEvents.length,
            uniqueVisitors: countUniqueVisitors(viewEvents),
            rsvps: rsvps.length,
            accepted,
            declined,
            responseRate: rsvps.length ? Math.round((accepted / rsvps.length) * 100) : 0,
            wishes: wishes.length,
            shares: events.filter((event) => event.event_type === "share").length,
            devices: summarizeMetadata(events, ["device", "deviceType", "platform"]),
            browsers: summarizeMetadata(events, ["browser", "browserName"]),
            locations: summarizeMetadata(events, ["location", "city", "country", "region"]),
            trafficByDay: summarizeTraffic(viewEvents),
            visitorKeys: getVisitorKeys(viewEvents),
            rsvpRows: rsvps.map(mapRsvpAnalyticsRow),
            recentRsvps: rsvps.slice(0, 8).map((rsvp) => ({
                id: rsvp.id,
                guestName: rsvp.guest_name,
                status: rsvp.status,
                guestCount: rsvp.guest_count,
                createdAt: rsvp.created_at,
                updatedAt: rsvp.updated_at,
            })),
            responded,
        },
    };
}

function mapRsvpAnalyticsRow(rsvp: RsvpAnalyticsRow): RecentRsvpAnalyticsItem {
    return {
        id: rsvp.id,
        guestName: rsvp.guest_name,
        status: rsvp.status,
        guestCount: rsvp.guest_count,
        createdAt: rsvp.created_at,
        updatedAt: rsvp.updated_at,
    };
}

function extractVisitorKey(event: AnalyticsEventRow): string {
    if (typeof event.visitor_token_hash === "string" && event.visitor_token_hash.trim()) {
        return event.visitor_token_hash.trim();
    }
    const metadata = getMetadataRecord(event.metadata);
    return getFirstString(metadata, [
        "visitorHash",
        "visitor_token_hash",
        "visitorId",
        "sessionId",
        "fingerprint",
        "guestToken",
        "ipHash",
    ]);
}

function countUniqueVisitors(events: AnalyticsEventRow[]) {
    const keys = new Set<string>();

    for (const event of events) {
        const key = extractVisitorKey(event);
        if (key) {
            keys.add(key);
        } else {
            keys.add(`${event.created_at}:${JSON.stringify(event.metadata)}`);
        }
    }

    return keys.size;
}

function summarizeMetadata(events: AnalyticsEventRow[], keys: string[]) {
    const counts = new Map<string, number>();

    for (const event of events) {
        const value = getFirstString(getMetadataRecord(event.metadata), keys);
        if (!value) continue;
        counts.set(value, (counts.get(value) || 0) + 1);
    }

    return Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
}

function summarizeTraffic(events: AnalyticsEventRow[]) {
    const counts = new Map<string, number>();

    for (const event of events) {
        const day = event.created_at.slice(0, 10);
        counts.set(day, (counts.get(day) || 0) + 1);
    }

    return Array.from(counts.entries()).map(([date, views]) => ({ date, views }));
}

function getVisitorKeys(events: AnalyticsEventRow[]) {
    return Array.from(new Set(events.map(extractVisitorKey).filter(Boolean)));
}

function getMetadataRecord(metadata: Json): Record<string, unknown> {
    if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") return {};
    return metadata as Record<string, unknown>;
}

function getFirstString(metadata: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = metadata[key];
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
}
