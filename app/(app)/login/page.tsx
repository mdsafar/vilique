import Link from "next/link";
import type { Metadata } from "next";
import { signInWithGoogle } from "@/app/auth/actions";
import AppLogo from "@/components/AppLogo";

export const metadata: Metadata = {
    title: "Log in",
    description: "Log in to your Vilique account.",
};

type Props = {
    searchParams: Promise<{
        error?: string;
        next?: string;
    }>;
};

export default async function LoginPage({ searchParams }: Props) {
    const { error, next = "/profile" } = await searchParams;
    const googleEnabled = process.env.GOOGLE_AUTH_ENABLED === "true";

    return (
        <main className="authPage">
            <nav className="authNav" aria-label="Authentication navigation">
                <Link href="/templates">
                    <AppLogo size={30} />
                </Link>
                <div>
                    <Link href="/templates">Templates</Link>
                </div>
            </nav>

            <section className="authPanel">
                <div className="authPanelTop">
                    <span>Google account</span>
                    <span>Secure sign in</span>
                </div>

                <div className="authCopy">
                    <p className="eyebrow">Welcome</p>
                    <h1>Log in</h1>
                    <p>Continue with Google to open your Vilique profile, edit drafts, and publish invitation websites.</p>
                </div>

                {error ? <div className="authError">{error}</div> : null}

                <form action={signInWithGoogle}>
                    <input type="hidden" name="next" value={next} />
                    <button className="oauthButton" type="submit" disabled={!googleEnabled}>
                        <span className="googleMark" aria-hidden="true">G</span>
                        Continue with Google
                    </button>
                </form>
                {!googleEnabled ? <p className="authHint">Google login needs OAuth credentials in Supabase first.</p> : null}

                <div className="authQuickLinks" aria-label="Quick links">
                    <Link href="/templates">Browse templates</Link>
                    <Link href="/templates">Back to templates</Link>
                </div>
            </section>
        </main>
    );
}
