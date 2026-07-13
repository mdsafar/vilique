"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
    ArrowLeft,
    BarChart3,
    Eye,
    Heart,
    MessageSquareText,
    MousePointerClick,
    Percent,
    Share2,
    Smartphone,
    ThumbsDown,
    ThumbsUp,
    UsersRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { InvitationAnalyticsData, RecentRsvpAnalyticsItem } from "@/lib/invitationAnalytics";
import { InvitationData } from "@/types/invitation";
import { Json } from "@/types/database";

type Props = {
    invitation: InvitationData;
    initialAnalytics: InvitationAnalyticsData;
};

type AnalyticsEventRow = {
    event_type?: string;
    metadata?: Json;
    created_at?: string;
};

type RsvpRealtimeRow = {
    id?: string;
    status?: RecentRsvpAnalyticsItem["status"];
    guest_name?: string | null;
    guest_count?: number | null;
    created_at?: string;
    updated_at?: string;
};

type WishRealtimeRow = {
    id?: string;
};

export default function InvitationAnalyticsClient({ invitation, initialAnalytics }: Props) {
    const [analytics, setAnalytics] = useState(initialAnalytics);
    const hasData = analytics.views + analytics.rsvps + analytics.wishes + analytics.shares > 0;

    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel(`invitation-analytics:${invitation.id}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "rsvps", filter: `invitation_id=eq.${invitation.id}` },
                (payload) => {
                    setAnalytics((current) => applyRsvpChange(current, payload.eventType, payload.new, payload.old));
                }
            )
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "invitation_events", filter: `invitation_id=eq.${invitation.id}` },
                (payload) => {
                    setAnalytics((current) => applyEventInsert(current, payload.new));
                }
            )
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "guest_wishes", filter: `invitation_id=eq.${invitation.id}` },
                (payload) => {
                    setAnalytics((current) => applyWishInsert(current, payload.new));
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [invitation.id]);

    const stats = useMemo(() => [
        { label: "Views", value: analytics.views, detail: "Invitation page visits", icon: Eye, tone: "blue" },
        { label: "Accepted", value: analytics.accepted, detail: "Current accepted RSVPs", icon: ThumbsUp, tone: "green" },
        { label: "Declined", value: analytics.declined, detail: "Current declined RSVPs", icon: ThumbsDown, tone: "rose" },
        { label: "Response rate", value: `${analytics.responseRate}%`, detail: "Accepted share of RSVPs", icon: Percent, tone: "orange" },
        { label: "Unique visitors", value: analytics.uniqueVisitors, detail: "Distinct visitor signals", icon: UsersRound, tone: "green" },
        { label: "Wishes", value: analytics.wishes, detail: "Guest wishes", icon: Heart, tone: "orange" },
    ], [analytics]);

    return (
        <section className="analyticsPanel">
            <header className="analyticsHeader">
                <div className="analyticsHeaderText">
                    <span>Invitation analytics</span>
                    <h1>Analytics</h1>
                    <p>{invitation.title}</p>
                </div>
                <Link href="/invitations" className="analyticsBackBtn">
                    <ArrowLeft size={16} />
                    <span>Back</span>
                </Link>
            </header>

            {!hasData ? (
                <div className="analyticsEmptyState">
                    <div className="analyticsEmptyIcon">
                        <BarChart3 size={26} />
                    </div>
                    <h3>No analytics yet</h3>
                    <p>No one has visited your invitation yet.</p>
                    <div className="analyticsEmptyChips">
                        <span>Views</span>
                        <span>RSVPs</span>
                        <span>Wishes</span>
                        <span>Visitor insights</span>
                    </div>
                </div>
            ) : (
                <>
                    <section className="analyticsStats" aria-label="Invitation analytics metrics">
                        {stats.map((item) => {
                            const Icon = item.icon;
                            return (
                                <article className={`analyticsStat analyticsStat--${item.tone}`} key={item.label}>
                                    <span className="analyticsStatIcon">
                                        <Icon size={18} />
                                    </span>
                                    <div className="analyticsStatBody">
                                        <strong>{item.value}</strong>
                                        <b>{item.label}</b>
                                        <p>{item.detail}</p>
                                    </div>
                                </article>
                            );
                        })}
                    </section>

                    <section className="analyticsBreakdown" aria-label="Visitor insights">
                        <RecentRsvpsList items={analytics.recentRsvps} />
                        <AnalyticsList title="Devices" label="Device mix" icon={Smartphone} items={analytics.devices} />
                        <AnalyticsList title="Browsers" label="Browser signals" icon={MousePointerClick} items={analytics.browsers} />
                        <div className="analyticsBreakdownCard">
                            <AnalyticsPanelTitle icon={BarChart3} title="Traffic over time" label="Daily visits" />
                            {analytics.trafficByDay.length ? (
                                <ul>
                                    {analytics.trafficByDay.map((item) => (
                                        <li key={item.date}>
                                            <span>{formatDate(item.date)}</span>
                                            <strong>{item.views}</strong>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>No traffic yet.</p>
                            )}
                        </div>
                        <AnalyticsList title="Locations" label="Visitor locations" icon={UsersRound} items={analytics.locations} />
                        <AnalyticsList title="Shares" label="Share actions" icon={Share2} items={analytics.shares ? [{ label: "Total shares", count: analytics.shares }] : []} />
                    </section>
                </>
            )}
        </section>
    );
}

function RecentRsvpsList({ items }: { items: RecentRsvpAnalyticsItem[] }) {
    return (
        <div className="analyticsBreakdownCard">
            <AnalyticsPanelTitle icon={MessageSquareText} title="Recent responses" label="Latest RSVP list" />
            {items.length ? (
                <ul>
                    {items.map((item) => (
                        <li key={item.id}>
                            <span>{item.guestName || "Guest"} · {item.status}</span>
                            <strong>{item.guestCount}</strong>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No RSVP yet.</p>
            )}
        </div>
    );
}

function AnalyticsList({
    title,
    label,
    icon: Icon,
    items,
}: {
    title: string;
    label: string;
    icon: typeof Smartphone;
    items: { label: string; count: number }[];
}) {
    return (
        <div className="analyticsBreakdownCard">
            <AnalyticsPanelTitle icon={Icon} title={title} label={label} />
            {items.length ? (
                <ul>
                    {items.map((item) => (
                        <li key={item.label}>
                            <span>{item.label}</span>
                            <strong>{item.count}</strong>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No data yet.</p>
            )}
        </div>
    );
}

function AnalyticsPanelTitle({
    icon: Icon,
    title,
    label,
}: {
    icon: typeof Smartphone;
    title: string;
    label: string;
}) {
    return (
        <div className="analyticsPanelTitle">
            <span>
                <Icon size={16} />
            </span>
            <div>
                <h3>{title}</h3>
                <p>{label}</p>
            </div>
        </div>
    );
}

function applyRsvpChange(
    current: InvitationAnalyticsData,
    eventType: string,
    nextRaw: unknown,
    oldRaw: unknown
): InvitationAnalyticsData {
    const next = toRsvpItem(nextRaw);
    const oldId = getRecord(oldRaw).id;
    const nextRows = (() => {
        if (eventType === "DELETE" && typeof oldId === "string") {
            return current.rsvpRows.filter((row) => row.id !== oldId);
        }
        if (!next) return current.rsvpRows;
        const exists = current.rsvpRows.some((row) => row.id === next.id);
        return (exists
            ? current.rsvpRows.map((row) => row.id === next.id ? next : row)
            : [next, ...current.rsvpRows]
        ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    })();

    return withRsvpTotals({
        ...current,
        rsvpRows: nextRows,
        recentRsvps: nextRows.slice(0, 8),
    });
}

function applyEventInsert(current: InvitationAnalyticsData, raw: unknown): InvitationAnalyticsData {
    const event = getRecord(raw) as AnalyticsEventRow;
    const eventType = event.event_type;
    const createdAt = typeof event.created_at === "string" ? event.created_at : new Date().toISOString();

    if (eventType === "view") {
        const metadata = getMetadataRecord(event.metadata);
        const visitorKey = getFirstString(metadata, ["visitorId", "sessionId", "fingerprint"]);
        const visitorKeys = visitorKey && !current.visitorKeys.includes(visitorKey)
            ? [...current.visitorKeys, visitorKey]
            : current.visitorKeys;

        return {
            ...current,
            views: current.views + 1,
            uniqueVisitors: visitorKeys.length || current.uniqueVisitors,
            visitorKeys,
            trafficByDay: incrementTrafficDay(current.trafficByDay, createdAt.slice(0, 10)),
        };
    }

    if (eventType === "share") {
        return { ...current, shares: current.shares + 1 };
    }

    return current;
}

function applyWishInsert(current: InvitationAnalyticsData, raw: unknown): InvitationAnalyticsData {
    const row = getRecord(raw) as WishRealtimeRow;
    return row.id ? { ...current, wishes: current.wishes + 1 } : current;
}

function withRsvpTotals(analytics: InvitationAnalyticsData): InvitationAnalyticsData {
    const accepted = analytics.rsvpRows.filter((row) => row.status === "accepted").length;
    const declined = analytics.rsvpRows.filter((row) => row.status === "declined").length;
    const rsvps = analytics.rsvpRows.length;
    return {
        ...analytics,
        rsvps,
        accepted,
        declined,
        responded: accepted + declined,
        responseRate: rsvps ? Math.round((accepted / rsvps) * 100) : 0,
    };
}

function toRsvpItem(raw: unknown): RecentRsvpAnalyticsItem | null {
    const row = getRecord(raw) as RsvpRealtimeRow;
    if (!row.id || !row.status) return null;
    return {
        id: row.id,
        guestName: row.guest_name || "Guest",
        status: row.status,
        guestCount: row.guest_count || 1,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
    };
}

function incrementTrafficDay(days: InvitationAnalyticsData["trafficByDay"], date: string) {
    const exists = days.some((day) => day.date === date);
    if (!exists) return [...days, { date, views: 1 }];
    return days.map((day) => day.date === date ? { ...day, views: day.views + 1 } : day);
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(`${value}T00:00:00`));
}

function getRecord(value: unknown): Record<string, unknown> {
    if (!value || Array.isArray(value) || typeof value !== "object") return {};
    return value as Record<string, unknown>;
}

function getMetadataRecord(metadata: Json | undefined): Record<string, unknown> {
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
