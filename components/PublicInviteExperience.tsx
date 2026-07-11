"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Share2 } from "lucide-react";
import TemplateRenderer from "@/components/TemplateRenderer";
import { InvitationData, RSVPStatus } from "@/types/invitation";
import { trackInvitationEvent, AnalyticsEventType } from "@/lib/analytics";
import { getPublicInvitationUrl } from "@/lib/config/site";

type Props = {
    invitation: InvitationData;
    isPublic?: boolean;
};

export default function PublicInviteExperience({ invitation, isPublic = false }: Props) {
    const [accepted, setAccepted] = useState(false);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (isPublic) {
            void trackInvitationEvent(invitation.id, "view");
        }
    }, [invitation.id, isPublic]);

    function submitRsvp(nextStatus: RSVPStatus) {
        startTransition(async () => {
            const response = await fetch("/api/rsvps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    invitationId: invitation.id,
                    guestName: "Guest",
                    guestPhone: "",
                    guestCount: 1,
                    status: nextStatus,
                    message: "",
                }),
            });

            if (!response.ok) return;

            setAccepted(nextStatus === "accepted");

            if (isPublic) {
                void trackInvitationEvent(invitation.id, "rsvp_submit");
            }
        });
    }

    async function handleShare() {
        const shareTitle = invitation.secondaryName
            ? `${invitation.primaryName} & ${invitation.secondaryName}'s Wedding Invitation`
            : invitation.title;
        const shareText = invitation.message || "You are invited to celebrate with us!";
        const shareUrl = getPublicInvitationUrl(invitation.slug);

        if (navigator.share) {
            try {
                await navigator.share({
                    title: shareTitle,
                    text: shareText,
                    url: shareUrl,
                });
                if (isPublic) void trackInvitationEvent(invitation.id, "share");
                return;
            } catch {
                // Fail-safe to fallback clipboard copy
            }
        }

        try {
            await navigator.clipboard.writeText(shareUrl);
            alert("Link copied to clipboard!");
            if (isPublic) void trackInvitationEvent(invitation.id, "share");
        } catch {
            // Clipboard fail
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
                enableAudio={!isPublic}
            />

            {isPublic && (
                <button
                    className="floatingShareBtn"
                    onClick={handleShare}
                    aria-label="Share invitation"
                    style={{
                        position: "fixed",
                        bottom: "24px",
                        right: "24px",
                        width: "48px",
                        height: "48px",
                        borderRadius: "999px",
                        background: "#fff",
                        border: "1.5px solid #d8cde8",
                        color: "#5c5070",
                        boxShadow: "0 8px 24px rgba(80, 50, 80, 0.16)",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                        zIndex: 999,
                        transition: "all 0.2s"
                    }}
                >
                    <Share2 size={20} />
                </button>
            )}
        </div>
    );
}
