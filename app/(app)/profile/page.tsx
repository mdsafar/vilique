import {
    ClipboardCheck,
    Eye,
    PencilLine,
    UsersRound,
} from "lucide-react";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import { getDashboardData } from "@/features/invitations/data";
import { InvitationData } from "@/types/invitation";
import ProfileInvitationsList from "@/components/ProfileInvitationsList";
import ProfileCard from "@/components/ProfileCard";

const fallbackInvitations: InvitationData[] = [
    {
        id: "sample-wedding",
        slug: "maya-arjun",
        category: "wedding",
        templateId: "pastel-floral-wedding",
        title: "Wedding Invitation",
        primaryName: "Maya",
        secondaryName: "Arjun",
        eventDate: "2027-02-14",
        eventTime: "05:30 PM",
        venueName: "",
        venueAddress: "",
        mapLink: "",
        message: "Invite you to celebrate our wedding",
        theme: {
            primaryColor: "#d8a0a0",
            secondaryColor: "#fff5ef",
            backgroundColor: "#fff8f3",
            textColor: "#171717",
            fontStyle: "serif",
        },
        status: "published",
        createdAt: "2026-07-10",
        updatedAt: "2026-07-10",
    },
    {
        id: "sample-housewarming",
        slug: "home-sweet-home",
        category: "housewarming",
        templateId: "housewarming",
        title: "Housewarming Invitation",
        primaryName: "Home Sweet Home",
        eventDate: "2027-05-28",
        eventTime: "06:00 PM",
        venueName: "",
        venueAddress: "",
        mapLink: "",
        message: "Join us as we celebrate our new home",
        theme: {
            primaryColor: "#91b9a6",
            secondaryColor: "#eef8f2",
            backgroundColor: "#f7fbf6",
            textColor: "#171717",
            fontStyle: "serif",
        },
        status: "draft",
        createdAt: "2026-07-08",
        updatedAt: "2026-07-08",
    },
];

export const dynamic = "force-dynamic";

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
}

export default async function ProfilePage() {
    const dashboard = await getDashboardData();
    const profile = dashboard.profile;
    const invitations = dashboard.invitations.length ? dashboard.invitations : profile ? [] : fallbackInvitations;
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

            <section className="profileInvitations">
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

function getInitials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "VQ";
}
