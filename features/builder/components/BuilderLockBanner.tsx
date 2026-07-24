"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2, LockKeyhole } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
    isOpen: boolean;
    lost: boolean;
    takeOverBusy: boolean;
    onTakeOver: () => void;
    onClose: () => void;
};

export default function BuilderLockBanner({
    isOpen,
    lost,
    takeOverBusy,
    onTakeOver,
    onClose,
}: Props) {
    const dialogRef = useRef<HTMLElement>(null);
    const busy = takeOverBusy;

    useEffect(() => {
        if (!isOpen) return;

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
    }, [isOpen]);

    if (typeof document === "undefined") return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div
                    className="modalOverlay"
                    role="alertdialog"
                    aria-modal="true"
                    aria-describedby="builder-lock-description"
                    aria-labelledby="builder-lock-title"
                >
                    <motion.div
                        className="modalBackdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    <motion.section
                        ref={dialogRef}
                        className="modalPanel"
                        style={{ maxWidth: "440px" }}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", duration: 0.35 }}
                    >
                        <div className="modalHeader">
                            <span
                                className="modalWarningIcon"
                                style={{
                                    color: "#7e5bd5",
                                    background: "rgba(245, 243, 255, 0.9)",
                                    boxShadow: "0 4px 12px rgba(126, 91, 213, 0.1)",
                                }}
                            >
                                <LockKeyhole size={24} />
                            </span>
                            <h2 id="builder-lock-title">
                                {lost
                                    ? "Editing was moved to another tab or device."
                                    : "This invitation is being edited in another tab or device."}
                            </h2>
                        </div>

                        <div id="builder-lock-description" className="modalMessage">
                            You can continue in view-only mode or take over editing here.
                        </div>

                        <div className="modalActions">
                            <button
                                type="button"
                                className="modalBtnCancel"
                                onClick={onClose}
                                disabled={busy}
                                autoFocus
                            >
                                <span>{lost ? "Close" : "Back"}</span>
                            </button>
                            <button
                                type="button"
                                className="modalBtnConfirm modalBtnConfirm--purple-pastel"
                                onClick={onTakeOver}
                                disabled={busy}
                            >
                                {takeOverBusy && <Loader2 size={15} className="spinner" aria-hidden="true" />}
                                <span>{takeOverBusy ? "Taking over…" : "Take over editing"}</span>
                            </button>
                        </div>
                    </motion.section>
                </div>
            )}
        </AnimatePresence>,
        document.body,
    );
}
