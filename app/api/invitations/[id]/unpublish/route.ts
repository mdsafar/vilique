import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = {
    params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: Context) {
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
        .update({
            status: "draft",
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id, slug, status")
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
}
