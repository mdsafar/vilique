export const siteConfig = {
    name: "Viliqu",
    shortName: "Viliqu",
    defaultTitle: "Viliqu — Invitation Websites Made Simple",
    titleTemplate: "%s | Viliqu",
    description:
        "Create beautiful, animated invitation websites in minutes with Viliqu.",
    packageDescription:
        "Create beautiful invitation websites in minutes with Viliqu.",
    tagline: "Create. Invite. Celebrate.",
    creatorLabel: "Created with Viliqu",
    url:
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000",
    keywords: [
        "Viliqu",
        "invitation website builder",
        "digital invitations",
        "wedding website builder",
        "birthday invitation",
        "engagement invitation",
        "housewarming invitation",
        "animated invitations",
        "RSVP website",
        "online invitation maker",
        "event invitation website",
    ],
} as const;

export function getPublicInvitationUrl(slug: string) {
    const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";
    return `${baseUrl}/i/${slug}`;
}
