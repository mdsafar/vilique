"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, PencilLine, Send, ShieldCheck, Sparkles } from "lucide-react";
import { signInWithGoogle } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/client";

type Props = {
    next: string;
};

export default function AuthRequiredModal({ next }: Props) {
    const router = useRouter();
    const [status, setStatus] = useState<"checking" | "authed" | "guest">("checking");

    useEffect(() => {
        let active = true;
        const supabase = createClient();

        supabase.auth
            .getUser()
            .then(({ data: { user } }) => {
                if (active) {
                    setStatus(user ? "authed" : "guest");
                }
            })
            .catch(() => {
                if (active) {
                    setStatus("guest");
                }
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (status !== "guest") return;

        const scrollY = window.scrollY;
        const previousBodyOverflow = document.body.style.overflow;
        const previousBodyPosition = document.body.style.position;
        const previousBodyTop = document.body.style.top;
        const previousBodyWidth = document.body.style.width;
        const previousHtmlOverflow = document.documentElement.style.overflow;

        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = "100%";

        return () => {
            document.documentElement.style.overflow = previousHtmlOverflow;
            document.body.style.overflow = previousBodyOverflow;
            document.body.style.position = previousBodyPosition;
            document.body.style.top = previousBodyTop;
            document.body.style.width = previousBodyWidth;
            window.scrollTo(0, scrollY);
        };
    }, [status]);

    if (status !== "guest") return null;

    const authBenefits = [
        {
            description: "View and manage your drafts",
            icon: FileText,
            title: "Drafts",
        },
        {
            description: "Create beautiful invitations",
            icon: PencilLine,
            title: "Builder",
        },
        {
            description: "Publish and share your websites",
            icon: Send,
            title: "Publishing",
        },
    ];

    function leaveProtectedPage() {
        if (window.history.length > 1) {
            router.back();
            return;
        }

        router.push("/");
    }

    return (
        <div
            className="authInlineOverlay"
            role="dialog"
            aria-modal="true"
            aria-label="Authentication required"
        >
            <div className="authInlineBackdrop" aria-hidden="true" />

            <section className="authPanel authInlinePanel">
                <div className="authModalGlow" aria-hidden="true" />
                <button
                    aria-label="Go back"
                    className="authCloseButton"
                    onClick={leaveProtectedPage}
                    type="button"
                >
                    ×
                </button>

                <div className="authPanelTop">
                    <span>
                        <i className="authGoogleIcon" aria-hidden="true">G</i>
                        Google account
                    </span>
                    <span>
                        <ShieldCheck size={18} aria-hidden="true" />
                        Secure sign in
                    </span>
                </div>

                <div className="authCopy">
                    <p className="eyebrow">
                        <span aria-hidden="true">
                            <Sparkles size={18} />
                        </span>
                        Welcome
                    </p>
                    <h1>Sign in</h1>
                    <p>
                        Continue with Google to unlock this page, edit drafts, and publish
                        invitation websites.
                    </p>
                </div>

                <div className="authBenefitGrid" aria-label="Account access includes">
                    {authBenefits.map(({ description, icon: Icon, title }) => (
                        <article key={title}>
                            <span>
                                <Icon size={22} aria-hidden="true" />
                            </span>
                            <strong>{title}</strong>
                            <p>{description}</p>
                        </article>
                    ))}
                </div>

                <form action={signInWithGoogle}>
                    <input type="hidden" name="next" value={next} />
                    <button className="oauthButton" type="submit">
                        <span className="googleMark" aria-hidden="true">G</span>
                        Continue with Google
                    </button>
                </form>
            </section>
        </div>
    );
}
