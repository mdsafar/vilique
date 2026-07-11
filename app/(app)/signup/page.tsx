import Link from "next/link";
import type { Metadata } from "next";
import { signInWithGoogle } from "@/app/auth/actions";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
    title: "Sign up",
    description: "Create your Viliqu account.",
};

type Props = {
    searchParams: Promise<{
        error?: string;
        next?: string;
        view?: string;
    }>;
};

export default async function SignupPage({ searchParams }: Props) {
    const { error, next = "/profile", view } = await searchParams;
    const googleEnabled = process.env.GOOGLE_AUTH_ENABLED === "true";
    const isModal = view === "modal";
    const modalQuery = isModal ? "&view=modal" : "";

    return (
        <main className={`authPage ${isModal ? "authModalPage" : ""}`}>
            {isModal ? <AuthBackdrop /> : null}

            <nav className="authNav" aria-label="Authentication navigation">
                <Link href="/">{siteConfig.name}</Link>
                <div>
                    <Link href="/">Home</Link>
                    <Link href="/templates">Templates</Link>
                </div>
            </nav>

            <section className="authPanel">
                <div className="authPanelTop">
                    <span>Google account</span>
                    <span>Secure sign up</span>
                </div>

                <div className="authCopy">
                    <p className="eyebrow">Start building</p>
                    <h1>Create account</h1>
                    <p>Use Google to create your Viliqu account, save invitations, collect RSVPs, and publish faster.</p>
                </div>

                {error ? <div className="authError">{error}</div> : null}

                <form action={signInWithGoogle}>
                    <input type="hidden" name="next" value={next} />
                    <input type="hidden" name="authPage" value="signup" />
                    <input type="hidden" name="view" value={view || ""} />
                    <button className="oauthButton" type="submit" disabled={!googleEnabled}>
                        <span className="googleMark" aria-hidden="true">G</span>
                        Sign up with Google
                    </button>
                </form>
                {!googleEnabled ? <p className="authHint">Google login needs OAuth credentials in Supabase first.</p> : null}

                <p className="authSwitch">
                    Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}${modalQuery}`}>Log in with Google</Link>
                </p>

                <div className="authQuickLinks" aria-label="Quick links">
                    <Link href="/templates">Browse templates</Link>
                    <Link href="/">Back home</Link>
                </div>
            </section>
        </main>
    );
}

function AuthBackdrop() {
    return (
        <div className="authModalBackdrop" aria-hidden="true">
            <div className="authMockTopbar">
                <span />
                <span />
            </div>
            <div className="authMockHero">
                <div>
                    <i />
                    <strong />
                    <span />
                </div>
                <div>
                    <i />
                    <strong />
                    <span />
                </div>
            </div>
            <div className="authMockCards">
                <span />
                <span />
                <span />
            </div>
        </div>
    );
}
