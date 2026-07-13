"use client";

import { useEffect, useRef, useState } from "react";
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

export default function PublicInviteExperience({ invitation, isPublic = false }: Props) {
    const [accepted, setAccepted] = useState(false);
    const [rsvpStatus, setRsvpStatus] = useState<RSVPStatus | null>(null);
    const [isChangingResponse, setIsChangingResponse] = useState(false);
    const guestTokenRef = useRef("");
    const showAccepted = accepted || (rsvpStatus === "accepted" && !isChangingResponse);

    useEffect(() => {
        if (!isPublic) return;

        const inviteBackground =
            "radial-gradient(ellipse at 0% 0%, rgba(200, 160, 220, 0.35) 0%, transparent 45%), radial-gradient(ellipse at 50% 100%, rgba(240, 180, 200, 0.4) 0%, transparent 50%), linear-gradient(135deg, #f5eaff 0%, #ecdcf7 35%, #fce8f0 70%, #e8f4ff 100%)";
        const previousHtmlBackground = document.documentElement.style.background;
        const previousBodyBackground = document.body.style.background;

        document.documentElement.style.background = inviteBackground;
        document.body.style.background = inviteBackground;

        return () => {
            document.documentElement.style.background = previousHtmlBackground;
            document.body.style.background = previousBodyBackground;
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
                setRsvpStatus(nextStatus);
                setAccepted(nextStatus === "accepted");
                setIsChangingResponse(false);
            })
            .catch(() => undefined);

        return () => controller.abort();
    }, [invitation.id, isPublic]);

    function submitRsvp(nextStatus: RSVPStatus) {
        const shouldAccept = nextStatus === "accepted";
        setAccepted(shouldAccept);
        setRsvpStatus(nextStatus);
        setIsChangingResponse(false);

        if (!isPublic) {
            return;
        }

        const token = guestTokenRef.current || getOrCreateGuestToken(invitation.id);
        guestTokenRef.current = token;

        void fetch("/api/rsvps", {
            method: "POST",
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
                setIsChangingResponse(false);
            })
            .catch(() => {
                setAccepted(false);
                setRsvpStatus(null);
                setIsChangingResponse(false);
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
