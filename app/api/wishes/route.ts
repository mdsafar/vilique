import { NextResponse } from "next/server";
import { wishCreateSchema } from "@/features/invitations/validation";
import { createClient } from "@/lib/supabase/server";
import { isInvitationCompleted } from "@/lib/lifecycle";
import {
    getVisitorKey,
    hashValue,
    rateLimit,
    rateLimitResponse,
    readJsonWithLimit,
    recordSubmissionGuard,
    sanitizeText,
} from "@/lib/security/requestGuard";

export async function POST(request: Request) {
    const supabase = await createClient();
    let body: unknown;
    try {
        body = await readJsonWithLimit(request, 12 * 1024);
    } catch {
        return NextResponse.json({ error: "Invalid or oversized payload" }, { status: 413 });
    }

    const parsed = wishCreateSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const guestName = sanitizeText(parsed.data.guestName);
    const message = sanitizeText(parsed.data.message);
    const visitorKey = getVisitorKey(request, null);
    const limit = await rateLimit({
        key: `wish:${parsed.data.invitationId}:${visitorKey}`,
        limit: 3,
        windowMs: 15 * 60 * 1000,
    });

    if (!limit.ok) {
        return rateLimitResponse(limit.resetAt);
    }

    const dedupeKey = hashValue(`${guestName.toLowerCase()}|${message.toLowerCase()}`);
    const guard = await recordSubmissionGuard({
        scope: "wish",
        invitationId: parsed.data.invitationId,
        dedupeKey,
        action: "create",
    });

    if (guard.duplicate) {
        return NextResponse.json({ error: "This wish was already submitted." }, { status: 409 });
    }

    // Check if the event has completed
    const { data: invite } = await supabase
        .from("invitations")
        .select("status, event_date, event_time, event_timezone, lifecycle_status, event_status, first_published_at, published_at")
        .eq("id", parsed.data.invitationId)
        .single();

    if (invite) {
        const completed = isInvitationCompleted({
            eventDate: invite.event_date,
            eventTime: invite.event_time,
            eventTimezone: invite.event_timezone,
            status: invite.status,
            lifecycleStatus: invite.lifecycle_status,
            eventStatus: invite.event_status,
            first_published_at: invite.first_published_at,
            published_at: invite.published_at,
        });

        if (completed) {
            return NextResponse.json({
                code: "EVENT_COMPLETED",
                message: "This event has already concluded."
            }, { status: 400 });
        }
    }

    const { error } = await supabase.from("guest_wishes").insert({
        invitation_id: parsed.data.invitationId,
        guest_name: guestName,
        message,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
}
