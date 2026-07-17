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

export default function BuilderSessionPreview({ templateId }: { templateId?: string }) {
    const router = useRouter();
    const [preview] = useState(() => readSessionPreview(templateId));

    return (
        <div className="builderPreviewShell">
            <div className="builderPreviewTopbar">
                <button type="button" className="backToBuilderBtn" onClick={() => router.back()}>
                    <ArrowLeft size={16} />
                    <span>{preview?.backLabel || "Back to Editor"}</span>
                </button>
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
