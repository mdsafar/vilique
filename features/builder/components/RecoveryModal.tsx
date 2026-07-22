"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
    AnimatePresence,
    motion,
} from "framer-motion";
import {
    Clock,
    Loader2,
    RotateCcw,
    Trash2,
} from "lucide-react";
import { formatSavedTime } from "@/features/builder/lib/builderTimeUtils";

type RecoveryModalProps = {
    timestamp?: string | number | Date | null;
    onContinueEditing: () => Promise<void> | void;
    onDiscard: () => Promise<void> | void;
};

type RecoveryAction =
    | "continue"
    | "discard"
    | null;

export default function RecoveryModal({
    timestamp,
    onContinueEditing,
    onDiscard,
}: RecoveryModalProps) {
    const [activeAction, setActiveAction] = useState<RecoveryAction>(null);

    const isResolving = activeAction !== null;

    useEffect(() => {
        const scrollY = window.scrollY;
        const previousBodyOverflow = document.body.style.overflow;
        const previousBodyPosition = document.body.style.position;
        const previousBodyTop = document.body.style.top;
        const previousBodyWidth = document.body.style.width;

        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = "100%";

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.body.style.position = previousBodyPosition;
            document.body.style.top = previousBodyTop;
            document.body.style.width = previousBodyWidth;
            window.scrollTo(0, scrollY);
        };
    }, []);

    async function handleContinue() {
        if (isResolving) return;
        setActiveAction("continue");
        try {
            await onContinueEditing();
        } catch (error) {
            console.error("Draft recovery failed", error);
            setActiveAction(null);
        }
    }

    async function handleDiscard() {
        if (isResolving) return;
        setActiveAction("discard");
        try {
            await onDiscard();
        } catch (error) {
            console.error("Discard failed", error);
            setActiveAction(null);
        }
    }

    if (typeof document === "undefined") return null;

    const formattedTime = formatSavedTime(timestamp);

    return createPortal(
        <AnimatePresence>
            <div
                className="modalOverlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby="recovery-modal-title"
                aria-describedby="recovery-modal-description"
                style={{ padding: "16px" }}
            >
                <motion.div
                    className="modalBackdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(30, 18, 42, 0.4)",
                        backdropFilter: "blur(14px)",
                        WebkitBackdropFilter: "blur(14px)",
                    }}
                />

                <motion.section
                    className="recoveryModalSection"
                    initial={{
                        opacity: 0,
                        scale: 0.94,
                        y: 18,
                    }}
                    animate={{
                        opacity: 1,
                        scale: 1,
                        y: 0,
                    }}
                    exit={{
                        opacity: 0,
                        scale: 0.94,
                        y: 18,
                    }}
                    transition={{
                        type: "spring",
                        stiffness: 320,
                        damping: 28,
                    }}
                    style={{
                        position: "relative",
                        zIndex: 1,
                        width: "100%",
                        maxWidth: "390px",
                        background: "#ffffff",
                        border: "1px solid rgba(23,23,23,0.08)",
                        borderRadius: "22px",
                        padding: "24px 20px 20px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px",
                        textAlign: "center",
                        boxShadow: "0 24px 60px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.9)",
                    }}
                >
                    <div className="recoveryModalIconBadge" style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "15px",
                        background: "rgba(124, 58, 237, 0.1)",
                        border: "1px solid rgba(124, 58, 237, 0.25)",
                        display: "grid",
                        placeItems: "center",
                        color: "#7c3aed",
                    }}>
                        <RotateCcw
                            size={22}
                            strokeWidth={2}
                            aria-hidden="true"
                        />
                    </div>

                    <div className="recoveryModalTextGroup" style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                        <h2 id="recovery-modal-title" style={{ margin: 0, fontSize: "17.5px", fontWeight: 800, color: "#111827" }}>
                            Continue your draft?
                        </h2>

                        <p id="recovery-modal-description" style={{ margin: 0, fontSize: "12.5px", color: "#6b7280", lineHeight: 1.45 }}>
                            We found an invitation draft from your previous session.
                        </p>

                        <div style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "3px 9px",
                            borderRadius: "8px",
                            background: "rgba(124, 58, 237, 0.07)",
                            border: "1px solid rgba(124, 58, 237, 0.16)",
                            color: "#7c3aed",
                            fontSize: "11.5px",
                            fontWeight: 650,
                            width: "fit-content",
                            margin: "6px auto 0 auto",
                        }}>
                            <Clock size={12} />
                            <span>{formattedTime}</span>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", width: "100%", marginTop: "4px" }}>
                        <button
                            type="button"
                            onClick={() => { void handleContinue(); }}
                            disabled={isResolving}
                            style={{
                                flex: 1.2,
                                minHeight: "40px",
                                borderRadius: "11px",
                                border: "none",
                                background: activeAction === "continue" ? "#e5e7eb" : "linear-gradient(135deg, #8c4cf3 0%, #6e2bd9 100%)",
                                color: activeAction === "continue" ? "#9ca3af" : "#fff",
                                fontWeight: 800,
                                fontSize: "13px",
                                cursor: isResolving ? "not-allowed" : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                                boxShadow: activeAction === "continue" ? "none" : "0 3.5px 12px rgba(140, 76, 243, 0.28)",
                            }}
                        >
                            {activeAction === "continue" ? (
                                <Loader2 size={14} className="spinner" />
                            ) : (
                                <RotateCcw size={14} />
                            )}
                            <span>{activeAction === "continue" ? "Loading…" : "Continue Editing"}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => { void handleDiscard(); }}
                            disabled={isResolving}
                            style={{
                                flex: 1,
                                minHeight: "40px",
                                borderRadius: "11px",
                                background: "#fef2f2",
                                border: "1.5px solid rgba(239,68,68,0.2)",
                                color: "#dc2626",
                                fontWeight: 700,
                                fontSize: "12.5px",
                                cursor: isResolving ? "not-allowed" : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "5px",
                            }}
                        >
                            {activeAction === "discard" ? (
                                <Loader2 size={13} className="spinner" />
                            ) : (
                                <Trash2 size={13} />
                            )}
                            <span>{activeAction === "discard" ? "Discarding…" : "Discard"}</span>
                        </button>
                    </div>
                </motion.section>
            </div>
        </AnimatePresence>,
        document.body
    );
}