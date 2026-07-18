"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import TemplateRenderer from "@/components/TemplateRenderer";
import { InvitationData, RSVPStatus } from "@/types/invitation";
import { trackInvitationEvent, AnalyticsEventType } from "@/lib/analytics";

type Props = {
    invitation: InvitationData;
    isPublic?: boolean;
};

type StoredRsvp = {
    id: string;
    status: RSVPStatus;
};

const RSVP_TOKEN_PREFIX = "vilique:rsvp-token:";
const RSVP_STATUS_PREFIX = "vilique:rsvp-status:";
const PUBLIC_INVITE_BACKGROUND =
    "radial-gradient(ellipse at 0% 0%, rgba(200, 160, 220, 0.35) 0%, transparent 45%), radial-gradient(ellipse at 50% 100%, rgba(240, 180, 200, 0.4) 0%, transparent 50%), linear-gradient(135deg, #f5eaff 0%, #ecdcf7 35%, #fce8f0 70%, #e8f4ff 100%)";
const PUBLIC_INVITE_BACKGROUND_COLOR = "#ecdcf7";

export default function PublicInviteExperience({ invitation, isPublic = false }: Props) {
    const [accepted, setAccepted] = useState(false);
    const [rsvpStatus, setRsvpStatus] = useState<RSVPStatus | null>(null);
    const [isChangingResponse, setIsChangingResponse] = useState(false);
    const [isRsvpSubmitting, setIsRsvpSubmitting] = useState(false);
    const [resolvedRsvpInvitationId, setResolvedRsvpInvitationId] = useState(isPublic ? "" : invitation.id);
    const shellRef = useRef<HTMLDivElement>(null);
    const topAnchorRef = useRef<HTMLDivElement>(null);
    const previousVisibleScreenRef = useRef<boolean | null>(null);
    const guestTokenRef = useRef("");
    const rsvpRequestIdRef = useRef(0);
    const acceptVisualTimeoutRef = useRef<number | null>(null);
    const showAccepted = accepted || (rsvpStatus === "accepted" && !isChangingResponse);
    const isInitialRsvpResolved = !isPublic || resolvedRsvpInvitationId === invitation.id;

    useLayoutEffect(() => {
        if (!isPublic) return;

        const storedRsvpStatus = getStoredRsvpStatus(invitation.id);
        if (storedRsvpStatus || !getStoredGuestToken(invitation.id)) {
            /* eslint-disable react-hooks/set-state-in-effect -- intentional: this
               localStorage check must resolve the initial public screen before paint
               when the browser already has a verified RSVP status, or when there
               is no token and therefore no possible stored RSVP for this browser. */
            setRsvpStatus(storedRsvpStatus);
            setAccepted(storedRsvpStatus === "accepted");
            setIsChangingResponse(false);
            setResolvedRsvpInvitationId(invitation.id);
            /* eslint-enable react-hooks/set-state-in-effect */
        }

        const previousHtmlBackground = document.documentElement.style.background;
        const previousHtmlBackgroundColor = document.documentElement.style.backgroundColor;
        const previousHtmlMinHeight = document.documentElement.style.minHeight;
        const previousBodyBackground = document.body.style.background;
        const previousBodyBackgroundColor = document.body.style.backgroundColor;
        const previousBodyMinHeight = document.body.style.minHeight;

        document.documentElement.classList.add("publicInviteDocumentBackground");
        document.body.classList.add("publicInviteDocumentBackground");
        document.documentElement.style.background = PUBLIC_INVITE_BACKGROUND;
        document.documentElement.style.backgroundColor = PUBLIC_INVITE_BACKGROUND_COLOR;
        document.documentElement.style.minHeight = "100%";
        document.body.style.background = PUBLIC_INVITE_BACKGROUND;
        document.body.style.backgroundColor = PUBLIC_INVITE_BACKGROUND_COLOR;
        document.body.style.minHeight = "100%";

        return () => {
            document.documentElement.classList.remove("publicInviteDocumentBackground");
            document.body.classList.remove("publicInviteDocumentBackground");
            document.documentElement.style.background = previousHtmlBackground;
            document.documentElement.style.backgroundColor = previousHtmlBackgroundColor;
            document.documentElement.style.minHeight = previousHtmlMinHeight;
            document.body.style.background = previousBodyBackground;
            document.body.style.backgroundColor = previousBodyBackgroundColor;
            document.body.style.minHeight = previousBodyMinHeight;
        };
    }, [invitation.id, isPublic]);

    useEffect(() => {
        if (isPublic) {
            void trackInvitationEvent(invitation.id, "view");
        }
    }, [invitation.id, isPublic]);

    useEffect(() => {
        if (!isInitialRsvpResolved) {
            return;
        }

        if (previousVisibleScreenRef.current === null) {
            previousVisibleScreenRef.current = showAccepted;
            return;
        }

        if (previousVisibleScreenRef.current !== showAccepted) {
            previousVisibleScreenRef.current = showAccepted;
            schedulePublicInviteScrollReset(shellRef.current, topAnchorRef.current);
            if (isPublic && invitation.templateId === "pastel-floral-wedding") {
                scheduleIosWebKitVisualViewportNudge();
            }
        }
    }, [invitation.templateId, isInitialRsvpResolved, isPublic, showAccepted]);

    useEffect(() => {
        if (!isPublic) {
            return;
        }

        const existingToken = getStoredGuestToken(invitation.id);
        const token = existingToken || getOrCreateGuestToken(invitation.id);
        guestTokenRef.current = token;

        if (!existingToken) {
            return;
        }

        const lookupRequestId = rsvpRequestIdRef.current;

        const controller = new AbortController();
        const params = new URLSearchParams({
            invitationId: invitation.id,
            guestToken: token,
        });

        fetch(`/api/rsvps?${params.toString()}`, { signal: controller.signal })
            .then((response) => response.ok ? response.json() : null)
            .then((payload: { rsvp?: StoredRsvp | null } | null) => {
                if (lookupRequestId !== rsvpRequestIdRef.current) return;
                const nextStatus = payload?.rsvp?.status || null;
                const isChangingStoredResponse = getIsChangingResponse();
                setStoredRsvpStatus(invitation.id, nextStatus);
                setRsvpStatus(nextStatus);
                setAccepted(nextStatus === "accepted" && !isChangingStoredResponse);
                setIsChangingResponse(isChangingStoredResponse);
                setResolvedRsvpInvitationId(invitation.id);
            })
            .catch(() => {
                if (lookupRequestId !== rsvpRequestIdRef.current) return;
                setResolvedRsvpInvitationId(invitation.id);
            });

        return () => controller.abort();
    }, [invitation.id, isPublic]);

    useEffect(() => {
        return () => {
            if (acceptVisualTimeoutRef.current) {
                window.clearTimeout(acceptVisualTimeoutRef.current);
            }
        };
    }, []);

    function submitRsvp(nextStatus: RSVPStatus, options: { keepalive?: boolean; keepChangingResponse?: boolean } = {}) {
        const requestId = rsvpRequestIdRef.current + 1;
        rsvpRequestIdRef.current = requestId;
        const shouldAccept = nextStatus === "accepted";
        if (!options.keepChangingResponse) {
            clearIsChangingResponse();
        }
        if (acceptVisualTimeoutRef.current) {
            window.clearTimeout(acceptVisualTimeoutRef.current);
            acceptVisualTimeoutRef.current = null;
        }
        if (shouldAccept) {
            // showAccepted = accepted || (rsvpStatus==="accepted" && !isChangingResponse).
            // If rsvpStatus is already "accepted" (Change RSVP → Accept again), clearing
            // isChangingResponse below would instantly flip showAccepted=true, causing the
            // scroll reset and Thanks card to appear before the sparkle animation plays.
            // Guard against that by resetting rsvpStatus to null — but ONLY when it is
            // "accepted". When it is "declined" (Accept Instead path), clearing it would
            // replace the Accept Instead button with the normal Accept+Decline pair during
            // the entire 620ms animation, causing the visible flicker this fix resolves.
            if (rsvpStatus === "accepted") {
                setRsvpStatus(null);
            }
            setIsChangingResponse(false);
            acceptVisualTimeoutRef.current = window.setTimeout(() => {
                acceptVisualTimeoutRef.current = null;
                if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                }
                setAccepted(true);
                setRsvpStatus("accepted");
            }, 620);
        } else {
            setAccepted(false);
            setRsvpStatus(nextStatus);
        }
        setIsChangingResponse(Boolean(options.keepChangingResponse));

        if (!isPublic) {
            return;
        }

        setIsRsvpSubmitting(true);

        const token = guestTokenRef.current || getOrCreateGuestToken(invitation.id);
        guestTokenRef.current = token;

        void fetch("/api/rsvps", {
            method: "POST",
            keepalive: options.keepalive,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                invitationId: invitation.id,
                guestToken: token,
                guestName: "Guest",
                status: nextStatus,
                guestCount: 1,
            }),
        })
            .then((response) => response.ok ? response.json() : Promise.reject(response))
            .then((payload: { rsvp?: StoredRsvp | null }) => {
                if (requestId !== rsvpRequestIdRef.current) return;
                const persistedStatus = payload.rsvp?.status || nextStatus;
                if (persistedStatus === "accepted" && acceptVisualTimeoutRef.current) {
                    setStoredRsvpStatus(invitation.id, persistedStatus);
                    setIsRsvpSubmitting(false);
                    return;
                }
                setStoredRsvpStatus(invitation.id, persistedStatus);
                setRsvpStatus(persistedStatus);
                setAccepted(persistedStatus === "accepted");
                setIsChangingResponse(Boolean(options.keepChangingResponse && persistedStatus === "accepted"));
                clearIsChangingResponse();
                setIsRsvpSubmitting(false);
            })
            .catch(() => {
                if (requestId !== rsvpRequestIdRef.current) return;
                if (acceptVisualTimeoutRef.current) {
                    window.clearTimeout(acceptVisualTimeoutRef.current);
                    acceptVisualTimeoutRef.current = null;
                }
                setAccepted(false);
                setRsvpStatus(options.keepChangingResponse ? nextStatus : null);
                setIsChangingResponse(Boolean(options.keepChangingResponse));
                setIsRsvpSubmitting(false);
            });
    }

    function handleAnalyticsEvent(eventType: AnalyticsEventType) {
        if (isPublic) {
            void trackInvitationEvent(invitation.id, eventType);
        }
    }

    return (
        <div className="invitePreviewShell" ref={shellRef}>
            <div className="publicInviteScrollAnchor" ref={topAnchorRef} aria-hidden="true" />
            {isInitialRsvpResolved ? (
                <TemplateRenderer
                    invitation={invitation}
                    accepted={showAccepted}
                    rsvpStatus={isPublic ? rsvpStatus : null}
                    onAccept={() => submitRsvp("accepted")}
                    onDecline={() => submitRsvp("declined")}
                    onChangeRsvp={() => {
                        if (acceptVisualTimeoutRef.current) {
                            window.clearTimeout(acceptVisualTimeoutRef.current);
                            acceptVisualTimeoutRef.current = null;
                        }
                        if (isPublic) {
                            setIsChangingResponseFlag();
                            rsvpRequestIdRef.current += 1;
                            setIsRsvpSubmitting(false);
                            setAccepted(false);
                            setIsChangingResponse(true);
                            return;
                        }
                        setAccepted(false);
                        setIsChangingResponse(true);
                    }}
                    onEvent={handleAnalyticsEvent}
                    enableAudio={true}
                    rsvpProcessing={isRsvpSubmitting}
                />
            ) : (
                <PublicInviteInitialLoader invitation={invitation} />
            )}
        </div>
    );
}

