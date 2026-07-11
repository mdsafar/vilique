"use client";

import { useEffect, useState, useRef } from "react";
import { Copy, Share2, ExternalLink, X, Check, AlertTriangle, Loader2, Rocket } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
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
    const [mounted, setMounted] = useState(false);

    const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => { setMounted(true); }, []);

    // Prevent background scrolling when open
    useEffect(() => {
        if (!isOpen) return;
        const scrollY = window.scrollY;
        const prev = {
            bodyOverflow: document.body.style.overflow,
            bodyPosition: document.body.style.position,
            bodyTop: document.body.style.top,
            bodyWidth: document.body.style.width,
            htmlOverflow: document.documentElement.style.overflow,
        };
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = "100%";
        return () => {
            document.documentElement.style.overflow = prev.htmlOverflow;
            document.body.style.overflow = prev.bodyOverflow;
            document.body.style.position = prev.bodyPosition;
            document.body.style.top = prev.bodyTop;
            document.body.style.width = prev.bodyWidth;
            window.scrollTo(0, scrollY);
        };
    }, [isOpen]);

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

    if (!mounted) return null;

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
            navigator.share({ title: shareTitle, text: shareText, url: publicUrl }).catch(() => undefined);
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

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="publishModalOverlay" role="dialog" aria-modal="true" aria-label="Publish invitation">
                    <motion.div
                        className="publishModalBackdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    <motion.div
                        className="publishModalPanel"
                        initial={{ opacity: 0, scale: 0.96, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 16 }}
                        transition={{ type: "spring", duration: 0.4 }}
                    >
                        {/* Header */}
                        <div className="publishModalBanner">
                            <div>
                                <h2 className="publishModalBannerTitle">
                                    {isPublished ? "🎉 Invitation is Live!" : "Publish Invitation"}
                                </h2>
                                <p className="publishModalBannerSub">
                                    {isPublished ? "Share your link with guests!" : "Set your URL and go live."}
                                </p>
                            </div>
                            <button className="publishModalClose" onClick={onClose} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="publishModalContent">
                            {publishError && (
                                <div className="publishModalError">
                                    <AlertTriangle size={15} />
                                    <span>{publishError}</span>
                                </div>
                            )}

                            {!isPublished ? (
                                <>
                                    {hasValidationErrors && (
                                        <div className="publishModalValidation">
                                            <p>Complete required fields first:</p>
                                            <ul>
                                                {validationErrors.map((err, i) => (
                                                    <li key={i}>{err}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="publishModalSlugForm">
                                        <label>
                                            <span>Your public link</span>
                                            <div className="slugInputWrapper">
                                                <span className="slugDomain">vilique.com/i/</span>
                                                <input
                                                    type="text"
                                                    value={slug}
                                                    readOnly
                                                    tabIndex={-1}
                                                />
                                                {status === "checking" && <Loader2 className="spinner slugStatusIcon" size={16} />}
                                                {status === "available" && <Check className="slugStatusIcon available" size={16} />}
                                                {status === "taken" && <X className="slugStatusIcon taken" size={16} />}
                                                {status === "invalid" && <AlertTriangle className="slugStatusIcon invalid" size={16} />}
                                            </div>
                                        </label>

                                        {feedback && (
                                            <p className={`slugFeedback ${status}`}>
                                                <span>{feedback}</span>
                                            </p>
                                        )}
                                    </div>

                                    <div className="publishActions">
                                        <button
                                            className="publishBtnCancel"
                                            onClick={onClose}
                                            disabled={isPublishing}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="publishBtnPrimary"
                                            onClick={handlePublish}
                                            disabled={!canPublish}
                                        >
                                            {isPublishing
                                                ? <><Loader2 size={16} className="spinner" /> Publishing…</>
                                                : <><Rocket size={16} /> Publish Now</>
                                            }
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="publishSuccessState">
                                    <div className="publishLinkCard">
                                        <span className="linkUrl">{publicUrl}</span>
                                        <button className="copyBtn" onClick={copyToClipboard}>
                                            {copied ? <Check size={15} /> : <Copy size={15} />}
                                            {copied ? "Copied!" : "Copy"}
                                        </button>
                                    </div>

                                    <div className="publishSuccessActions">
                                        <button className="publishBtnShare" onClick={shareInvitation}>
                                            <Share2 size={16} /> Share Link
                                        </button>
                                        <a className="publishBtnWhatsapp" href={getWhatsAppShareUrl()} target="_blank" rel="noopener noreferrer">
                                            WhatsApp
                                        </a>
                                        <a className="publishBtnOpen" href={publicUrl} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink size={15} /> Open
                                        </a>
                                    </div>

                                    <div className="unpublishZone">
                                        <p>Need to make changes? Unpublish to make it private again.</p>
                                        <button className="unpublishBtn" onClick={handleUnpublish} disabled={isPublishing}>
                                            {isPublishing ? "Unpublishing…" : "Unpublish"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
