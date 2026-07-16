"use client";

import { useEffect, useState, type ReactNode } from "react";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import { createClient } from "@/lib/supabase/client";

type AuthState = "checking" | "authed" | "guest";

type Props = {
    children: ReactNode;
    next: string;
    className?: string;
};

export default function ProtectedRoute({ children, next, className }: Props) {
    const [authState, setAuthState] = useState<AuthState>("checking");
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
        return <main className={shellClassName} aria-hidden="true" />;
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
