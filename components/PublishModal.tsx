"use client";

import { useEffect, useState, useRef } from "react";
import { Copy, Share2, ExternalLink, X, Check, AlertTriangle, Loader2, Rocket, LockKeyhole, ShieldCheck, PartyPopper } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { getPublicInvitationUrl } from "@/lib/config/site";
import { useRazorpay } from "@/hooks/useRazorpay";
import { formatPaiseToCurrency } from "@/lib/currency";
import type { InvitationData } from "@/types/invitation";

type Props = {
    invitation: InvitationData;
    isOpen: boolean;
    onClose: () => void;
    onPublishSuccess: (updatedInvitation: PublishedInvitationResult) => void;
};

type PublishedInvitationResult = {
    slug: string;
    status: NonNullable<InvitationData["status"]>;
    published_at?: string | null;
};

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

type RazorpayPaymentResponse = {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
};

type RazorpayFailureResponse = {
    error: {
        description?: string;
    };
};

type RazorpayOptions = {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: RazorpayPaymentResponse) => void | Promise<void>;
    modal: {
        ondismiss: () => void;
    };
    prefill: {
        contact?: string;
    };
    theme: {
        color: string;
    };
    config: Record<string, unknown>;
};

type RazorpayInstance = {
    on: (event: "payment.failed", handler: (response: RazorpayFailureResponse) => void) => void;
    open: () => void;
};

type RazorpayWindow = Window & {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
};

interface PaymentInfo {
    isFree: boolean;
    pricePaise: number;
    currency: string;
    alreadyPaid: boolean;
    templateName: string;
}

