"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type PickerModalProps = {
    title: string;
    variant: "date" | "time";
    children: ReactNode;
    onClose: () => void;
};

export default function PickerModal({
    title,
    variant,
    children,
    onClose,
}: PickerModalProps) {
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose();
            }
        }

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener(
                "keydown",
                handleKeyDown,
            );
        };
    }, [onClose]);

    if (typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <div
            className="customPickerSheetOverlay"
            role="presentation"
            onMouseDown={onClose}
        >
            <section
                className={`customPickerSheet customPickerSheet--${variant}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onMouseDown={(event) => {
                    event.stopPropagation();
                }}
            >
                <div
                    className="customPickerSheetHandle"
                    aria-hidden="true"
                />

                <div className="customPickerSheetHeader">
                    <strong>{title}</strong>

                    <button
                        className="customPickerSheetClose"
                        type="button"
                        onClick={onClose}
                        aria-label="Close picker"
                    >
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>

                {children}
            </section>
        </div>,
        document.body,
    );
}