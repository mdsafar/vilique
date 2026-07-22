"use client";

import { PencilLine } from "lucide-react";

type MobileEditorTriggerProps = {
    hidden: boolean;
    onClick: () => void;
};

export default function MobileEditorTrigger({
    hidden,
    onClick,
}: MobileEditorTriggerProps) {
    return (
        <button
            className={`mobileEditorTrigger ${hidden ? "hidden" : ""
                }`}
            type="button"
            onClick={onClick}
            aria-label="Open invitation editor"
            aria-hidden={hidden}
            tabIndex={hidden ? -1 : 0}
        >
            <PencilLine
                size={17}
                aria-hidden="true"
            />

            <span>Edit</span>
        </button>
    );
}