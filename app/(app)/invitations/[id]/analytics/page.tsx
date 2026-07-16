import { notFound, redirect } from "next/navigation";
import InvitationAnalyticsClient from "@/components/InvitationAnalyticsClient";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import { getInvitationAnalytics } from "@/lib/invitationAnalytics";

type Props = {
    params: Promise<{ id: string }>;
};

export default async function InvitationAnalyticsPage({ params }: Props) {
    const { id } = await params;
    const result = await getInvitationAnalytics(id);

    if (result.status === "unauthorized") {
        return (
            <main className="profilePage analyticsPage">
                <AuthRequiredModal next={`/invitations/${id}/analytics`} forceOpen />
            </main>
        );
    }
    if (result.status === "not_found") notFound();
    if (result.status === "draft") redirect("/invitations");

    return (
        <main className="profilePage analyticsPage">
            <InvitationAnalyticsClient
                invitation={result.invitation}
                initialAnalytics={result.analytics}
            />
        </main>
    );
}
