"use client";

import useSWR from "swr";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import ProfileInvitationsList from "@/components/ProfileInvitationsList";
import InvitationsLoading from "@/app/(app)/invitations/loading";
import { useScrollPreservation } from "./NavigationStateProvider";
import { useIsClient } from "@/hooks/useIsClient";

export default function InvitationsPageClient() {
    const isClient = useIsClient();

    const { data } = useSWR(isClient ? "/api/profile/dashboard" : null);
    
    // Register scroll preservation on this page path
    useScrollPreservation("/invitations");

    if (!isClient || !data) {
        return <InvitationsLoading />;
    }

    const invitations = data?.invitations || [];
    const invitationStats = data?.dashboard?.invitationStats || {};

    return (
        <main className="profilePage invitationsPage">
            <AuthRequiredModal next="/invitations" />

            <section className="profileInvitations profileInvitationsFull">
                <ProfileInvitationsList
                    initialInvitations={invitations}
                    invitationStats={invitationStats}
                />
            </section>
        </main>
    );
}
