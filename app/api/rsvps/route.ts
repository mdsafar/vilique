import { NextResponse } from "next/server";
import { rsvpCreateSchema, rsvpLookupSchema } from "@/features/invitations/validation";
import { createClient } from "@/lib/supabase/server";

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
    const parsed = rsvpCreateSchema.safeParse(await request.json().catch(() => ({})));

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("upsert_public_rsvp", {
        p_invitation_id: parsed.data.invitationId,
        p_guest_token: parsed.data.guestToken,
        p_status: parsed.data.status,
        p_guest_name: parsed.data.guestName,
        p_guest_phone: parsed.data.guestPhone || null,
        p_guest_count: parsed.data.guestCount,
        p_message: parsed.data.message || null,
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
