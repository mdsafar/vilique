"use server";

import { redirect } from "next/navigation";
import { siteConfig } from "@/lib/config/site";
import { createClient } from "@/lib/supabase/server";

function getRedirectPath(formData: FormData) {
    const next = String(formData.get("next") || "/profile");
    return next.startsWith("/") ? next : "/profile";
}

export async function signInWithEmail(formData: FormData) {
    const supabase = await createClient();
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const next = getRedirectPath(formData);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
    }

    redirect(next);
}

export async function signInWithGoogle(formData: FormData) {
    const next = getRedirectPath(formData);

    if (process.env.GOOGLE_AUTH_ENABLED !== "true") {
        redirect(
            `/login?error=${encodeURIComponent("Google login is not enabled for this Supabase project yet.")}&next=${encodeURIComponent(next)}`
        );
    }

    const supabase = await createClient();
    const origin = siteConfig.url;

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
    });

    if (error || !data.url) {
        redirect(
            `/login?error=${encodeURIComponent(error?.message || "Unable to start Google login.")}&next=${encodeURIComponent(next)}`
        );
    }

    redirect(data.url);
}

export async function signOut() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/");
}
