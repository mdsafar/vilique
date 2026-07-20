import { NextResponse } from "next/server";
import { eventCreateSchema } from "@/features/invitations/validation";
import { createClient } from "@/lib/supabase/server";
import { isInvitationCompleted } from "@/lib/lifecycle";
import { Json } from "@/types/database";
import {
    getClientIp,
    getVisitorKey,
    hashValue,
    isLikelyBot,
    rateLimit,
    rateLimitResponse,
    readJsonWithLimit,
    recordSubmissionGuard,
} from "@/lib/security/requestGuard";
import { looseSupabase } from "@/lib/supabase/loose";

export async function POST(request: Request) {
    const supabase = await createClient();
    let body: unknown;
    try {
        body = await readJsonWithLimit(request, 8 * 1024);
    } catch {
        return NextResponse.json({ error: "Invalid or oversized payload" }, { status: 413 });
    }

    const parsed = eventCreateSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const metadata = parsed.data.metadata || {};
    if (metadata.preview === true || metadata.mode === "preview" || isLikelyBot(request)) {
        return NextResponse.json({ ok: true, ignored: true }, { status: 202 });
    }

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data: invite } = await supabase
        .from("invitations")
        .select("id, user_id, status, event_date, event_time, event_timezone, lifecycle_status, event_status, first_published_at, published_at")
        .eq("id", parsed.data.invitationId)
        .single();

    if (user && invite && user.id === invite.user_id) {
        return NextResponse.json({ ok: true, ignored: true, reason: "owner_view" }, { status: 202 });
    }

    const visitorKey = getVisitorKey(request, typeof metadata.guestToken === "string" ? metadata.guestToken : null);
    const ipHash = hashValue(getClientIp(request));
    const bucket = parsed.data.eventType === "view"
        ? new Date(Math.floor(Date.now() / (30 * 60 * 1000)) * 30 * 60 * 1000).toISOString()
        : new Date(Math.floor(Date.now() / (5 * 60 * 1000)) * 5 * 60 * 1000).toISOString();
    const dedupeKey = hashValue(`${parsed.data.invitationId}:${parsed.data.eventType}:${visitorKey}:${bucket}`);

    const limit = await rateLimit({
        key: `event:${parsed.data.invitationId}:${visitorKey}`,
        limit: parsed.data.eventType === "view" ? 20 : 10,
        windowMs: 10 * 60 * 1000,
    });

    if (!limit.ok) {
        return rateLimitResponse(limit.resetAt);
    }

    if (parsed.data.eventType === "rsvp_submit") {
        if (invite && isInvitationCompleted({
            eventDate: invite.event_date,
            eventTime: invite.event_time,
            eventTimezone: invite.event_timezone,
            status: invite.status,
            lifecycleStatus: invite.lifecycle_status,
            eventStatus: invite.event_status,
            first_published_at: invite.first_published_at,
            published_at: invite.published_at,
        })) {
            return NextResponse.json({
                code: "EVENT_COMPLETED",
                message: "This event has already concluded.",
            }, { status: 400 });
        }
    }

    if (parsed.data.eventType === "view") {
        const guard = await recordSubmissionGuard({
            scope: "event",
            invitationId: parsed.data.invitationId,
            action: parsed.data.eventType,
            dedupeKey,
            metadata: { ipHash },
        });

        if (guard.duplicate) {
            return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
        }
    }

    const insertPayload = {
        invitation_id: parsed.data.invitationId,
        event_type: parsed.data.eventType,
        metadata: {
            ...(metadata as Record<string, Json>),
            visitorHash: visitorKey,
            ipHash,
        } as Json,
        dedupe_key: parsed.data.eventType === "view" ? dedupeKey : null,
        visitor_token_hash: visitorKey,
        time_bucket: bucket,
    };

    const { error } = await looseSupabase(supabase).from("invitation_events").insert(insertPayload);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
}
