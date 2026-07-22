"use client";

import {
    Eye,
    Loader2,
    PencilLine,
    Rocket,
} from "lucide-react";

type BuilderBottomBarProps = {
    isPreviewing: boolean;
    isPublishing: boolean;
    isPublishedEdit: boolean;
    isPublishDisabled: boolean;
    onEdit: () => void;
    onPreview: () => void;
    onPublish: () => void;
};

export default function BuilderBottomBar({
    isPreviewing,
    isPublishing,
    isPublishedEdit,
    isPublishDisabled,
    onEdit,
    onPreview,
    onPublish,
}: BuilderBottomBarProps) {
    const previewDisabled =
        isPreviewing || isPublishing;

    const publishDisabled =
        isPreviewing ||
        isPublishing ||
        isPublishDisabled;

    const publishLabel = isPublishing
        ? isPublishedEdit
            ? "Updating..."
            : "Publishing..."
        : isPublishedEdit
            ? "Update"
            : "Publish";

    return (
        <div className="builderBottomBar">
            <button
                type="button"
                onClick={onEdit}
            >
                <PencilLine
                    size={17}
                    aria-hidden="true"
                />

                <span>Edit Content</span>
            </button>

            <button
                type="button"
                onClick={onPreview}
                disabled={previewDisabled}
            >
                {isPreviewing ? (
                    <Loader2
                        size={17}
                        className="spinner"
                        aria-hidden="true"
                    />
                ) : (
                    <Eye
                        size={17}
                        aria-hidden="true"
                    />
                )}

                <span>Preview</span>
            </button>

            <button
                type="button"
                onClick={onPublish}
                disabled={publishDisabled}
            >
                {isPublishing ? (
                    <Loader2
                        size={17}
                        className="spinner"
                        aria-hidden="true"
                    />
                ) : (
                    <Rocket
                        size={17}
                        aria-hidden="true"
                    />
                )}

                <span>{publishLabel}</span>
            </button>
        </div>
    );
}