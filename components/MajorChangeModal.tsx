"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Copy, ArrowLeft, LifeBuoy, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";

type Props = {
    isOpen: boolean;
    error: string;
    invitationId: string;
    onClose: () => void;
};

export default function MajorChangeModal({
    isOpen,
    error,
    invitationId,
    onClose,
}: Props) {
    const router = useRouter();
    const { showToast } = useToast();
    const [isPending, setIsPending] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

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

    async function handleDuplicate() {
        setIsPending(true);
        try {
            const res = await fetch(`/api/invitations/${invitationId}/duplicate`, {
                method: "POST"
            });
            if (!res.ok) throw new Error("Duplication failed");
            const data = await res.json();
            showToast("Invitation duplicated successfully!", "success");
            
            // Redirect to the new draft editor
            router.push(`/builder?id=${data.id}`);
            onClose();
        } catch {
            showToast("Failed to duplicate invitation", "error");
        } finally {
            setIsPending(false);
        }
    }

    if (typeof document === "undefined") return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div
                    className="modalOverlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Different Event Warning"
                >
                    <motion.div
                        className="modalBackdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    <motion.section
                        className="modalPanel"
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", duration: 0.35 }}
                        style={{ maxWidth: "480px" }}
                    >
                        <div className="modalHeader" style={{ color: "#e11d48" }}>
                            <span className="modalWarningIcon" style={{ color: "#e11d48", background: "rgba(225, 29, 72, 0.1)" }}>
                                <AlertTriangle size={24} />
                            </span>
                            <h2>This looks like a different event</h2>
                        </div>

                        <div className="modalMessage">
                            <p style={{ margin: "0 0 12px 0", color: "#475569", lineHeight: "1.5" }}>
                                {error || "Your current purchase covers the original event. Creating a new invitation for another event requires a new publication purchase."}
                            </p>
                            <p style={{ margin: "0", color: "#64748b", fontSize: "0.85rem" }}>
                                To update names, dates, or categories of paid templates for a new event, please duplicate this invitation.
                            </p>
                        </div>

                        <div className="modalActions" style={{ flexDirection: "column", gap: "8px" }}>
                            <button
                                type="button"
                                className="modalBtnConfirm"
                                onClick={handleDuplicate}
                                disabled={isPending}
                                style={{
                                    width: "100%",
                                    background: "#e11d48",
                                    color: "#fff",
                                    boxShadow: "0 4px 12px rgba(225, 29, 72, 0.2)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "8px",
                                    height: "42px",
                                }}
                            >
                                {isPending ? <Loader2 size={16} className="spinner" /> : <Copy size={16} />}
                                <span>{isPending ? "Duplicating..." : "Duplicate as New Invitation"}</span>
                            </button>

                            <button
                                type="button"
                                className="modalBtnCancel"
                                onClick={onClose}
                                disabled={isPending}
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "8px",
                                    height: "42px",
                                    background: "#f1f5f9",
                                    color: "#475569",
                                    border: "1px solid #cbd5e1",
                                }}
                            >
                                <ArrowLeft size={16} />
                                <span>Keep Editing Original (Revert)</span>
                            </button>

                            <a
                                href="mailto:tanjirookamaadoo@gmail.com"
                                className="modalBtnCancel"
                                style={{
                                    width: "100%",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "8px",
                                    height: "42px",
                                    background: "transparent",
                                    color: "#64748b",
                                    border: "1px solid transparent",
                                    textDecoration: "none",
                                }}
                            >
                                <LifeBuoy size={16} />
                                <span>Contact Support</span>
                            </a>
                        </div>
                    </motion.section>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
