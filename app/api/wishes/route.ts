import { NextResponse } from "next/server";
import { wishCreateSchema } from "@/features/invitations/validation";
import { createClient } from "@/lib/supabase/server";
import { isEventCompleted } from "@/lib/lifecycle";

export async function POST(request: Request) {
    const supabase = await createClient();
    const parsed = wishCreateSchema.safeParse(await request.json().catch(() => ({})));

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Check if the event has completed
    const { data: invite } = await supabase
        .from("invitations")
        .select("event_date, event_time, event_timezone, lifecycle_status")
        .eq("id", parsed.data.invitationId)
        .single();

    if (invite) {
        const completed = invite.lifecycle_status === "completed" || isEventCompleted({
            eventDate: invite.event_date,
            eventTime: invite.event_time,
            eventTimezone: invite.event_timezone,
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
        guest_name: parsed.data.guestName,
        message: parsed.data.message,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
}

