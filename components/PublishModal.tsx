"use client";

import { useEffect, useState, useRef } from "react";
import { Copy, Share2, Eye, ExternalLink, X, Check, AlertTriangle, Loader2 } from "lucide-react";
import { getPublicInvitationUrl } from "@/lib/config/site";

type Props = {
    invitation: any;
    isOpen: boolean;
    onClose: () => void;
    onPublishSuccess: (updatedInvitation: any) => void;
};

export default function PublishModal({ invitation, isOpen, onClose, onPublishSuccess }: Props) {
    const [slug, setSlug] = useState(invitation.slug);
    const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
    const [feedback, setFeedback] = useState("");
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishError, setPublishError] = useState("");
    const [copied, setCopied] = useState(false);
    const [isPublished, setIsPublished] = useState(invitation.status === "published");

    const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Reset slug when modal opens
    useEffect(() => {
        if (isOpen) {
            setSlug(invitation.slug);
            setStatus("idle");
            setFeedback("");
            setPublishError("");
            setCopied(false);
            setIsPublished(invitation.status === "published");
        }
    }, [isOpen, invitation.slug, invitation.status]);

    // Validation check on slug change
    useEffect(() => {
        if (!isOpen) return;
        if (slug === invitation.slug) {
            setStatus("idle");
            setFeedback("");
            return;
        }

        if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);

        const cleanSlug = slug.toLowerCase().trim();
        if (cleanSlug.length < 3) {
            setStatus("invalid");
            setFeedback("Slug must be at least 3 characters");
            return;
        }

        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
            setStatus("invalid");
            setFeedback("Use lowercase letters, numbers, and hyphens only");
            return;
        }

        setStatus("checking");
        setFeedback("Checking availability...");

        checkTimeoutRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/invitations/check-slug?slug=${cleanSlug}&excludeId=${invitation.id}`);
                const data = await res.json();
                if (data.status === "available") {
                    setStatus("available");
                    setFeedback("Available!");
                } else if (data.status === "taken") {
                    setStatus("taken");
                    setFeedback("Already taken");
                } else {
                    setStatus("invalid");
                    setFeedback(data.message || "Invalid slug");
                }
            } catch {
                setStatus("idle");
                setFeedback("");
            }
        }, 500);

        return () => {
            if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
        };
    }, [slug, invitation.slug, invitation.id, isOpen]);

    if (!isOpen) return null;

    // Front-end validation before publishing
    const validationErrors: string[] = [];
    if (!invitation.title?.trim()) validationErrors.push("Title is required");
    if (!invitation.primaryName?.trim()) validationErrors.push("Host/Couple name is required");
    if (!invitation.eventDate) validationErrors.push("Event date is required");
    if (!invitation.venueName?.trim()) validationErrors.push("Venue name is required");
    if (!invitation.message?.trim()) validationErrors.push("Invitation message is required");

    const hasValidationErrors = validationErrors.length > 0;
    const isSlugTakenOrInvalid = slug !== invitation.slug && (status === "taken" || status === "invalid");
    const canPublish = !hasValidationErrors && !isSlugTakenOrInvalid && !isPublishing;

    const currentSlug = isPublished ? invitation.slug : slug;
    const publicUrl = getPublicInvitationUrl(currentSlug);

    async function handlePublish() {
        if (!canPublish) return;
        setIsPublishing(true);
        setPublishError("");

        try {
            const res = await fetch(`/api/invitations/${invitation.id}/publish`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug: slug.toLowerCase().trim() }),
            });

            const data = await res.json();
            if (!res.ok) {
                setPublishError(data.error || "Failed to publish");
                setIsPublishing(false);
                return;
            }

            setIsPublished(true);
            onPublishSuccess(data);
        } catch {
            setPublishError("An error occurred during publishing");
        } finally {
            setIsPublishing(false);
        }
    }

    async function handleUnpublish() {
        setIsPublishing(true);
        setPublishError("");

        try {
            const res = await fetch(`/api/invitations/${invitation.id}/unpublish`, {
                method: "POST",
            });

            const data = await res.json();
            if (!res.ok) {
                setPublishError(data.error || "Failed to unpublish");
                setIsPublishing(false);
                return;
            }

            setIsPublished(false);
            onPublishSuccess(data);
        } catch {
            setPublishError("An error occurred during unpublishing");
        } finally {
            setIsPublishing(false);
        }
    }

    function copyToClipboard() {
        navigator.clipboard.writeText(publicUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    function shareInvitation() {
        const shareTitle = invitation.secondaryName
            ? `${invitation.primaryName} & ${invitation.secondaryName}'s Wedding Invitation`
            : invitation.title;
        const shareText = invitation.message || "You are invited to celebrate with us!";

        if (navigator.share) {
            navigator.share({
                title: shareTitle,
                text: shareText,
                url: publicUrl,
            }).catch(() => undefined);
        } else {
            copyToClipboard();
        }
    }

    function getWhatsAppShareUrl() {
        const shareTitle = invitation.secondaryName
            ? `${invitation.primaryName} & ${invitation.secondaryName}'s Wedding Invitation`
            : invitation.title;
        const shareText = invitation.message || "You are invited to celebrate with us!";
        const whatsappText = encodeURIComponent(`${shareTitle}\n\n${shareText}\n\n${publicUrl}`);
        return `https://wa.me/?text=${whatsappText}`;
    }

    return (
        <div className="publishModalOverlay" role="dialog" aria-modal="true">
            <div className="publishModalPanel">
                <header className="publishModalHeader">
                    <h2>{isPublished ? "Invitation Published!" : "Publish Invitation"}</h2>
                    <button className="publishModalClose" onClick={onClose} aria-label="Close">
                        <X size={20} />
                    </button>
                </header>

                <div className="publishModalContent">
                    {publishError && (
                        <div className="publishModalError">
                            <AlertTriangle size={16} />
                            <span>{publishError}</span>
                        </div>
                    )}

                    {!isPublished ? (
                        <>
                            {hasValidationErrors && (
                                <div className="publishModalValidation">
                                    <p>Please complete all required fields before publishing:</p>
                                    <ul>
                                        {validationErrors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="publishModalSlugForm">
                                <label>
                                    <span>Customize your public link:</span>
                                    <div className="slugInputWrapper">
                                        <span className="slugDomain">viliqu.com/i/</span>
                                        <input
                                            type="text"
                                            value={slug}
                                            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                                            placeholder="event-name"
                                            disabled={isPublishing}
                                        />
                                    </div>
                                </label>

                                {feedback && (
                                    <p className={`slugFeedback ${status}`}>
                                        {status === "checking" && <Loader2 className="spinner" size={12} />}
                                        {status === "available" && <Check size={12} />}
                                        {status === "taken" && <X size={12} />}
                                        {status === "invalid" && <AlertTriangle size={12} />}
                                        <span>{feedback}</span>
                                    </p>
                                )}
                            </div>

                            <div className="publishActions">
                                <button
                                    className="primaryBtn publishBtn"
                                    onClick={handlePublish}
                                    disabled={!canPublish}
                                >
                                    {isPublishing ? "Publishing..." : "Publish Now"}
                                </button>
                                <button className="secondaryBtn cancelBtn" onClick={onClose} disabled={isPublishing}>
                                    Cancel
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="publishSuccessState">
                            <div className="successIcon">
                                <Check size={32} />
                            </div>
                            <h3>Your link is ready</h3>
                            
                            <div className="publishLinkCard">
                                <span className="linkUrl">{publicUrl}</span>
                                <button className="copyBtn" onClick={copyToClipboard}>
                                    {copied ? "Copied!" : <Copy size={16} />}
                                </button>
                            </div>

                            <div className="publishSuccessActions">
                                <button className="primaryBtn" onClick={shareInvitation}>
                                    <Share2 size={16} />
                                    Share Link
                                </button>
                                <a className="secondaryBtn" href={getWhatsAppShareUrl()} target="_blank" rel="noopener noreferrer">
                                    Share on WhatsApp
                                </a>
                                <a className="secondaryBtn" href={publicUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink size={16} />
                                    Open Invitation
                                </a>
                            </div>

                            <hr className="divider" style={{ width: "100%", border: "0", borderTop: "1px solid rgba(23,23,23,0.08)", margin: "14px 0" }} />

                            <div className="unpublishZone">
                                <p>Need to make changes? You can unpublish your invitation to make it private again.</p>
                                <button className="unpublishBtn" onClick={handleUnpublish} disabled={isPublishing}>
                                    {isPublishing ? "Unpublishing..." : "Unpublish"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
