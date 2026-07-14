"use client";

import AuthRequiredModal from "@/components/AuthRequiredModal";
import ProfileInvitationsList from "@/components/ProfileInvitationsList";
import { useScrollPreservation } from "./NavigationStateProvider";
import { useIsClient } from "@/hooks/useIsClient";

export default function InvitationsPageClient() {
    const isClient = useIsClient();
    
    // Register scroll preservation on this page path
    useScrollPreservation("/invitations");

    return (
        <main className="profilePage invitationsPage">
            {isClient ? <AuthRequiredModal next="/invitations" /> : null}

            <section className="profileInvitations profileInvitationsFull">
                <ProfileInvitationsList />
            </section>
        </main>
    );
}