function PublicInviteInitialLoader({ invitation }: { invitation: InvitationData }) {
    const isWedding = invitation.category === "wedding";

    return (
        <div className="templateLoaderOverlay pastelWeddingPage" role="status" aria-live="polite">
            <div className="templateLoaderCard">
                <div className="templateLoaderRings" aria-hidden="true">
                    <div className="ring1" />
                    <div className="ring2" />
                    <div className="heartCenter" />
                </div>
                <p className="loaderCoupleName">
                    {invitation.primaryName} {invitation.secondaryName ? `& ${invitation.secondaryName}` : ""}
                </p>
                <p className="loaderStatusText">
                    {isWedding ? "Opening Wedding Invitation" : "Opening Invitation"}
                </p>
                <div className="loaderLine" />
            </div>
        </div>
    );
}

function schedulePublicInviteScrollReset(shell: HTMLElement | null, anchor: HTMLElement | null) {
    const run = () => resetPublicInviteScroll(shell, anchor);
    run();
    window.requestAnimationFrame(() => {
        run();
        window.requestAnimationFrame(() => {
            run();
        });
    });
    window.setTimeout(run, 80);
    window.setTimeout(run, 220);
    window.setTimeout(() => {
        run();
    }, 500);
}

function resetPublicInviteScroll(shell: HTMLElement | null, anchor: HTMLElement | null) {
    const scrollOptions: ScrollToOptions = { top: 0, left: 0, behavior: "auto" };
    const scrollingElement = document.scrollingElement || document.documentElement;

    // Suppress smooth-scroll on all containers before resetting.
    // scrollingElement is document.body on Safari, document.documentElement elsewhere.
    const prevHtmlBehavior = document.documentElement.style.scrollBehavior;
    const prevBodyBehavior = document.body.style.scrollBehavior;
    const prevHtmlAnchor = document.documentElement.style.overflowAnchor;
    const prevBodyAnchor = document.body.style.overflowAnchor;
    const scrollingIsHtml = scrollingElement === document.documentElement;
    const scrollingIsBody = scrollingElement === document.body;

    if (!scrollingIsHtml && !scrollingIsBody && scrollingElement instanceof HTMLElement) {
        (scrollingElement as HTMLElement).style.scrollBehavior = "auto";
    }
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.scrollBehavior = "auto";
    document.documentElement.style.overflowAnchor = "none";
    document.body.style.overflowAnchor = "none";

    try {
        anchor?.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });

        // Reset window and the document scrolling element unconditionally.
        // html/body may report overflow:visible yet still be the viewport scroll container.
        window.scrollTo(0, 0);
        window.scrollTo(scrollOptions);
        scrollingElement.scrollTo(scrollOptions);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;

        // Walk ancestors and reset any scrolled containers.
        // Do NOT gate on overflow:auto/scroll — html/body would be skipped incorrectly.
        let current: HTMLElement | null = shell;
        while (current) {
            current.scrollTo(scrollOptions);
            current.scrollTop = 0;
            current = current.parentElement;
        }
    } finally {
        // Defer restoration to a later tick to ensure WebKit applies the instant scroll
        // before scrollBehavior is restored to smooth.
        window.requestAnimationFrame(() => {
            document.documentElement.style.scrollBehavior = prevHtmlBehavior;
            document.body.style.scrollBehavior = prevBodyBehavior;
            document.documentElement.style.overflowAnchor = prevHtmlAnchor;
            document.body.style.overflowAnchor = prevBodyAnchor;
            if (!scrollingIsHtml && !scrollingIsBody && scrollingElement instanceof HTMLElement) {
                (scrollingElement as HTMLElement).style.scrollBehavior = "";
            }
        });
    }
}