export default function PublishModal({ invitation, isOpen, onClose, onPublishSuccess }: Props) {
    const [slug, setSlug] = useState(invitation.slug);
    const [status, setStatus] = useState<SlugStatus>("idle");
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishError, setPublishError] = useState("");
    const [copied, setCopied] = useState(false);
    const [isPublished, setIsPublished] = useState(invitation.status === "published");

    // Razorpay payment integration states
    const { loadScript } = useRazorpay();
    const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
    const [loadingPaymentInfo, setLoadingPaymentInfo] = useState(true);
    const [paymentError, setPaymentError] = useState("");
    const [paymentProcessingState, setPaymentProcessingState] = useState<
        | "idle"
        | "creatingOrder"
        | "openingCheckout"
        | "verifyingPayment"
        | "paymentSuccess"
        | "failed"
    >("idle");

    const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    // Reset fields and fetch payment status when modal opens
    useEffect(() => {
        if (!isOpen) return;
        const timeout = window.setTimeout(() => {
            setSlug(invitation.slug);
            setStatus("idle");
            setPublishError("");
            setCopied(false);
            setIsPublished(invitation.status === "published");
            setPaymentProcessingState("idle");
            setPaymentError("");
            setLoadingPaymentInfo(true);

            fetch(`/api/payments/status?invitationId=${invitation.id}`)
                .then((res) => {
                    if (!res.ok) throw new Error("Failed to load pricing information");
                    return res.json();
                })
                .then((data: PaymentInfo) => {
                    setPaymentInfo(data);
                })
                .catch((err: unknown) => {
                    console.error("Error loading payment status:", err);
                    setPaymentError("Could not retrieve pricing details. Please check your network connection.");
                })
                .finally(() => {
                    setLoadingPaymentInfo(false);
                });
        }, 0);

        return () => window.clearTimeout(timeout);
    }, [isOpen, invitation.id, invitation.slug, invitation.status]);

    // Validation check on slug change
    useEffect(() => {
        if (!isOpen || isPublished) return;
        if (slug === invitation.slug) {
            const timeout = window.setTimeout(() => {
                setStatus("idle");
            }, 0);
            return () => window.clearTimeout(timeout);
        }

        if (checkTimeoutRef.current) {
            clearTimeout(checkTimeoutRef.current);
            checkTimeoutRef.current = null;
        }

        const cleanSlug = slug.toLowerCase().trim();
        const setValidationState = (nextStatus: SlugStatus) => {
            const timeout = window.setTimeout(() => {
                setStatus(nextStatus);
            }, 0);
            return () => window.clearTimeout(timeout);
        };

        if (cleanSlug.length < 3) {
            return setValidationState("invalid");
        }

        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
            return setValidationState("invalid");
        }

        const statusTimeout = window.setTimeout(() => {
            setStatus("checking");
        }, 0);

        checkTimeoutRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/invitations/check-slug?slug=${cleanSlug}&excludeId=${invitation.id}`);
                const data = await res.json();
                if (data.status === "available") {
                    setStatus("available");
                } else if (data.status === "taken") {
                    setStatus("taken");
                } else {
                    setStatus("invalid");
                }
            } catch {
                setStatus("idle");
            }
        }, 500);

        return () => {
            window.clearTimeout(statusTimeout);
            if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
        };
    }, [slug, invitation.slug, invitation.id, isOpen, isPublished]);

    if (typeof document === "undefined") return null;

    // Front-end validation before publishing
    const validationErrors: string[] = [];
    if (!invitation.title?.trim()) validationErrors.push("Title is required");
    if (!invitation.primaryName?.trim()) validationErrors.push("Host/Couple name is required");
    if (!invitation.eventDate) validationErrors.push("Event date is required");
    if (!invitation.venueName?.trim()) validationErrors.push("Venue name is required");
    if (!invitation.phone?.trim()) validationErrors.push("Primary phone is required");
    else if (invitation.phone.length !== 10) validationErrors.push("Primary phone must be 10 digits");
    if (!invitation.secondaryPhone?.trim()) validationErrors.push("Secondary phone is required");
    else if (invitation.secondaryPhone.length !== 10) validationErrors.push("Secondary phone must be 10 digits");
    if (!invitation.message?.trim()) validationErrors.push("Invitation message is required");

    const hasValidationErrors = validationErrors.length > 0;
    const isSlugTakenOrInvalid = slug !== invitation.slug && (status === "taken" || status === "invalid");
    
    // Can trigger publication or checkout if details are complete and state is ready
    const isBusy = isPublishing || loadingPaymentInfo || paymentProcessingState !== "idle";
    const canPublishOrPay = !hasValidationErrors && !isSlugTakenOrInvalid && !isBusy;

    const currentSlug = isPublished ? invitation.slug : slug;
    const publicUrl = getPublicInvitationUrl(currentSlug);

    // Triggers Razorpay Checkout & verification
    async function handlePaymentAndPublish() {
        if (!canPublishOrPay || !paymentInfo) return;
        setPublishError("");
        setPaymentError("");

        // 1. If it is already paid or template is free, publish directly
        if (paymentInfo.alreadyPaid || paymentInfo.isFree) {
            handlePublish();
            return;
        }

        // 2. Otherwise, initiate Razorpay order
        setPaymentProcessingState("creatingOrder");
        try {
            const orderRes = await fetch("/api/payments/razorpay/order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    invitationId: invitation.id,
                    slug: slug.toLowerCase().trim(),
                }),
            });

            const orderData = await orderRes.json();
            if (!orderRes.ok) {
                throw new Error(orderData.error || "Failed to initialize payment order");
            }

            if (orderData.status === "alreadyPaid") {
                setPaymentInfo(prev => prev ? { ...prev, alreadyPaid: true } : null);
                handlePublish();
                return;
            }

            if (orderData.status === "freePublish") {
                setPaymentInfo(prev => prev ? { ...prev, isFree: true } : null);
                handlePublish();
                return;
            }

            // 3. Load Razorpay Checkout Script
            setPaymentProcessingState("openingCheckout");
            const isScriptLoaded = await loadScript();
            if (!isScriptLoaded) {
                throw new Error("Unable to load payment portal script. Please check your connection.");
            }

            // 4. Initialize Razorpay Checkout Modal
            const options = {
                key: orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency,
                name: orderData.name,
                description: orderData.description,
                order_id: orderData.orderId,
                handler: async function (response: RazorpayPaymentResponse) {
                    setPaymentProcessingState("verifyingPayment");
                    try {
                        const verifyRes = await fetch("/api/payments/razorpay/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                invitationId: invitation.id,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                slug: slug.toLowerCase().trim(),
                            }),
                        });

                        const verifyData = await verifyRes.json();
                        
                        if (verifyRes.ok && verifyData.status === "success") {
                            setPaymentProcessingState("paymentSuccess");
                            setIsPublished(true);
                            setPaymentInfo(prev => prev ? { ...prev, alreadyPaid: true } : null);
                            onPublishSuccess({
                                slug: verifyData.slug,
                                status: "published",
                                published_at: new Date().toISOString(),
                            });
                        } else if (verifyData.status === "paymentPaidPublishFailed") {
                            // Payment processed but publishing failed (e.g. slug collision).
                            // User is now marked as already paid so they can choose a new slug and retry publishing.
                            setPaymentInfo(prev => prev ? { ...prev, alreadyPaid: true } : null);
                            setPaymentProcessingState("idle");
                            setPublishError(verifyData.message || verifyData.error);
                            onPublishSuccess({
                                slug: invitation.slug,
                                status: invitation.status || "draft",
                                published_at: invitation.publishedAt || null,
                            });
                        } else {
                            throw new Error(verifyData.error || "Payment verification failed");
                        }
                    } catch (verifyErr: unknown) {
                        console.error(verifyErr);
                        setPaymentProcessingState("failed");
                        setPaymentError(verifyErr instanceof Error ? verifyErr.message : "Failed to verify transaction. Please contact support.");
                    }
                },
                modal: {
                    ondismiss: function () {
                        setPaymentProcessingState("idle");
                    },
                },
                prefill: {
                    contact: invitation.phone || undefined,
                },
                theme: {
                    color: invitation.theme?.primaryColor || "#b99aad",
                },
                config: {
                    display: {
                        blocks: {
                            banks: {
                                name: "All Payment Options",
                                instruments: [
                                    {
                                        method: "upi",
                                    },
                                    {
                                        method: "card",
                                    },
                                    {
                                        method: "netbanking",
                                    },
                                    {
                                        method: "wallet",
                                    },
                                ],
                            },
                        },
                        sequence: ["block.banks"],
                        preferences: {
                            show_default_blocks: false,
                        },
                    },
                },
            };

            const Razorpay = (window as RazorpayWindow).Razorpay;
            if (!Razorpay) {
                throw new Error("Unable to open payment portal. Please try again.");
            }
            const rzp = new Razorpay(options);
            rzp.on("payment.failed", function (response: RazorpayFailureResponse) {
                console.error("Payment failure callback:", response.error);
                setPaymentProcessingState("failed");
                setPaymentError(response.error.description || "Payment failed. Please try again.");
            });
            rzp.open();
        } catch (err: unknown) {
            console.error(err);
            setPaymentProcessingState("idle");
            setPaymentError(err instanceof Error ? err.message : "Failed to initiate payment");
        }
    }

    // Traditional publishing for free templates or already-paid invitations
    async function handlePublish() {
        if (!canPublishOrPay) return;
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

    // Handles unpublishing back to draft status
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
                            <div className="publishModalBannerCopy">
                                <span className="publishModalHeaderIcon" aria-hidden="true">
                                    <PartyPopper size={26} />
                                </span>
                                <div>
                                    <h2 className="publishModalBannerTitle">
                                        {isPublished ? "Invitation is Live!" : "Publish Invitation"}
                                    </h2>
                                    <p className="publishModalBannerSub">
                                        {isPublished ? "Share your link with guests!" : "Review your details and go live."}
                                    </p>
                                </div>
                            </div>
                            <button className="publishModalClose" onClick={onClose} aria-label="Close" disabled={isBusy}>
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

                            {paymentError && (
                                <div className="publishModalError">
                                    <AlertTriangle size={15} />
                                    <span>{paymentError}</span>
                                </div>
                            )}

                            {loadingPaymentInfo ? (
                                <div className="publishModalLoadingState">
                                    <Loader2 className="spinner" size={24} />
                                    <p>Loading price specifications...</p>
                                </div>
                            ) : !isPublished ? (
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

                                    {/* Pricing & Premium Template details card */}
                                    {paymentInfo && (
                                        <div className="publishTemplateSummary">
                                            <div className="pricingDetailBlock">
                                                {paymentInfo.alreadyPaid ? (
                                                    <div className="alreadyPaidStatusTag">
                                                        <ShieldCheck size={16} />
                                                        <span>Template already paid</span>
                                                    </div>
                                                ) : paymentInfo.isFree ? (
                                                    <div className="freePricingLabel">
                                                        <span className="priceLabelText">Publishing Price:</span>
                                                        <strong className="freePriceVal">Free Template</strong>
                                                    </div>
                                                ) : (
                                                    <div className="premiumPricingContainer">
                                                        <div className="premiumPricingLabel">
                                                            <span className="priceLabelText">Publishing Price</span>
                                                            <strong className="priceValText">{formatPaiseToCurrency(paymentInfo.pricePaise, paymentInfo.currency)}</strong>
                                                            <span className="paymentAssurancePill">
                                                                <ShieldCheck size={15} />
                                                                One-time payment · No hidden charges
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {!paymentInfo.isFree && !paymentInfo.alreadyPaid && (
                                                <div className="includedFeaturesList">
                                                    <div className="featuresTitleRow">
                                                        <p className="featuresTitle">Included with Premium</p>
                                                        <span />
                                                        <i aria-hidden="true" />
                                                    </div>
                                                    <ul>
                                                        <li>
                                                            <span className="checkIconWrapper">
                                                                <Check size={12} strokeWidth={3} />
                                                            </span>
                                                            <span>Customizable URL slug</span>
                                                        </li>
                                                        <li>
                                                            <span className="checkIconWrapper">
                                                                <Check size={12} strokeWidth={3} />
                                                            </span>
                                                            <span>Sound Effects & Background Music</span>
                                                        </li>
                                                        <li>
                                                            <span className="checkIconWrapper">
                                                                <Check size={12} strokeWidth={3} />
                                                            </span>
                                                            <span>Interactive Maps Navigation</span>
                                                        </li>
                                                        <li>
                                                            <span className="checkIconWrapper">
                                                                <Check size={12} strokeWidth={3} />
                                                            </span>
                                                            <span>RSVP Manager & Guest Wishes</span>
                                                        </li>
                                                        <li>
                                                            <span className="checkIconWrapper">
                                                                <Check size={12} strokeWidth={3} />
                                                            </span>
                                                            <span>Fast mobile loading speeds</span>
                                                        </li>
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}



                                    <div className="publishActions">
                                        <button
                                            className="publishBtnCancel"
                                            onClick={onClose}
                                            disabled={isBusy}
                                        >
                                            Cancel
                                        </button>
                                        
                                        {paymentInfo?.isFree || paymentInfo?.alreadyPaid ? (
                                            <button
                                                className="publishBtnPrimary"
                                                onClick={handlePublish}
                                                disabled={!canPublishOrPay}
                                            >
                                                {isPublishing ? (
                                                    <><Loader2 size={16} className="spinner" /> Publishing…</>
                                                ) : (
                                                    <><Rocket size={16} /> Publish Now</>
                                                )}
                                            </button>
                                        ) : (
                                            <button
                                                className="publishBtnPrimary payAndPublishBtn"
                                                onClick={handlePaymentAndPublish}
                                                disabled={!canPublishOrPay}
                                            >
                                                {paymentProcessingState === "creatingOrder" && (
                                                    <><Loader2 size={16} className="spinner" /> Processing Order…</>
                                                )}
                                                {paymentProcessingState === "openingCheckout" && (
                                                    <><Loader2 size={16} className="spinner" /> Opening Checkout…</>
                                                )}
                                                {paymentProcessingState === "verifyingPayment" && (
                                                    <><Loader2 size={16} className="spinner" /> Verifying Payment…</>
                                                )}
                                                {paymentProcessingState === "idle" && (
                                                    <><LockKeyhole size={16} /> {paymentInfo ? `Pay ${formatPaiseToCurrency(paymentInfo.pricePaise, paymentInfo.currency)}` : "Pay"} & Publish</>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    {!paymentInfo?.isFree && !paymentInfo?.alreadyPaid && (
                                        <p className="securePaymentText">
                                            <LockKeyhole size={13} />
                                            Secure payment powered by Razorpay
                                        </p>
                                    )}
                                </>
							) : (
                                <div className="publishSuccessState">
                                    <div className="publishSuccessBanner">
                                        <p className="successSubtitle">Your invitation website is officially live. Share the public link with guests!</p>
                                    </div>

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
                                            <ExternalLink size={15} /> Open Invitation
                                        </a>
                                    </div>

                                    <div className="unpublishZone">
                                        <p>Need to make changes? You can unpublish to return it to draft status, edit, and republish anytime for free.</p>
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
