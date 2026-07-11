"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function deleteInvitation(formData: FormData) {
    const id = String(formData.get("id") || "");
    if (!id) return;

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase
        .from("invitations")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    revalidatePath("/profile");
}
