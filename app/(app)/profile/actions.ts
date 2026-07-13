"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function deleteInvitation(formData: FormData) {
    const id = String(formData.get("id") || "");
    if (!id) return { ok: false, error: "Invitation not found." };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { ok: false, error: "Please sign in again." };

    const { error } = await supabase
        .from("invitations")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        return { ok: false, error: "Unable to delete invitation." };
    }

    revalidatePath("/profile");
    return { ok: true };
}
