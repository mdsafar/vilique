import AuthRequiredModal from "@/components/AuthRequiredModal";
import ProfileInvitationsList from "@/components/ProfileInvitationsList";
import { getProfilePageData } from "@/lib/profilePageData";

export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
    const { dashboard, invitations } = await getProfilePageData();

    return (
        <main className="profilePage invitationsPage">
            <AuthRequiredModal next="/invitations" />

            <section className="profileInvitations profileInvitationsFull">
                <header>
                    <div>
                        <h2>Your invitations</h2>
                        <p>Manage and track all your invitation websites</p>
                    </div>
                </header>

                <ProfileInvitationsList
                    initialInvitations={invitations}
                    invitationStats={dashboard.invitationStats}
                />
            </section>
        </main>
    );
}
