import { NextResponse } from "next/server";
import { eventCreateSchema } from "@/features/invitations/validation";
import { createClient } from "@/lib/supabase/server";
import { isInvitationCompleted } from "@/lib/lifecycle";
import { Json } from "@/types/database";

export async function POST(request: Request) {
    const supabase = await createClient();
    const parsed = eventCreateSchema.safeParse(await request.json().catch(() => ({})));

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.eventType === "rsvp_submit") {
        const { data: invite } = await supabase
            .from("invitations")
            .select("status, event_date, event_time, event_timezone, lifecycle_status, event_status, first_published_at, published_at")
            .eq("id", parsed.data.invitationId)
            .single();

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

    const { error } = await supabase.from("invitation_events").insert({
        invitation_id: parsed.data.invitationId,
        event_type: parsed.data.eventType,
        metadata: parsed.data.metadata as Json,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
}
