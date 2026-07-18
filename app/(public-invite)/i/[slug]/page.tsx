import { notFound } from "next/navigation";
import { getPublishedInvitationBySlug } from "@/features/invitations/data";
import PublicInviteExperience from "@/components/PublicInviteExperience";
import { Metadata } from "next";
import { Suspense } from "react";
import PublicInviteLoading from "./loading";

type Props = {
    params: Promise<{
        slug: string;
    }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const invitation = await getPublishedInvitationBySlug(slug);

    if (!invitation) {
        return {
            title: "Invitation Not Found",
        };
    }

    const inviteTitle = invitation.secondaryName
        ? `${invitation.primaryName} & ${invitation.secondaryName}`
        : invitation.primaryName;
    const title = `${inviteTitle} — ${invitation.title}`;
    const description = invitation.message || "You are invited to celebrate with us!";
    const shareImage = invitation.coverImageUrl || "";

    return {
        title,
        description,
        openGraph: {
            type: "website",
            title,
            description,
            images: shareImage ? [{ url: shareImage }] : undefined,
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: shareImage ? [shareImage] : undefined,
        },
    };
}

export default async function PublicInvitationSlugPage({ params }: Props) {
    return (
        <Suspense fallback={<PublicInviteLoading />}>
            {params.then(({ slug }) => (
                <InvitationContent slug={slug} />
            ))}
        </Suspense>
    );
}

async function InvitationContent({ slug }: { slug: string }) {
    const invitation = await getPublishedInvitationBySlug(slug);

    if (!invitation) {
        notFound();
    }

    return (
        <main className="publicInvitationWrapper">
            <PublicInviteExperience invitation={invitation} isPublic={true} />
        </main>
    );
}
