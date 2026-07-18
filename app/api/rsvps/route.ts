import { NextResponse } from "next/server";
import { rsvpCreateSchema, rsvpLookupSchema } from "@/features/invitations/validation";
import { createClient } from "@/lib/supabase/server";
import {
    getVisitorKey,
    hashValue,
    rateLimit,
    rateLimitResponse,
    readJsonWithLimit,
    recordSubmissionGuard,
    sanitizeText,
} from "@/lib/security/requestGuard";

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const parsed = rsvpLookupSchema.safeParse({
        invitationId: searchParams.get("invitationId"),
        guestToken: searchParams.get("guestToken"),
    });

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("get_public_rsvp", {
        p_invitation_id: parsed.data.invitationId,
        p_guest_token: parsed.data.guestToken,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ rsvp: data?.[0] || null }, { status: 200 });
}

export async function POST(request: Request) {
    const supabase = await createClient();
    let body: unknown;
    try {
        body = await readJsonWithLimit(request, 12 * 1024);
    } catch {
        return NextResponse.json({ error: "Invalid or oversized payload" }, { status: 413 });
    }

    const parsed = rsvpCreateSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const visitorKey = getVisitorKey(request, parsed.data.guestToken);
    const limit = await rateLimit({
        key: `rsvp:${parsed.data.invitationId}:${visitorKey}`,
        limit: 30,
        windowMs: 10 * 60 * 1000,
    });

    if (!limit.ok) {
        return rateLimitResponse(limit.resetAt);
    }

    const dedupeKey = hashValue([
        parsed.data.guestToken,
        parsed.data.status,
        sanitizeText(parsed.data.guestName).toLowerCase(),
        parsed.data.guestPhone || "",
        parsed.data.guestCount,
        sanitizeText(parsed.data.message || "").toLowerCase(),
    ].join("|"));
    const guard = await recordSubmissionGuard({
        scope: "rsvp",
        invitationId: parsed.data.invitationId,
        dedupeKey,
        action: "upsert",
    });

    if (guard.duplicate) {
        return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
    }

    const { data, error } = await supabase.rpc("upsert_public_rsvp", {
        p_invitation_id: parsed.data.invitationId,
        p_guest_token: parsed.data.guestToken,
        p_status: parsed.data.status,
        p_guest_name: sanitizeText(parsed.data.guestName),
        p_guest_phone: parsed.data.guestPhone ? sanitizeText(parsed.data.guestPhone) : null,
        p_guest_count: parsed.data.guestCount,
        p_message: parsed.data.message ? sanitizeText(parsed.data.message) : null,
    });

    if (error) {
        const isCompleted = error.message.toLowerCase().includes("concluded");
        return NextResponse.json({
            code: isCompleted ? "EVENT_COMPLETED" : "RSVP_FAILED",
            message: error.message,
        }, { status: isCompleted ? 409 : 400 });
    }

    return NextResponse.json({ ok: true, rsvp: data?.[0] || null }, { status: 200 });
}
