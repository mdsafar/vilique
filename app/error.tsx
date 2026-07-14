"use client";

import { useEffect } from "react";
import Link from "next/link";
import ListState from "@/components/ListState";

export default function AppError({
    error,
    unstable_retry,
}: {
    error: Error & { digest?: string };
    unstable_retry: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <main className="notFoundPage">
            <ListState
                actionLabel="Try again"
                description="Something went wrong while loading this page. Please retry, or return to your invitations."
                onAction={unstable_retry}
                title="Something went wrong"
                variant="error"
            />
            <Link className="notFoundSecondaryLink" href="/invitations">
                Back to invitations
            </Link>
        </main>
    );
}
