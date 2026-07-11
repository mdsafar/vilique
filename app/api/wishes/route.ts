import { NextResponse } from "next/server";
import { wishCreateSchema } from "@/features/invitations/validation";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
    const supabase = await createClient();
    const parsed = wishCreateSchema.safeParse(await request.json().catch(() => ({})));

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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

