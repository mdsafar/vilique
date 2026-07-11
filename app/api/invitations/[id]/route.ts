import { NextResponse } from "next/server";
import { mapInvitationRow, toInvitationUpdate } from "@/features/invitations/mappers";
import { invitationUpdateSchema } from "@/features/invitations/validation";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/types/database";

type Context = {
    params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Context) {
    const { id } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = invitationUpdateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("invitations")
        .update(stripUndefined(toInvitationUpdate(parsed.data)))
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id, slug, status, updated_at")
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
}

export async function GET(_request: Request, { params }: Context) {
    const { id } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
        .from("invitations")
        .select("*, invitation_templates(template_key)")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (error || !data) {
        return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    return NextResponse.json(mapInvitationRow(data as any));
}

export async function DELETE(_request: Request, { params }: Context) {
    const { id } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
        .from("invitations")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
}

function stripUndefined(value: Database["public"]["Tables"]["invitations"]["Update"]) {
    return Object.fromEntries(
        Object.entries(value).filter((entry) => entry[1] !== undefined)
    ) as Database["public"]["Tables"]["invitations"]["Update"];
}