function scheduleIosWebKitVisualViewportNudge() {
    if (!isIosWebKit() || !window.visualViewport) return;

    let didNudge = false;
    let fallbackTimeout = 0;
    let cleanupTimeout = 0;

    const cleanup = () => {
        window.visualViewport?.removeEventListener("resize", runNudge);
        window.clearTimeout(fallbackTimeout);
        window.clearTimeout(cleanupTimeout);
    };

    const runNudge = () => {
        if (didNudge) return;
        didNudge = true;
        window.scrollTo(0, 1);
        window.requestAnimationFrame(() => {
            window.scrollTo(0, 0);
        });
    };

    window.visualViewport.addEventListener("resize", runNudge, { passive: true });
    fallbackTimeout = window.setTimeout(runNudge, 160);
    cleanupTimeout = window.setTimeout(cleanup, 1200);
}

function isIosWebKit() {
    if (typeof navigator === "undefined") return false;

    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const isIosDevice =
        /iP(hone|ad|od)/.test(platform) ||
        (/Mac/.test(platform) && navigator.maxTouchPoints > 1);
    const isWebKit = /AppleWebKit/.test(userAgent);

    return isIosDevice && isWebKit;
}

function getOrCreateGuestToken(invitationId: string) {
    const storageKey = `${RSVP_TOKEN_PREFIX}${invitationId}`;

    try {
        const existing = getStoredGuestToken(invitationId);
        if (existing && existing.length >= 16) return existing;

        const nextToken = crypto.randomUUID();
        localStorage.setItem(storageKey, nextToken);
        return nextToken;
    } catch {
        return crypto.randomUUID();
    }
}

