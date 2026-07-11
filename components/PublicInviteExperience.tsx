"use client";

import { useEffect, useState } from "react";
import TemplateRenderer from "@/components/TemplateRenderer";
import { InvitationData, RSVPStatus } from "@/types/invitation";
import { trackInvitationEvent, AnalyticsEventType } from "@/lib/analytics";

type Props = {
    invitation: InvitationData;
    isPublic?: boolean;
};

export default function PublicInviteExperience({ invitation, isPublic = false }: Props) {
    const [accepted, setAccepted] = useState(false);

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

    function submitRsvp(nextStatus: RSVPStatus) {
        setAccepted(nextStatus === "accepted");

        if (isPublic) {
            void trackInvitationEvent(invitation.id, "rsvp_submit", {
                status: nextStatus,
                source: "template_tap",
                createsRsvpRecord: false,
            });
        }
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
                accepted={accepted}
                onAccept={() => submitRsvp("accepted")}
                onDecline={() => submitRsvp("declined")}
                onEvent={handleAnalyticsEvent}
                enableAudio={true}
            />
        </div>
    );
}
