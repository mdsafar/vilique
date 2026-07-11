import { NextResponse } from "next/server";
import { eventCreateSchema } from "@/features/invitations/validation";
import { createClient } from "@/lib/supabase/server";
import { Json } from "@/types/database";

export async function POST(request: Request) {
    const supabase = await createClient();
    const parsed = eventCreateSchema.safeParse(await request.json().catch(() => ({})));

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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
