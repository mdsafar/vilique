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

function isSigningOut(): boolean {
    if (typeof window === "undefined") return false;
    return Boolean((window as unknown as { __isSigningOut?: boolean }).__isSigningOut);
}

export default function ProtectedRoute({ children, next, className, fallback }: Props) {
    const [authState, setAuthState] = useState<AuthState>("checking");
    const shellClassName = ["protectedRouteShell", className].filter(Boolean).join(" ");

    useEffect(() => {
        let active = true;

        queueMicrotask(() => {
            if (active && !hasAuthCookie() && !isSigningOut()) {
                setAuthState("guest");
            }
        });

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
        if (isSigningOut()) {
            return fallback || <main className={shellClassName} aria-hidden="true" />;
        }
        return (
            <main className={shellClassName}>
                <AuthRequiredModal next={next} forceOpen />
            </main>
        );
    }

    return children;
}
