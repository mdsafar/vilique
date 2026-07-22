"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

type Props = {
    lost: boolean;
    viewOnlyBusy: boolean;
    takeOverBusy: boolean;
    onRefresh: () => void;
    onTakeOver: () => void;
};

export default function BuilderLockBanner({
    lost,
    viewOnlyBusy,
    takeOverBusy,
    onRefresh,
    onTakeOver,
}: Props) {
    const dialogRef = useRef<HTMLElement>(null);
    const busy = viewOnlyBusy || takeOverBusy;

    useEffect(() => {
        const scrollY = window.scrollY;
        const previous = {
            bodyOverflow: document.body.style.overflow,
            bodyPosition: document.body.style.position,
            bodyTop: document.body.style.top,
            bodyWidth: document.body.style.width,
            htmlOverflow: document.documentElement.style.overflow,
        };

        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = "100%";

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                return;
            }
            if (event.key !== "Tab") return;
            const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") || []);
            if (buttons.length === 0) {
                event.preventDefault();
                return;
            }
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.documentElement.style.overflow = previous.htmlOverflow;
            document.body.style.overflow = previous.bodyOverflow;
            document.body.style.position = previous.bodyPosition;
            document.body.style.top = previous.bodyTop;
            document.body.style.width = previous.bodyWidth;
            window.scrollTo(0, scrollY);
        };
    }, []);

    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="builderLockOverlay">
            <section ref={dialogRef} className="builderLockBanner" role="alertdialog" aria-modal="true" aria-live="assertive" aria-labelledby="builder-lock-title" aria-describedby="builder-lock-description">
                <div className="builderLockMessage">
                    <strong id="builder-lock-title">{lost ? "Editing was moved to another tab or device." : "This invitation is being edited in another tab or device."}</strong>
                    <span id="builder-lock-description">You can continue in view-only mode or take over editing here.</span>
                </div>
                <div className="builderLockActions">
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={busy}
                        aria-busy={viewOnlyBusy}
                        autoFocus
                    >
                        {viewOnlyBusy && <Loader2 size={15} className="spinner" aria-hidden="true" />}
                        <span>{viewOnlyBusy ? "Loading view…" : lost ? "View latest version" : "View only"}</span>
                    </button>
                    <button
                        type="button"
                        onClick={onTakeOver}
                        disabled={busy}
                        aria-busy={takeOverBusy}
                    >
                        {takeOverBusy && <Loader2 size={15} className="spinner" aria-hidden="true" />}
                        <span>{takeOverBusy ? "Taking over…" : "Take over editing"}</span>
                    </button>
                </div>
            </section>
        </div>,
        document.body,
    );
}
