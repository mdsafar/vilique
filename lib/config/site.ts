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
        getSiteUrl(),
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
    return `${getSiteUrl()}/i/${slug}`;
}

export function getSiteUrl() {
    const url = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
    const isProductionDeployment = process.env.VERCEL_ENV === "production" || process.env.APP_ENV === "production";

    if (isProductionDeployment && (!url || url.includes("localhost"))) {
        throw new Error("Production deployments require NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL with a non-localhost URL.");
    }

    return url || "http://localhost:3000";
}
