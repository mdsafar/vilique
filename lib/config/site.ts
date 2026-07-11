export const siteConfig = {
    name: "Vilique",
    shortName: "Vilique",
    defaultTitle: "Vilique — Invitation Websites Made Simple",
    titleTemplate: "%s | Vilique",
    description:
        "Create beautiful, animated invitation websites in minutes with Vilique.",
    packageDescription:
        "Create beautiful invitation websites in minutes with Vilique.",
    tagline: "Create. Invite. Celebrate.",
    creatorLabel: "Created with Vilique",
    url:
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000",
    keywords: [
        "Vilique",
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
