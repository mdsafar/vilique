"use client";

import ProfileInvitationsList, { ProfileInvitationsSkeleton } from "@/components/ProfileInvitationsList";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useScrollPreservation } from "./NavigationStateProvider";

export default function InvitationsPageClient() {
    // Register scroll preservation on this page path
    useScrollPreservation("/invitations");

    return (
        <ProtectedRoute
            next="/invitations"
            className="profilePage invitationsPage"
            fallback={<ProfileInvitationsSkeleton />}
        >
            <main className="profilePage invitationsPage">
                <section className="profileInvitations profileInvitationsFull">
                    <ProfileInvitationsList />
                </section>
            </main>
        </ProtectedRoute>
    );
}
