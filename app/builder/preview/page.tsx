import { notFound, redirect } from "next/navigation";
import { getBuilderInvitation } from "@/features/invitations/data";
import PublicInviteExperience from "@/components/PublicInviteExperience";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
    searchParams: Promise<{ id?: string }>;
};

export default async function BuilderPreviewPage({ searchParams }: Props) {
    const { id } = await searchParams;

    if (!id) {
        redirect("/templates");
    }

    const invitation = await getBuilderInvitation({ id });

    if (!invitation) {
        notFound();
    }

    return (
        <div className="builderPreviewShell">
            <div className="builderPreviewTopbar">
                <Link href={`/builder?id=${invitation.id}`} className="backToBuilderBtn">
                    <ArrowLeft size={16} />
                    <span>Back to Editor</span>
                </Link>
                <span className="draftBadge">Draft Preview</span>
            </div>

            <PublicInviteExperience invitation={invitation} isPublic={false} />
        </div>
    );
}
