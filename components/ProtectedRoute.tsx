"use client";

import { useEffect, useState, type ReactNode } from "react";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import { createClient } from "@/lib/supabase/client";

type AuthState = "checking" | "authed" | "guest";

type Props = {
    children: ReactNode;
    next: string;
    className?: string;
    fallback?: ReactNode;
};

function hasAuthCookie(): boolean {
    if (typeof document === "undefined") return false;
    const cookies = document.cookie;
    if (!cookies) return false;
    return cookies.split(";").some((c) => {
        const key = c.trim().split("=")[0];
        return key.startsWith("sb-") || key.includes("auth-token") || key.includes("access_token");
    });
}

function getInitialAuthState(): AuthState {
    if (typeof window === "undefined") {
        return "checking";
    }
    return hasAuthCookie() ? "checking" : "guest";
}

export default function ProtectedRoute({ children, next, className, fallback }: Props) {
    const [authState, setAuthState] = useState<AuthState>(getInitialAuthState);
    const shellClassName = ["protectedRouteShell", className].filter(Boolean).join(" ");

    useEffect(() => {
        let active = true;
        const supabase = createClient();

        supabase.auth
            .getSession()
            .then(({ data: { session } }) => {
                if (active) setAuthState(session ? "authed" : "guest");
            })
            .catch(() => {
                if (active) setAuthState("guest");
            });

        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (active) setAuthState(session ? "authed" : "guest");
        });

        return () => {
            active = false;
            listener.subscription.unsubscribe();
        };
    }, []);

    if (authState === "checking") {
        return fallback || <main className={shellClassName} aria-hidden="true" />;
    }

    if (authState === "guest") {
        return (
            <main className={shellClassName}>
                <AuthRequiredModal next={next} forceOpen />
            </main>
        );
    }

    return children;
}
