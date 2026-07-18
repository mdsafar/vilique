"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/observability";

export async function deleteInvitation(formData: FormData) {
    const id = String(formData.get("id") || "");
    if (!id) return { ok: false, error: "Invitation not found." };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { ok: false, error: "Please sign in again." };

    const supabaseAdmin = createAdminClient();
    const { data: invitation, error: invitationError } = await supabaseAdmin
        .from("invitations")
        .select("id, payment_status, first_published_at")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

    if (invitationError || !invitation) {
        return { ok: false, error: "Invitation not found." };
    }

    const { data: paidPayment } = await supabaseAdmin
        .from("payments")
        .select("id")
        .eq("invitation_id", id)
        .eq("user_id", user.id)
        .eq("status", "paid")
        .maybeSingle();

    if (paidPayment || invitation.payment_status === "paid" || invitation.first_published_at) {
        return {
            ok: false,
            error: "This invitation has a payment attached and cannot be deleted. You can edit it instead.",
        };
    }

    const { error } = await supabaseAdmin
        .from("invitations")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        const message = error.message || "";
        if (message.includes("Paid invitations cannot be deleted")) {
            return {
                ok: false,
                error: "This invitation has a payment attached and cannot be deleted. You can edit it instead.",
            };
        }
        console.error("Unable to delete invitation:", error);
        reportError(error, "invitation.delete_db_failed", { invitationId: id, userId: user.id });
        return { ok: false, error: "Unable to delete invitation." };
    }

    revalidatePath("/profile");
    revalidatePath("/invitations");
    return { ok: true };
}
