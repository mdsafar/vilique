import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicInviteExperience from "@/components/PublicInviteExperience";
import { getPublishedInvitationBySlug } from "@/features/invitations/data";
import { siteConfig } from "@/lib/config/site";

type Props = {
    params: Promise<{
        slug: string;
    }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const invitation = await getPublishedInvitationBySlug(slug);

    if (!invitation) {
        return {
            title: "Invitation not found",
        };
    }

    const inviteTitle = invitation.secondaryName
        ? `${invitation.primaryName} & ${invitation.secondaryName}`
        : invitation.primaryName;
    const title = `${inviteTitle} ${invitation.title}`;
    const description = invitation.message || siteConfig.description;
    const url = `${siteConfig.url}/invite/${invitation.slug}`;

    return {
        title,
        description,
        alternates: {
            canonical: url,
        },
        openGraph: {
            type: "website",
            url,
            siteName: siteConfig.name,
            title,
            description,
        },
        twitter: {
            card: "summary",
            title,
            description,
        },
    };
}

export default async function PublicInvitePage({ params }: Props) {
    const { slug } = await params;
    const invitation = await getPublishedInvitationBySlug(slug);

    if (!invitation) notFound();

    return <PublicInviteExperience invitation={invitation} />;
}
