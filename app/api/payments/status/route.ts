import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { looseSupabase } from "@/lib/supabase/loose";
import { reportError } from "@/lib/observability";

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
        const { data: payment } = await looseSupabase(supabaseAdmin)
            .from("payments")
            .select("id, status, publish_state, recovery_state")
            .eq("invitation_id", invitationId)
            .in("status", ["paid", "captured", "publish_pending", "published", "recovery_pending", "manual_review"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        const paymentStatus = payment as { status?: string; recovery_state?: string } | null;

        return NextResponse.json({
            isFree: template.is_free,
            pricePaise: template.price_paise,
            currency: template.currency,
            alreadyPaid: !!payment,
            recoveryPending: paymentStatus?.status === "recovery_pending" || paymentStatus?.recovery_state === "pending",
        });
    } catch (err: unknown) {
        console.error("Error fetching payment status:", err);
        const invitationId = new URL(request.url).searchParams.get("invitationId") || undefined;
        reportError(err, "payment.status_check_failed", { invitationId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
