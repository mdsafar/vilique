"use client";

import type { ComponentProps } from "react";

import PublishModal from "@/components/PublishModal";
import LeaveModal from "@/features/builder/components/LeaveModal";
import PublishSuccessModal from "@/features/builder/components/PublishSuccessModal";
import type {
    BuilderMode,
    PublishSuccessDetails,
} from "@/features/builder/types";
import type { InvitationData } from "@/types/invitation";
import type { BuilderLockCredentials } from "@/features/builder/lib/builderLock";

export type PublishModalSuccessPayload =
    Parameters<
        NonNullable<
            ComponentProps<
                typeof PublishModal
            >["onPublishSuccess"]
        >
    >[0];

type BuilderModalsProps = {
    builderMode: BuilderMode;
    invitation: InvitationData;
    editorLock: BuilderLockCredentials | null;

    leaveModalOpen: boolean;
    isSavingDraftAndLeaving: boolean;

    isPublishModalOpen: boolean;
    publishSuccessDetails:
    | PublishSuccessDetails
    | null;

    onLeaveSave: () => Promise<
        boolean | void
    >;

    onLeaveDiscard: () =>
        | Promise<void>
        | void;

    onLeaveCancel: () => void;

    onPublishClose: () => void;

    onPublishSuccess: (
        updatedInvitation:
            PublishModalSuccessPayload,
    ) => void;

    onViewInvitations: () => void;
};

export default function BuilderModals({
    builderMode,
    invitation,
    editorLock,
    leaveModalOpen,
    isSavingDraftAndLeaving,
    isPublishModalOpen,
    publishSuccessDetails,
    onLeaveSave,
    onLeaveDiscard,
    onLeaveCancel,
    onPublishClose,
    onPublishSuccess,
    onViewInvitations,
}: BuilderModalsProps) {
    return (
        <>
            <LeaveModal
                isOpen={leaveModalOpen}
                mode={builderMode}
                saving={
                    isSavingDraftAndLeaving
                }
                onSave={onLeaveSave}
                onDiscard={onLeaveDiscard}
                onCancel={onLeaveCancel}
            />

            <PublishModal
                invitation={invitation}
                editorLock={editorLock}
                isOpen={isPublishModalOpen}
                onClose={onPublishClose}
                onPublishSuccess={
                    onPublishSuccess
                }
            />

            <PublishSuccessModal
                details={
                    publishSuccessDetails
                }
                onViewProfile={
                    onViewInvitations
                }
            />
        </>
    );
}
