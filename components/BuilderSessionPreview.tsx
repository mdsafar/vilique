"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import PublicInviteExperience from "@/components/PublicInviteExperience";
import PublicInviteLoading from "@/app/(public-invite)/i/[slug]/loading";
import type { InvitationData } from "@/types/invitation";

const builderLocalPreviewKey =
    "vilique-builder-local-preview";

type SessionPreview = {
    invitation: InvitationData;
    backLabel: string;
    backTarget: string | null;
};

function isSafeBuilderRoute(
    value: unknown,
): value is string {
    return (
        typeof value === "string" &&
        value.startsWith("/builder") &&
        !value.startsWith("//")
    );
}

const emptySubscribe = () => () => { };

function subscribe(callback: () => void) {
    if (typeof window === "undefined") return () => { };
    window.addEventListener("storage", callback);
    return () => window.removeEventListener("storage", callback);
}

function getSnapshot() {
    if (typeof window === "undefined") return "";
    try {
        return sessionStorage.getItem(builderLocalPreviewKey) || "";
    } catch {
        return "";
    }
}

function getServerSnapshot() {
    return "";
}

export default function BuilderSessionPreview({
    templateId,
    invitationId,
}: {
    templateId?: string;
    invitationId?: string;
}) {
    const router = useRouter();

    const isMounted = useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false,
    );

    const rawPreview = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot,
    );

    const preview = useMemo<SessionPreview | null>(() => {
        if (!rawPreview) return null;

        try {
            const parsed = JSON.parse(rawPreview) as {
                invitation?: InvitationData;
                backLabel?: string;
                backTarget?: string;
                builderReturnUrl?: string;
            };

            if (!parsed.invitation) {
                return null;
            }

            if (
                templateId &&
                parsed.invitation.templateId !== templateId
            ) {
                return null;
            }

            const storedBackTarget = isSafeBuilderRoute(
                parsed.builderReturnUrl,
            )
                ? parsed.builderReturnUrl
                : isSafeBuilderRoute(parsed.backTarget)
                    ? parsed.backTarget
                    : null;

            return {
                invitation: parsed.invitation,
                backLabel:
                    parsed.backLabel === "Templates"
                        ? "Back to Editor"
                        : parsed.backLabel || "Back to Editor",
                backTarget: storedBackTarget,
            };
        } catch {
            return null;
        }
    }, [rawPreview, templateId]);

    const fallbackBuilderTarget = invitationId
        ? `/builder?id=${encodeURIComponent(
            invitationId,
        )}${templateId
            ? `&template=${encodeURIComponent(
                templateId,
            )}`
            : ""
        }`
        : templateId
            ? `/builder?template=${encodeURIComponent(
                templateId,
            )}`
            : "/builder";

    const backTarget =
        preview?.backTarget ??
        fallbackBuilderTarget;

    function handleReturnToBuilder() {
        router.replace(backTarget, {
            scroll: false,
        });
    }

    if (!isMounted) {
        return <PublicInviteLoading />;
    }

    return (
        <div className="builderPreviewShell">
            <div className="builderPreviewTopbar">
                <button
                    type="button"
                    className="backToBuilderBtn"
                    onClick={
                        handleReturnToBuilder
                    }
                >
                    <ArrowLeft
                        size={16}
                        aria-hidden="true"
                    />

                    <span>
                        {preview?.backLabel ||
                            "Back to Editor"}
                    </span>
                </button>

                <span className="draftBadge">
                    Draft Preview
                </span>
            </div>

            {preview?.invitation ? (
                <PublicInviteExperience
                    invitation={
                        preview.invitation
                    }
                    isPublic={false}
                />
            ) : (
                <main className="templatesListState">
                    <h1>Preview expired</h1>

                    <p>
                        This unsaved preview is no
                        longer available.
                    </p>
                </main>
            )}
        </div>
    );
}