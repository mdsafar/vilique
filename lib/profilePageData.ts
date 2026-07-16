import { getDashboardData } from "@/features/invitations/data";
import { InvitationData } from "@/types/invitation";

export const fallbackInvitations: InvitationData[] = [
    {
        id: "sample-wedding",
        slug: "name-1-name-2",
        category: "wedding",
        templateId: "pastel-floral-wedding",
        title: "Wedding Invitation",
        primaryName: "Name 1",
        secondaryName: "Name 2",
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

export async function getProfilePageData() {
    const dashboard = await getDashboardData();
    const profile = dashboard.profile;
    const invitations = dashboard.invitations.length ? dashboard.invitations : profile ? [] : fallbackInvitations;

    return {
        dashboard,
        profile,
        invitations,
    };
}

export function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
}

export function getInitials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "VQ";
}
