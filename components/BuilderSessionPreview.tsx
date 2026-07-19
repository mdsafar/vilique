"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import PublicInviteExperience from "@/components/PublicInviteExperience";
import type { InvitationData } from "@/types/invitation";

const builderLocalPreviewKey = "vilique-builder-local-preview";

function readSessionPreview(templateId?: string) {
    try {
        const stored = sessionStorage.getItem(builderLocalPreviewKey);
        if (!stored) return null;
        const parsed = JSON.parse(stored) as {
            invitation?: InvitationData;
            backLabel?: string;
        };
        if (!parsed.invitation) return null;
        if (templateId && parsed.invitation.templateId !== templateId) return null;

        return {
            invitation: parsed.invitation,
            backLabel: parsed.backLabel === "Templates" ? "Back to Editor" : parsed.backLabel || "Back to Editor",
        };
    } catch {
        sessionStorage.removeItem(builderLocalPreviewKey);
        return null;
    }
}

export default function BuilderSessionPreview({
    templateId,
    invitationId,
}: {
    templateId?: string;
    invitationId?: string;
}) {
    const router = useRouter();
    const [preview] = useState(() => readSessionPreview(templateId));

    // When we know the invitation ID, link directly to the builder for that draft
    // instead of relying on browser history, which can be unreliable.
    const backHref = invitationId ? `/builder?id=${invitationId}` : null;

    return (
        <div className="builderPreviewShell">
            <div className="builderPreviewTopbar">
                {backHref ? (
                    <a href={backHref} className="backToBuilderBtn">
                        <ArrowLeft size={16} />
                        <span>Back to Editor</span>
                    </a>
                ) : (
                    <button type="button" className="backToBuilderBtn" onClick={() => router.back()}>
                        <ArrowLeft size={16} />
                        <span>{preview?.backLabel || "Back to Editor"}</span>
                    </button>
                )}
                <span className="draftBadge">Draft Preview</span>
            </div>

            {preview?.invitation ? (
                <PublicInviteExperience invitation={preview.invitation} isPublic={false} />
            ) : (
                <main className="templatesListState">
                    <h1>Preview expired</h1>
                    <p>This unsaved preview is no longer available.</p>
                </main>
            )}
        </div>
    );
}
