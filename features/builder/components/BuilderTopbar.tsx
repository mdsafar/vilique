"use client";

import {
    AlertCircle,
    ArrowLeft,
    Check,
    CloudOff,
    Eye,
    Loader2,
    LockKeyhole,
    Rocket,
} from "lucide-react";
import type { SaveStatus } from "@/features/builder/types";
import { useLineLoader } from "@/components/TopLineLoader";

type BuilderTopbarProps = {
    title: string;
    saveStatusLabel: string;
    saveStatus?: SaveStatus;
    isPreviewing: boolean;
    isPublishing: boolean;
    isPublishedEdit: boolean;
    isPublishDisabled: boolean;
    onBack: () => void;
    onPreview: () => void;
    onPublish: () => void;
};

function renderStatusIcon(status?: SaveStatus) {
    switch (status) {
        case "dirty":
            return <CloudOff size={13} className="builderStatusIcon statusDirty" aria-hidden="true" />;
        case "saving":
            return <Loader2 size={13} className="builderStatusIcon statusSaving spinner" aria-hidden="true" />;
        case "error":
            return <AlertCircle size={13} className="builderStatusIcon statusError" aria-hidden="true" />;
        case "readonly":
            return <LockKeyhole size={13} className="builderStatusIcon statusReadonly" aria-hidden="true" />;
        case "saved":
        default:
            return <Check size={13} className="builderStatusIcon statusSaved" aria-hidden="true" />;
    }
}

export default function BuilderTopbar({
    title,
    saveStatusLabel,
    saveStatus,
    isPreviewing,
    isPublishing,
    isPublishedEdit,
    isPublishDisabled,
    onBack,
    onPreview,
    onPublish,
}: BuilderTopbarProps) {
    const { startLineLoader } = useLineLoader();

    const handlePreviewClick = () => {
        startLineLoader();
        onPreview();
    };

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

    const cleanLabel = saveStatusLabel.replace(/^✓\s*/, "");

    return (
        <header className="builderTopbar analyticsHeader">
            <button
                type="button"
                className="builderBack analyticsBackBtn"
                onClick={onBack}
            >
                <ArrowLeft
                    size={16}
                    aria-hidden="true"
                />

                <span>Back</span>
            </button>

            <div className="builderTitle analyticsHeaderText">
                <h1>{title}</h1>
                <p className={`builderSaveStatusBadge status-${saveStatus || "saved"}`}>
                    {renderStatusIcon(saveStatus)}
                    <span>{cleanLabel}</span>
                </p>
            </div>

            <div className="builderHeaderActions">
                <button
                    type="button"
                    className="builderPreviewAction"
                    onClick={handlePreviewClick}
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
                    className="builderPublishAction"
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
        </header>
    );
}
