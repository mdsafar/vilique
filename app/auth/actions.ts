"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { siteConfig } from "@/lib/config/site";
import { createClient } from "@/lib/supabase/server";

function getRedirectPath(formData: FormData): string {
    const next = String(formData.get("next") || "/profile");

    // Prevent external redirects such as //malicious-site.com
    return next.startsWith("/") && !next.startsWith("//")
        ? next
        : "/profile";
}

async function getRequestOrigin(): Promise<string> {
    const headerStore = await headers();

    const forwardedHost = headerStore.get("x-forwarded-host");
    const host = forwardedHost || headerStore.get("host");

    const forwardedProtocol = headerStore.get("x-forwarded-proto");

    if (host) {
        const protocol =
            forwardedProtocol ||
            (host.includes("localhost") ? "http" : "https");

        return `${protocol}://${host}`;
    }

    return siteConfig.url;
}

export async function signInWithGoogle(formData: FormData) {
    const next = getRedirectPath(formData);

    if (process.env.GOOGLE_AUTH_ENABLED !== "true") {
        redirect(
            `/login?error=${encodeURIComponent(
                "Google login is not enabled."
            )}&next=${encodeURIComponent(next)}`
        );
    }

    const supabase = await createClient();
    const origin = await getRequestOrigin();

    const callbackUrl =
        `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: callbackUrl,
        },
    });

    if (error || !data.url) {
        redirect(
            `/login?error=${encodeURIComponent(
                error?.message || "Unable to start Google login."
            )}&next=${encodeURIComponent(next)}`
        );
    }

    redirect(data.url);
}

export async function signOut() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/");
}