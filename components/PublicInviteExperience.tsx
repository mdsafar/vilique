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
const RSVP_CHANGE_PREFIX = "vilique:rsvp-changing:";
const PUBLIC_INVITE_BACKGROUND =
    "radial-gradient(ellipse at 0% 0%, rgba(200, 160, 220, 0.35) 0%, transparent 45%), radial-gradient(ellipse at 50% 100%, rgba(240, 180, 200, 0.4) 0%, transparent 50%), linear-gradient(135deg, #f5eaff 0%, #ecdcf7 35%, #fce8f0 70%, #e8f4ff 100%)";
const PUBLIC_INVITE_BACKGROUND_COLOR = "#ecdcf7";

export default function PublicInviteExperience({ invitation, isPublic = false }: Props) {
    const [accepted, setAccepted] = useState(false);
    const [rsvpStatus, setRsvpStatus] = useState<RSVPStatus | null>(null);
    const [isChangingResponse, setIsChangingResponse] = useState(false);
    const guestTokenRef = useRef("");
    const showAccepted = accepted || (rsvpStatus === "accepted" && !isChangingResponse);

    useLayoutEffect(() => {
        if (!isPublic) return;

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
    }, [isPublic]);

    useEffect(() => {
        if (isPublic) {
            void trackInvitationEvent(invitation.id, "view");
        }
    }, [invitation.id, isPublic]);

    useEffect(() => {
        if (!isPublic) {
            return;
        }

        const token = getOrCreateGuestToken(invitation.id);
        guestTokenRef.current = token;

        const controller = new AbortController();
        const params = new URLSearchParams({
            invitationId: invitation.id,
            guestToken: token,
        });

        fetch(`/api/rsvps?${params.toString()}`, { signal: controller.signal })
            .then((response) => response.ok ? response.json() : null)
            .then((payload: { rsvp?: StoredRsvp | null } | null) => {
                const nextStatus = payload?.rsvp?.status || null;
                const isChangingStoredResponse = getIsChangingResponse(invitation.id);
                setRsvpStatus(nextStatus);
                setAccepted(nextStatus === "accepted" && !isChangingStoredResponse);
                setIsChangingResponse(isChangingStoredResponse);
            })
            .catch(() => undefined);

        return () => controller.abort();
    }, [invitation.id, isPublic]);

    function submitRsvp(nextStatus: RSVPStatus, options: { keepalive?: boolean; keepChangingResponse?: boolean } = {}) {
        const shouldAccept = nextStatus === "accepted";
        if (!options.keepChangingResponse) {
            clearIsChangingResponse(invitation.id);
        }
        setAccepted(shouldAccept);
        setRsvpStatus(nextStatus);
        setIsChangingResponse(Boolean(options.keepChangingResponse));

        if (!isPublic) {
            return;
        }

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
                const persistedStatus = payload.rsvp?.status || nextStatus;
                setRsvpStatus(persistedStatus);
                setAccepted(persistedStatus === "accepted");
                setIsChangingResponse(Boolean(options.keepChangingResponse && persistedStatus === "accepted"));
                clearIsChangingResponse(invitation.id);
            })
            .catch(() => {
                setAccepted(false);
                setRsvpStatus(options.keepChangingResponse ? nextStatus : null);
                setIsChangingResponse(Boolean(options.keepChangingResponse));
            });
    }

    function handleAnalyticsEvent(eventType: AnalyticsEventType) {
        if (isPublic) {
            void trackInvitationEvent(invitation.id, eventType);
        }
    }

    return (
        <div className="invitePreviewShell">
            <TemplateRenderer
                invitation={invitation}
                accepted={showAccepted}
                rsvpStatus={isPublic ? rsvpStatus : null}
                onAccept={() => submitRsvp("accepted")}
                onDecline={() => submitRsvp("declined")}
                onChangeRsvp={() => {
                    if (isPublic) {
                        setIsChangingResponseFlag(invitation.id);
                        submitRsvp("maybe", { keepalive: true, keepChangingResponse: true });
                        return;
                    }
                    setAccepted(false);
                    setIsChangingResponse(true);
                }}
                onEvent={handleAnalyticsEvent}
                enableAudio={true}
            />
        </div>
    );
}

function getOrCreateGuestToken(invitationId: string) {
    const storageKey = `${RSVP_TOKEN_PREFIX}${invitationId}`;

    try {
        const existing = localStorage.getItem(storageKey);
        if (existing && existing.length >= 16) return existing;

        const nextToken = crypto.randomUUID();
        localStorage.setItem(storageKey, nextToken);
        return nextToken;
    } catch {
        return crypto.randomUUID();
    }
}

function getIsChangingResponse(invitationId: string) {
    try {
        return sessionStorage.getItem(`${RSVP_CHANGE_PREFIX}${invitationId}`) === "true";
    } catch {
        return false;
    }
}

function setIsChangingResponseFlag(invitationId: string) {
    try {
        sessionStorage.setItem(`${RSVP_CHANGE_PREFIX}${invitationId}`, "true");
    } catch {
        // Ignore storage failures; the in-memory state still handles this session.
    }
}

function clearIsChangingResponse(invitationId: string) {
    try {
        sessionStorage.removeItem(`${RSVP_CHANGE_PREFIX}${invitationId}`);
    } catch {
        // Ignore storage failures; submitting the RSVP still updates the UI state.
    }
}
