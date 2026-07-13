import {
    ClipboardCheck,
    Eye,
    PencilLine,
    UsersRound,
} from "lucide-react";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import ProfileCard from "@/components/ProfileCard";
import { getGreeting, getInitials, getProfilePageData } from "@/lib/profilePageData";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
    const { dashboard, profile, invitations } = await getProfilePageData();
    const displayName = profile?.name || "Guest";
    const initials = getInitials(displayName);
    const greeting = getGreeting();

    const stats = [
        {
            label: "Published",
            value: String(dashboard.published || invitations.filter((item) => item.status === "published").length),
            detail: "Live invitations",
            icon: ClipboardCheck,
            tone: "green",
        },
        {
            label: "Drafts",
            value: String(dashboard.drafts || invitations.filter((item) => item.status === "draft").length),
            detail: "Ready to refine",
            icon: PencilLine,
            tone: "orange",
        },
        {
            label: "Views",
            value: String(dashboard.views),
            detail: "Total invite views",
            icon: Eye,
            tone: "blue",
        },
        {
            label: "RSVPs",
            value: String(dashboard.rsvps),
            detail: "Guests responded",
            icon: UsersRound,
            tone: "rose",
        },
    ];

    const activePublishedCount = dashboard.published || invitations.filter((item) => item.status === "published").length;

    return (
        <main className="profilePage">
            <AuthRequiredModal next="/profile" />

            <section className="profileOverview" aria-label="Profile overview">
                <ProfileCard
                    profile={profile}
                    activePublishedCount={activePublishedCount}
                    totalSpent={dashboard.totalSpent || 0}
                    initials={initials}
                    greeting={greeting}
                />

                <section className="profileStats" aria-label="Invitation metrics">
                    {stats.map((item) => {
                        const Icon = item.icon;

                        return (
                            <article className={`profileStat ${item.tone}`} key={item.label}>
                                <span>
                                    <Icon size={24} aria-hidden="true" />
                                </span>
                                <div>
                                    <strong>{item.value}</strong>
                                    <b>{item.label}</b>
                                    <p>{item.detail}</p>
                                </div>
                            </article>
                        );
                    })}
                </section>
            </section>
        </main>
    );
}
