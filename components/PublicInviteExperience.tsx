"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import PastelFloralWedding from "@/components/templates/PastelFloralWedding";
import { InvitationData, RSVPStatus } from "@/types/invitation";

type Props = {
    invitation: InvitationData;
};

export default function PublicInviteExperience({ invitation }: Props) {
    const [accepted, setAccepted] = useState(false);
    const [guestName, setGuestName] = useState("");
    const [guestPhone, setGuestPhone] = useState("");
    const [guestCount, setGuestCount] = useState(1);
    const [wish, setWish] = useState("");
    const [status, setStatus] = useState("");
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        void trackEvent(invitation.id, "view");
    }, [invitation.id]);

    function submitRsvp(nextStatus: RSVPStatus) {
        startTransition(async () => {
            const fallbackName = guestName.trim() || "Guest";
            const response = await fetch("/api/rsvps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    invitationId: invitation.id,
                    guestName: fallbackName,
                    guestPhone,
                    guestCount,
                    status: nextStatus,
                    message: wish,
                }),
            });

            if (!response.ok) {
                setStatus("Could not submit RSVP. Please try again.");
                return;
            }

            setStatus("RSVP received");
            setAccepted(nextStatus === "accepted");
        });
    }

    function submitWish() {
        if (!wish.trim()) return;

        startTransition(async () => {
            const response = await fetch("/api/wishes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    invitationId: invitation.id,
                    guestName: guestName.trim() || "Guest",
                    message: wish,
                }),
            });

            setStatus(response.ok ? "Wish sent" : "Could not send wish.");
            if (response.ok) setWish("");
        });
    }

    return (
        <div className="invitePreviewShell">
            <Link className="inviteBackButton" href="/templates">
                Browse templates
            </Link>

            <PastelFloralWedding
                invitation={invitation}
                accepted={accepted}
                onAccept={() => submitRsvp("accepted")}
                onDecline={() => submitRsvp("declined")}
            />

            <section className="publicInvitePanel">
                <div>
                    <p className="eyebrow">RSVP</p>
                    <h2>Send your response</h2>
                </div>
                <label>
                    <span>Name</span>
                    <input value={guestName} onChange={(event) => setGuestName(event.target.value)} />
                </label>
                <label>
                    <span>Phone</span>
                    <input value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} />
                </label>
                <label>
                    <span>Guests</span>
                    <input
                        min={1}
                        max={10}
                        type="number"
                        value={guestCount}
                        onChange={(event) => setGuestCount(Number(event.target.value))}
                    />
                </label>
                <label>
                    <span>Wish</span>
                    <textarea value={wish} onChange={(event) => setWish(event.target.value)} />
                </label>
                <div className="publicInviteActions">
                    <button type="button" disabled={isPending} onClick={() => submitRsvp("accepted")}>
                        Accept
                    </button>
                    <button type="button" disabled={isPending} onClick={() => submitRsvp("maybe")}>
                        Maybe
                    </button>
                    <button type="button" disabled={isPending} onClick={submitWish}>
                        Send wish
                    </button>
                </div>
                {status ? <p className="publicInviteStatus">{status}</p> : null}
            </section>
        </div>
    );
}

async function trackEvent(invitationId: string, eventType: "view") {
    await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, eventType, metadata: {} }),
    }).catch(() => undefined);
}