function getStoredGuestToken(invitationId: string) {
    if (typeof localStorage === "undefined") return null;

    try {
        const existing = localStorage.getItem(`${RSVP_TOKEN_PREFIX}${invitationId}`);
        return existing && existing.length >= 16 ? existing : null;
    } catch {
        return null;
    }
}

function getStoredRsvpStatus(invitationId: string): RSVPStatus | null {
    if (typeof localStorage === "undefined") return null;

    try {
        const existing = localStorage.getItem(`${RSVP_STATUS_PREFIX}${invitationId}`);
        return isRsvpStatus(existing) ? existing : null;
    } catch {
        return null;
    }
}

function setStoredRsvpStatus(invitationId: string, status: RSVPStatus | null) {
    if (typeof localStorage === "undefined") return;

    try {
        const storageKey = `${RSVP_STATUS_PREFIX}${invitationId}`;
        if (status) {
            localStorage.setItem(storageKey, status);
        } else {
            localStorage.removeItem(storageKey);
        }
    } catch {
        // Ignore blocked storage; the API lookup remains the source of truth.
    }
}

function isRsvpStatus(value: string | null): value is RSVPStatus {
    return value === "accepted" || value === "declined" || value === "maybe";
}

function getIsChangingResponse() {
    return false;
}

function setIsChangingResponseFlag() {
    // No-op: Do not persist transient editing state to sessionStorage to ensure
    // refreshing the page restores the Thanks screen for a saved RSVP.
}

function clearIsChangingResponse() {
    // No-op: Transient editing state is in-memory only.
}
