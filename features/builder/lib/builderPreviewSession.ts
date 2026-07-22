import type {
    BuilderMode,
    SaveStatus,
} from "@/features/builder/types";
import type { InvitationData } from "@/types/invitation";

export const builderLocalPreviewKey =
    "vilique-builder-local-preview";

export const builderPreviewSnapshotMaxAgeMs =
    30 * 60 * 1000;

export type BuilderPreviewSnapshot = {
    source: "builder-session";
    invitation: InvitationData;
    invitationId: string | null;
    templateId: string;
    builderReturnUrl: string;
    builderExitTarget: string;
    baselinePayload: string;
    baselineComparablePayload: string;
    lastPersistedPayload: string;
    hasUserEdited: boolean;
    requiresExitDecision?: boolean;
    builderMode: BuilderMode;
    saveStatus: SaveStatus;
    createdAt: number;
};

export function isSafeInternalRoute(
    value: unknown,
): value is string {
    return (
        typeof value === "string" &&
        value.startsWith("/") &&
        !value.startsWith("//")
    );
}

export function getBuilderRecoveryKey(
    templateKey: string,
): string {
    return `vilique-builder:recovery:${templateKey}`;
}

export function getBuilderPreviewKey(
    templateKey: string,
    existingId: string | null,
): string {
    return `vilique-builder:preview:${existingId || templateKey
        }`;
}

export function readBuilderPreviewSnapshot(
    templateKey: string,
    existingId: string | null,
): BuilderPreviewSnapshot | null {
    if (typeof window === "undefined") {
        return null;
    }

    const keys = Array.from(
        new Set([
            builderLocalPreviewKey,
            getBuilderPreviewKey(
                templateKey,
                existingId,
            ),
            getBuilderPreviewKey(
                templateKey,
                null,
            ),
        ]),
    );

    for (const key of keys) {
        const raw =
            sessionStorage.getItem(key);

        if (!raw) continue;

        try {
            const parsed = JSON.parse(
                raw,
            ) as Record<string, unknown>;

            if (
                parsed.source !==
                "builder-session"
            ) {
                continue;
            }

            const invitation =
                parsed.invitation as
                | InvitationData
                | undefined;

            if (
                !invitation ||
                typeof invitation !== "object"
            ) {
                continue;
            }

            const createdAt =
                typeof parsed.createdAt ===
                    "number"
                    ? parsed.createdAt
                    : 0;

            if (
                !createdAt ||
                Date.now() - createdAt >
                builderPreviewSnapshotMaxAgeMs
            ) {
                sessionStorage.removeItem(key);
                continue;
            }

            const invitationId =
                typeof parsed.invitationId ===
                    "string"
                    ? parsed.invitationId
                    : invitation.id &&
                        invitation.id !==
                        "default-draft-placeholder-id"
                        ? invitation.id
                        : null;

            if (
                existingId &&
                invitationId !== existingId
            ) {
                continue;
            }

            if (
                !existingId &&
                invitation.templateId !==
                templateKey
            ) {
                continue;
            }

            const builderReturnUrl =
                isSafeInternalRoute(
                    parsed.builderReturnUrl,
                )
                    ? parsed.builderReturnUrl
                    : isSafeInternalRoute(
                        parsed.backTarget,
                    ) &&
                        parsed.backTarget.startsWith(
                            "/builder",
                        )
                        ? parsed.backTarget
                        : "";

            if (
                !builderReturnUrl.startsWith(
                    "/builder",
                )
            ) {
                continue;
            }

            const builderExitTarget =
                isSafeInternalRoute(
                    parsed.builderExitTarget,
                )
                    ? parsed.builderExitTarget
                    : "/";

            const rawMode =
                parsed.builderMode ??
                parsed._builderMode;

            const builderMode: BuilderMode =
                rawMode === "draft-edit" ||
                    rawMode === "published-edit"
                    ? rawMode
                    : "new";

            const rawStatus =
                parsed.saveStatus ??
                parsed._saveStatus;

            const saveStatus: SaveStatus =
                rawStatus === "dirty" ||
                    rawStatus === "saving" ||
                    rawStatus === "saved" ||
                    rawStatus === "error"
                    ? rawStatus
                    : "idle";

            return {
                source: "builder-session",
                invitation,
                invitationId,
                templateId:
                    typeof parsed.templateId ===
                        "string"
                        ? parsed.templateId
                        : invitation.templateId,
                builderReturnUrl,
                builderExitTarget,
                baselinePayload:
                    typeof parsed.baselinePayload ===
                        "string"
                        ? parsed.baselinePayload
                        : typeof parsed._baselinePayload ===
                            "string"
                            ? parsed._baselinePayload
                            : "",
                baselineComparablePayload:
                    typeof parsed.baselineComparablePayload ===
                        "string"
                        ? parsed.baselineComparablePayload
                        : typeof parsed._baselineComparablePayload ===
                            "string"
                            ? parsed._baselineComparablePayload
                            : "",
                lastPersistedPayload:
                    typeof parsed.lastPersistedPayload ===
                        "string"
                        ? parsed.lastPersistedPayload
                        : typeof parsed._lastPersistedPayload ===
                            "string"
                            ? parsed._lastPersistedPayload
                            : "",
                hasUserEdited:
                    parsed.hasUserEdited === true ||
                    parsed._hasUserEdited ===
                    true,
                requiresExitDecision:
                    parsed.requiresExitDecision ===
                    true,
                builderMode,
                saveStatus,
                createdAt,
            };
        } catch {
            sessionStorage.removeItem(key);
        }
    }

    return null;
}