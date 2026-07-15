"use client";

import { useEffect } from "react";

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
            <section className="listState listState--error" aria-labelledby="app-error-title" role="alert">
                <span className="listStateIcon" aria-hidden="true">
                    !
                </span>
                <h2 id="app-error-title">Something went wrong</h2>
                <p>Something went wrong while loading this page. Please retry, or return to your invitations.</p>
                {error.digest ? (
                    <div className="listStateDetails" aria-label="Error reference">
                        <span>Reference: {error.digest}</span>
                    </div>
                ) : null}
                <div className="listStateActions">
                    <button className="listStateAction" type="button" onClick={unstable_retry}>
                        Try again
                    </button>
                    <a className="listStateAction listStateAction--secondary" href="/invitations">
                        Back to invitations
                    </a>
                </div>
            </section>
        </main>
    );
}
