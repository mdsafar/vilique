"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isPending?: boolean;
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    confirmStyle?: React.CSSProperties;
    icon?: React.ReactNode;
};

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    isPending = false,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    confirmStyle,
    icon,
}: Props) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Prevent background scrolling when open
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

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div
                    className="modalOverlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label={title}
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
                    >
                        <div className="modalHeader">
                            {icon}
                            <h2>{title}</h2>
                        </div>
                        
                        <div className="modalMessage">
                            {message}
                        </div>

                        <div className="modalActions">
                            <button
                                type="button"
                                className="modalBtnCancel"
                                onClick={onClose}
                                disabled={isPending}
                            >
                                {cancelText}
                            </button>
                            <button
                                type="button"
                                className="modalBtnConfirm"
                                onClick={onConfirm}
                                disabled={isPending}
                                style={confirmStyle}
                            >
                                {isPending ? `${confirmText}…` : confirmText}
                            </button>
                        </div>
                    </motion.section>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
