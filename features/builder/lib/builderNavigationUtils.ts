import {
    isSafeInternalRoute,
} from "@/features/builder/lib/builderPreviewSession";
import type {
    BuilderMode,
} from "@/features/builder/types";

type ResolveBuilderBackTargetOptions = {
    returnToParam: string | null;
    previewExitTarget?: string | null;
    builderMode: BuilderMode;
    openedFromTemplateDetails: boolean;
    templateKey: string;
    existingId: string | null;
};

export function resolveBuilderBackTarget({
    returnToParam,
    previewExitTarget,
    builderMode,
    openedFromTemplateDetails,
    templateKey,
    existingId,
}: ResolveBuilderBackTargetOptions): string {
    if (
        isSafeInternalRoute(returnToParam)
    ) {
        return returnToParam;
    }

    if (
        previewExitTarget &&
        isSafeInternalRoute(
            previewExitTarget,
        )
    ) {
        return previewExitTarget;
    }

    if (
        builderMode === "published-edit"
    ) {
        return "/invitations?status=upcoming";
    }

    if (openedFromTemplateDetails) {
        return `/templates/${templateKey}`;
    }

    return existingId
        ? "/invitations"
        : "/invitations?status=draft";
}