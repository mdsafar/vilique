import { notFound, redirect } from "next/navigation";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import InvitationAnalyticsClient from "@/components/InvitationAnalyticsClient";
import { getInvitationAnalytics } from "@/lib/invitationAnalytics";

type Props = {
    params: Promise<{ id: string }>;
};

export default async function InvitationAnalyticsPage({ params }: Props) {
    const { id } = await params;
    const result = await getInvitationAnalytics(id);

    if (result.status === "unauthorized") redirect(`/login?next=/invitations/${id}/analytics`);
    if (result.status === "not_found") notFound();
    if (result.status === "draft") redirect("/invitations");

    return (
        <main className="profilePage analyticsPage">
            <AuthRequiredModal next={`/invitations/${id}/analytics`} />
            <InvitationAnalyticsClient
                invitation={result.invitation}
                initialAnalytics={result.analytics}
            />
        </main>
    );
}
