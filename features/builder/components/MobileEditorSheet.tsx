"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import {
    useEffect,
    useRef,
} from "react";

import EditorForm from "@/features/builder/components/EditorForm";
import EditorTabs from "@/features/builder/components/EditorTabs";
import type {
    BuilderUpdateSource,
    EditorTab,
} from "@/features/builder/types";
import type {
    BuilderValidationErrors,
} from "@/features/invitations/validation";
import type {
    InvitationData,
} from "@/types/invitation";

type MobileEditorSheetProps = {
    isOpen: boolean;
    activeTab: EditorTab;
    invitation: InvitationData;
    errors: BuilderValidationErrors;
    isUploadingMusic: boolean;
    isReadOnly: boolean;

    setActiveTab: (
        tab: EditorTab,
    ) => void;

    updateField: (
        key: string,
        value: string,
        source?: BuilderUpdateSource,
    ) => void;

    updateTheme: (
        key: keyof InvitationData["theme"],
        value: InvitationData["theme"][
            keyof InvitationData["theme"]
        ],
    ) => void;

    updateMusicFile: (
        file: File | null,
    ) => void;

    onClose: () => void;
};

export default function MobileEditorSheet({
    isOpen,
    activeTab,
    invitation,
    errors,
    isUploadingMusic,
    isReadOnly,
    setActiveTab,
    updateField,
    updateTheme,
    updateMusicFile,
    onClose,
}: MobileEditorSheetProps) {
    const sheetRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const body = document.body;
        const root = document.documentElement;
        const previousBodyOverflow = body.style.overflow;
        const previousBodyOverscrollBehavior = body.style.overscrollBehavior;
        const previousRootOverflow = root.style.overflow;
        const previousRootOverscrollBehavior = root.style.overscrollBehavior;

        body.style.overflow = "hidden";
        body.style.overscrollBehavior = "none";
        root.style.overflow = "hidden";
        root.style.overscrollBehavior = "none";

        const sheet = sheetRef.current;
        const visualViewport = window.visualViewport;
        let animationFrame = 0;

        const updateVisibleViewport = () => {
            cancelAnimationFrame(animationFrame);
            animationFrame = requestAnimationFrame(() => {
                if (!sheet || !visualViewport) return;

                const viewportHeight = Math.max(
                    0,
                    visualViewport.height,
                );
                const viewportBottom =
                    Math.max(0, visualViewport.offsetTop)
                    + viewportHeight;

                sheet.style.setProperty(
                    "--mobile-sheet-visible-height",
                    `${viewportHeight}px`,
                );
                sheet.style.setProperty(
                    "--mobile-sheet-viewport-bottom",
                    `${viewportBottom}px`,
                );
            });
        };

        if (visualViewport) {
            updateVisibleViewport();
            visualViewport.addEventListener(
                "resize",
                updateVisibleViewport,
                { passive: true },
            );
            visualViewport.addEventListener(
                "scroll",
                updateVisibleViewport,
                { passive: true },
            );
        }

        return () => {
            cancelAnimationFrame(animationFrame);
            visualViewport?.removeEventListener(
                "resize",
                updateVisibleViewport,
            );
            visualViewport?.removeEventListener(
                "scroll",
                updateVisibleViewport,
            );

            sheet?.style.removeProperty(
                "--mobile-sheet-visible-height",
            );
            sheet?.style.removeProperty(
                "--mobile-sheet-viewport-bottom",
            );

            body.style.overflow = previousBodyOverflow;
            body.style.overscrollBehavior =
                previousBodyOverscrollBehavior;
            root.style.overflow = previousRootOverflow;
            root.style.overscrollBehavior =
                previousRootOverscrollBehavior;
        };
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.button
                        key="mobile-scrim"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: "linear" }}
                        className="mobileSheetScrim active"
                        type="button"
                        aria-label="Close editor"
                        onClick={onClose}
                    />

                    <motion.section
                        ref={sheetRef}
                        key="mobile-sheet"
                        initial={{ y: "100%" }}
                        animate={{ y: "0%" }}
                        exit={{ y: "100%" }}
                        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                        className="mobileBuilderSheet active"
                        aria-label="Invitation editor"
                    >
                        <div className="sheetHandle" />

                        <div className="mobileSheetHeader">
                            <div>
                                <p>Edit invitation</p>
                                <h2>{activeTab}</h2>
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close editor"
                            >
                                <X
                                    size={18}
                                    aria-hidden="true"
                                />
                            </button>
                        </div>

                        <EditorTabs
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />

                        <div className={`builderReadOnlyFieldset${isReadOnly ? " isReadOnly" : ""}`} aria-label={isReadOnly ? "Invitation editor is view only" : undefined}>
                            <EditorForm
                                activeTab={activeTab}
                                invitation={invitation}
                                errors={errors}
                                updateField={updateField}
                                updateTheme={updateTheme}
                                updateMusicFile={updateMusicFile}
                                isUploadingMusic={isUploadingMusic}
                                isReadOnly={isReadOnly}
                            />
                        </div>
                    </motion.section>
                </>
            )}
        </AnimatePresence>
    );
}
