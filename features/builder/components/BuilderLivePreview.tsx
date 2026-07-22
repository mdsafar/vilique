"use client";

import type { Ref } from "react";
import {
    Monitor,
    Smartphone,
} from "lucide-react";

import TemplateRenderer from "@/components/TemplateRenderer";
import {
    FloatingFlowers,
} from "@/components/templates/PastelFloralWedding";
import type {
    PreviewDeviceMode,
    PreviewScreen,
} from "@/features/builder/types";
import type {
    InvitationData,
} from "@/types/invitation";

type BuilderLivePreviewProps = {
    invitation: InvitationData;
    previewScreen: PreviewScreen;
    previewDeviceMode: PreviewDeviceMode;
    previewScrolledToBottom: boolean;
    previewViewportRef: Ref<HTMLDivElement>;
    demoCountdownTargetDate: Date | null;

    onScreenChange: (
        screen: PreviewScreen,
    ) => void;

    onDeviceModeChange: (
        mode: PreviewDeviceMode,
    ) => void;
};

export default function BuilderLivePreview({
    invitation,
    previewScreen,
    previewDeviceMode,
    previewScrolledToBottom,
    previewViewportRef,
    demoCountdownTargetDate,
    onScreenChange,
    onDeviceModeChange,
}: BuilderLivePreviewProps) {
    return (
        <>
            <section
                className="builderCanvas"
                aria-label="Invitation canvas"
            >
                <div className="previewColumn">
                    <div className="previewLabel">
                        <span>
                            <Smartphone
                                size={15}
                                aria-hidden="true"
                            />

                            Live preview

                            <span
                                className="liveDot"
                                aria-hidden="true"
                            />
                        </span>

                        <div className="previewMeta">
                            <div
                                className="previewScreenToggle"
                                aria-label="Preview screen"
                            >
                                <button
                                    type="button"
                                    className={
                                        previewScreen ===
                                            "invite"
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() =>
                                        onScreenChange(
                                            "invite",
                                        )
                                    }
                                >
                                    Invite
                                </button>

                                <button
                                    type="button"
                                    className={
                                        previewScreen ===
                                            "thanks"
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() =>
                                        onScreenChange(
                                            "thanks",
                                        )
                                    }
                                >
                                    Thanks
                                </button>
                            </div>
                        </div>
                    </div>

                    <div
                        className={`previewDevice previewDevice--${previewDeviceMode}${!previewScrolledToBottom
                            ? " hasScrollCue"
                            : ""
                            }`}
                    >
                        <div
                            className="previewFixedTemplateBg"
                            aria-hidden="true"
                        >
                            <FloatingFlowers />
                        </div>

                        <div
                            className="previewViewport"
                            ref={previewViewportRef}
                        >
                            <div className="previewScaleFrame">
                                <TemplateRenderer
                                    invitation={
                                        invitation
                                    }
                                    accepted={
                                        previewScreen ===
                                        "thanks"
                                    }
                                    demoCountdownTargetDate={
                                        demoCountdownTargetDate ??
                                        undefined
                                    }
                                    onAccept={() =>
                                        onScreenChange(
                                            "thanks",
                                        )
                                    }
                                    onDecline={() =>
                                        onScreenChange(
                                            "invite",
                                        )
                                    }
                                    enableAudio
                                />
                            </div>
                        </div>

                        <span
                            className="previewScrollFade"
                            aria-hidden="true"
                        />

                        <span
                            className="templatePreviewScrollCue"
                            aria-hidden="true"
                        />
                    </div>
                </div>
            </section>

            <div
                className="builderCanvasControls"
                aria-label="Preview device"
            >
                <button
                    type="button"
                    className={
                        previewDeviceMode === "mobile"
                            ? "active"
                            : ""
                    }
                    aria-label="Mobile preview"
                    title="Mobile preview"
                    onClick={() =>
                        onDeviceModeChange("mobile")
                    }
                >
                    <Smartphone
                        size={18}
                        aria-hidden="true"
                    />
                </button>

                <button
                    type="button"
                    className={
                        previewDeviceMode === "desktop"
                            ? "active"
                            : ""
                    }
                    aria-label="Desktop preview"
                    title="Desktop preview"
                    onClick={() =>
                        onDeviceModeChange("desktop")
                    }
                >
                    <Monitor
                        size={18}
                        aria-hidden="true"
                    />
                </button>
            </div>
        </>
    );
}