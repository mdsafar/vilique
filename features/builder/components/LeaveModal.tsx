"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertTriangle,
    Loader2,
    Save
} from "lucide-react";

import type { BuilderMode } from "@/features/builder/types";

function LeaveModal({
    isOpen,
    mode,
    saving,
    onSave,
    onDiscard,
    onCancel,
}: {
    isOpen: boolean;
    mode: BuilderMode;
    saving: boolean;
    onSave: () => Promise<boolean | void>;
    onDiscard: () => Promise<void> | void;
    onCancel: () => void;
}) {
    const [discarding, setDiscarding] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

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
    }, [isOpen]);

    if (typeof document === "undefined") return null;

    async function handleDiscardConfirm() {
        setDiscarding(true);
        try {
            await onDiscard();
        } catch (error) {
            console.error("Discard failed", error);
            setDiscarding(false);
        }
    }

    const isNewMode = mode === "new";
    const isDraftEditMode = mode === "draft-edit";

    const modalTitle = isNewMode
        ? "Save draft before leaving?"
        : "Save changes before leaving?";

    const modalDescription = isNewMode
        ? "Your invitation has unsaved changes. Would you like to save your draft before going back?"
        : isDraftEditMode
            ? "Your draft has unsaved changes. Would you like to save your changes before going back?"
            : "Your live invitation has unsaved changes. Save changes or keep editing.";

    const saveButtonText = isNewMode
        ? "Save Draft & Back"
        : "Save Changes & Back";

    const discardButtonText = "Discard"

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div
                    className="modalOverlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Save changes"
                >
                    <motion.div
                        className="modalBackdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => { if (!saving && !discarding) onCancel(); }}
                    />

                    <motion.section
                        initial={{ opacity: 0, scale: 0.94, y: 18 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 18 }}
                        transition={{ type: "spring", stiffness: 320, damping: 28 }}
                        style={{
                            position: "relative",
                            zIndex: 1,
                            width: "min(100%, 390px)",
                            background: "#ffffff",
                            border: "1px solid rgba(23,23,23,0.08)",
                            borderRadius: "24px",
                            padding: "28px 24px 24px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "14px",
                            textAlign: "center",
                            boxShadow: "0 24px 60px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.9)",
                        }}
                    >
                        <div style={{
                            width: "52px",
                            height: "52px",
                            borderRadius: "16px",
                            background: "rgba(251,191,36,0.1)",
                            border: "1px solid rgba(251,191,36,0.3)",
                            display: "grid",
                            placeItems: "center",
                            color: "#d97706",
                        }}>
                            <AlertTriangle size={24} strokeWidth={2} />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <h2 style={{
                                margin: 0,
                                fontSize: "18px",
                                fontWeight: 800,
                                color: "#111827",
                                fontFamily: "Arial, Helvetica, sans-serif",
                                letterSpacing: "-0.02em",
                            }}>
                                {modalTitle}
                            </h2>
                            <p style={{
                                margin: 0,
                                fontSize: "13px",
                                color: "#6b7280",
                                lineHeight: 1.5,
                            }}>
                                {modalDescription}
                            </p>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", marginTop: "4px" }}>
                            <button
                                type="button"
                                onClick={() => {
                                    void onSave();
                                }}
                                disabled={saving || discarding}
                                style={{
                                    width: "100%",
                                    minHeight: "46px",
                                    borderRadius: "14px",
                                    border: "none",
                                    background: (saving || discarding)
                                        ? "#e5e7eb"
                                        : "linear-gradient(135deg, #8c4cf3 0%, #c46fb4 100%)",
                                    color: (saving || discarding) ? "#9ca3af" : "#fff",
                                    fontWeight: 800,
                                    fontSize: "14px",
                                    cursor: (saving || discarding) ? "not-allowed" : "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "8px",
                                    transition: "all 0.2s",
                                    boxShadow: (saving || discarding) ? "none" : "0 4px 16px rgba(140, 76, 243, 0.3)",
                                }}
                            >
                                {saving ? <Loader2 size={15} className="spinner" /> : <Save size={15} />}
                                {saving ? "Saving…" : saveButtonText}
                            </button>

                            <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                                <button
                                    type="button"
                                    onClick={handleDiscardConfirm}
                                    disabled={saving || discarding}
                                    style={{
                                        flex: 1,
                                        minHeight: "42px",
                                        borderRadius: "12px",
                                        background: "#fef2f2",
                                        border: "1.5px solid rgba(239,68,68,0.2)",
                                        color: "#dc2626",
                                        fontWeight: 700,
                                        fontSize: "13.5px",
                                        cursor: (saving || discarding) ? "not-allowed" : "pointer",
                                        opacity: (saving || discarding) ? 0.7 : 1,
                                        transition: "all 0.2s",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "6px",
                                    }}
                                >
                                    {discarding ? <Loader2 size={14} className="spinner" /> : null}
                                    <span>{discarding ? "Discarding…" : discardButtonText}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    disabled={saving || discarding}
                                    style={{
                                        flex: 1,
                                        minHeight: "42px",
                                        borderRadius: "12px",
                                        background: "#f9fafb",
                                        border: "1.5px solid #e5e7eb",
                                        color: "#6b7280",
                                        fontWeight: 700,
                                        fontSize: "13.5px",
                                        cursor: (saving || discarding) ? "not-allowed" : "pointer",
                                        opacity: (saving || discarding) ? 0.7 : 1,
                                        transition: "all 0.2s",
                                    }}
                                >
                                    Continue Editing
                                </button>
                            </div>
                        </div>
                    </motion.section>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}

export default LeaveModal;