"use client";

import ProfileInvitationsList from "@/components/ProfileInvitationsList";
import { useScrollPreservation } from "./NavigationStateProvider";

export default function InvitationsPageClient() {
    // Register scroll preservation on this page path
    useScrollPreservation("/invitations");

    return (
        <main className="profilePage invitationsPage">
            <section className="profileInvitations profileInvitationsFull">
                <ProfileInvitationsList showAuthModalOnUnauthorized={false} />
            </section>
        </main>
    );
}
