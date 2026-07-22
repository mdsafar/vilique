"use client";

import { ChevronLeft } from "lucide-react";

import BuilderToolRail from "@/features/builder/components/BuilderToolRail";
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

type DesktopEditorPanelProps = {
    activeTab: EditorTab;
    invitation: InvitationData;
    errors: BuilderValidationErrors;
    isUploadingMusic: boolean;
    isCollapsed: boolean;
    isReadOnly: boolean;

    onTabChange: (
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

    onToggleCollapse: () => void;
};

export default function DesktopEditorPanel({
    activeTab,
    invitation,
    errors,
    isUploadingMusic,
    isCollapsed,
    isReadOnly,
    onTabChange,
    updateField,
    updateTheme,
    updateMusicFile,
    onToggleCollapse,
}: DesktopEditorPanelProps) {
    return (
        <>
            <BuilderToolRail
                activeTab={activeTab}
                setActiveTab={onTabChange}
            />

            <aside className="editorPanel">
                <div className="editorPanelHeader">
                    <div>
                        <p>Edit invitation</p>
                        <h2>{activeTab}</h2>
                    </div>
                </div>

                <EditorTabs
                    activeTab={activeTab}
                    setActiveTab={onTabChange}
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
            </aside>

            <button
                className="builderEditorCollapse"
                type="button"
                aria-label={
                    isCollapsed
                        ? "Show editor"
                        : "Hide editor"
                }
                aria-expanded={!isCollapsed}
                onClick={onToggleCollapse}
            >
                <ChevronLeft
                    size={18}
                    aria-hidden="true"
                />
            </button>
        </>
    );
}
