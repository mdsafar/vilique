"use client";

import {
    Loader2,
    Pause,
    Play,
} from "lucide-react";

import useAudioPreview, {
    stopActiveSoundPreview,
} from "@/features/builder/hooks/useAudioPreview";

type SoundPreviewCardProps = {
    icon: string;
    title: string;
    subtitle: string;
    url?: string;
    badge?: "default" | "custom";
    onRemove?: () => void;
    onUpload?: (file: File) => void;
    isUploading?: boolean;
    uploadId?: string;
    isReadOnly?: boolean;
};

export default function SoundPreviewCard({
    icon,
    title,
    subtitle,
    url,
    badge,
    onRemove,
    onUpload,
    isUploading = false,
    uploadId,
    isReadOnly = false,
}: SoundPreviewCardProps) {
    const { playing, toggle } = useAudioPreview(url);

    return (
        <div className="soundPreviewCard" style={{
            borderRadius: "13px",
            border: "1px solid rgba(126, 91, 213, 0.12)",
            background: badge === "custom"
                ? "rgba(126, 91, 213, 0.04)"
                : "rgba(248, 246, 255, 0.9)",
            overflow: "hidden",
            marginTop: "7px",
            width: "100%",
            boxSizing: "border-box",
        }}>
            <div className="soundPreviewMain" style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 13px",
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
            }}>
                <span className="soundPreviewIcon" style={{ fontSize: "var(--sound-icon-font, 20px)", lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                <div style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px", minWidth: 0 }}>
                        <span className="soundPreviewTitle" style={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: "var(--sound-title-font, 12px)",
                            fontWeight: 850,
                            color: "#1a1a1a",
                            letterSpacing: "0.02em",
                        }}>{title}</span>
                        {badge && (
                            <span className="soundPreviewBadge" style={{
                                flexShrink: 0,
                                fontSize: "var(--sound-badge-font, 8px)",
                                fontWeight: 800,
                                padding: "1px 5px",
                                borderRadius: "999px",
                                background: badge === "custom" ? "rgba(126, 91, 213, 0.12)" : "rgba(16, 185, 129, 0.1)",
                                color: badge === "custom" ? "#7e5bd5" : "#059669",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                            }}>
                                {badge === "custom" ? "Custom" : "Default"}
                            </span>
                        )}
                    </div>
                    <span className="soundPreviewSubtitle" style={{
                        display: "block",
                        width: "100%",
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: "var(--sound-subtitle-font, 10.5px)",
                        color: "#9ca3af",
                        lineHeight: 1.22,
                    }}>
                        {subtitle}
                    </span>
                </div>
                <div className="soundPreviewActions" style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, marginLeft: "auto" }}>
                    {url && (
                        <button
                            type="button"
                            onClick={toggle}
                            className="soundPreviewPlay"
                            style={{
                                width: "var(--sound-play-size, 34px)",
                                minWidth: "var(--sound-play-size, 34px)",
                                height: "var(--sound-play-size, 34px)",
                                minHeight: "var(--sound-play-size, 34px)",
                                aspectRatio: "1 / 1",
                                padding: 0,
                                borderRadius: "50%",
                                border: "none",
                                background: playing
                                    ? "linear-gradient(135deg, #3b2a3a 0%, #7e5bd5 100%)"
                                    : "rgba(126, 91, 213, 0.1)",
                                color: playing ? "white" : "#7e5bd5",
                                display: "grid",
                                placeItems: "center",
                                lineHeight: 0,
                                cursor: "pointer",
                                transition: "all 0.2s",
                                flexShrink: 0,
                            }}
                        >
                            {playing ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                    )}
                    {onRemove && (
                        <button
                            type="button"
                            onClick={() => {
                                stopActiveSoundPreview();
                                onRemove();
                            }}
                            disabled={isUploading || isReadOnly}
                            style={{
                                height: "30px",
                                minHeight: "30px",
                                padding: "0 8px",
                                borderRadius: "7px",
                                background: "#fee2e2",
                                color: "#ef4444",
                                fontSize: "var(--sound-remove-font, 9.5px)",
                                fontWeight: 800,
                                border: "none",
                                cursor: isUploading || isReadOnly ? "not-allowed" : "pointer",
                                opacity: isUploading || isReadOnly ? 0.55 : 1,
                                flexShrink: 0,
                            }}
                        >
                            Remove
                        </button>
                    )}
                </div>
            </div>
            {onUpload && uploadId && (
                <div className={`soundUploadRow${isReadOnly ? " isReadOnly" : ""}`} style={{
                    borderTop: "1px dashed rgba(126, 91, 213, 0.12)",
                    padding: "10px 13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: isReadOnly ? "not-allowed" : isUploading ? "wait" : "pointer",
                    opacity: isReadOnly ? 0.58 : isUploading ? 0.88 : 1,
                }}
                    onClick={() => {
                        if (isUploading || isReadOnly) return;
                        stopActiveSoundPreview();
                        document.getElementById(uploadId)?.click();
                    }}
                >
                    {isReadOnly ? (
                        <span className="soundUploadIcon" aria-hidden="true">🔒</span>
                    ) : isUploading ? (
                        <Loader2 size={14} className="spinner" style={{ color: "#7e5bd5", flex: "0 0 auto" }} />
                    ) : (
                        <span className="soundUploadIcon" style={{ fontSize: "var(--sound-upload-icon-font, 12px)", flex: "0 0 auto" }}>📤</span>
                    )}
                    <span className="soundUploadText" style={{ fontSize: "var(--sound-upload-font, 11.5px)", color: "#7e5bd5", fontWeight: 750, letterSpacing: "0.015em" }}>
                        {isReadOnly ? "Upload locked in view-only mode" : isUploading ? "Uploading song..." : "Upload custom song to replace"}
                    </span>
                    <input
                        id={uploadId}
                        type="file"
                        accept="audio/*"
                        disabled={isUploading || isReadOnly}
                        style={{ display: "none" }}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                stopActiveSoundPreview();
                                onUpload(file);
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
}
