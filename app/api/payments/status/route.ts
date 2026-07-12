import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const invitationId = searchParams.get("invitationId");

        if (!invitationId) {
            return NextResponse.json({ error: "Missing invitationId" }, { status: 400 });
        }

        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch invitation and verify ownership
        const { data: invite, error: inviteError } = await supabase
            .from("invitations")
            .select("*, invitation_templates(*)")
            .eq("id", invitationId)
            .eq("user_id", user.id)
            .maybeSingle();

        if (inviteError || !invite) {
            return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
        }

        const template = invite.invitation_templates;
        if (!template) {
            return NextResponse.json({ error: "Template not found for this invitation" }, { status: 400 });
        }

        // Query payments table to check for verified payments using admin client
        const supabaseAdmin = createAdminClient();
        const { data: payment } = await supabaseAdmin
            .from("payments")
            .select("id")
            .eq("invitation_id", invitationId)
            .eq("status", "paid")
            .maybeSingle();

        return NextResponse.json({
            isFree: template.is_free,
            pricePaise: template.price_paise,
            currency: template.currency,
            alreadyPaid: !!payment,
        });
    } catch (err: unknown) {
        console.error("Error fetching payment status:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
