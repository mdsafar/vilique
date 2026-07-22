"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
    Check,
    Copy,
    ExternalLink,
    ArrowRight,
    Loader2,
} from "lucide-react";

import { getPublicInvitationUrl } from "@/lib/config/site";

type PublishSuccessDetails = {
    slug: string;
    publishedAt?: string | null;
};

export default function PublishSuccessModal({
    details,
    onViewProfile,
}: {
    details: PublishSuccessDetails | null;
    onViewProfile: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);

    if (!details) return null;

    const publicUrl = getPublicInvitationUrl(details.slug);

    function copyLink() {
        navigator.clipboard.writeText(publicUrl).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        });
    }

    function handleNavigate() {
        if (isNavigating) return;
        setIsNavigating(true);
        onViewProfile();
    }

    return createPortal(
        <AnimatePresence>
            <div className="publishSuccessOverlay" role="dialog" aria-modal="true" aria-label="Invitation published">
                <motion.div
                    className="publishSuccessLockedBackdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                />

                <motion.div
                    className="publishSuccessPanel"
                    initial={{ opacity: 0, scale: 0.95, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 16 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                    <div className="publishSuccessTop">
                        <div className="publishSuccessIconBadge">
                            <Check size={20} strokeWidth={2.75} />
                        </div>
                        <div className="publishSuccessCopy">
                            <h2>Your invitation is live</h2>
                            <span>Guests can now open, view, and RSVP from your link.</span>
                        </div>
                    </div>

                    <div className="publishSuccessLinkBox">
                        <div className="publishSuccessUrlText">
                            <small>Public link</small>
                            <span title={publicUrl}>{publicUrl}</span>
                        </div>
                        <button
                            type="button"
                            className="publishSuccessCopyBtn"
                            onClick={copyLink}
                            disabled={isNavigating}
                        >
                            {copied ? (
                                <>
                                    <Check size={13} strokeWidth={2.5} />
                                    <span>Copied</span>
                                </>
                            ) : (
                                <>
                                    <Copy size={13} />
                                    <span>Copy</span>
                                </>
                            )}
                        </button>
                    </div>

                    <div className="publishSuccessActions publishSuccessDialogActions">
                        <a
                            className={`publishSuccessOpenBtn${isNavigating ? " disabled" : ""}`}
                            href={isNavigating ? undefined : publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => { if (isNavigating) e.preventDefault(); }}
                        >
                            <span>Open site</span>
                            <ExternalLink size={14} />
                        </a>
                        <button
                            className="publishSuccessProfileBtn"
                            type="button"
                            onClick={handleNavigate}
                            disabled={isNavigating}
                        >
                            {isNavigating ? (
                                <>
                                    <Loader2 size={15} className="spinner" />
                                    <span>Navigating...</span>
                                </>
                            ) : (
                                <>
                                    <span>View in Invitations</span>
                                    <ArrowRight size={15} />
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
}