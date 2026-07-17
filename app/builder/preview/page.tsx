import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getBuilderInvitation } from "@/features/invitations/data";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import PublicInviteExperience from "@/components/PublicInviteExperience";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import BuilderSessionPreview from "@/components/BuilderSessionPreview";

type Props = {
    searchParams: Promise<{ id?: string; from?: string; local?: string; template?: string }>;
};

export const metadata: Metadata = {
    title: "Preview",
    description: "Preview your Vilique invitation draft.",
};

export default async function BuilderPreviewPage({ searchParams }: Props) {
    const { id, from, local, template } = await searchParams;

    if (!id) {
        if (local === "1") {
            return <BuilderSessionPreview templateId={template} />;
        }
        redirect("/templates");
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return (
            <main className="builderPreviewShell">
                <AuthRequiredModal
                    next={`/builder/preview?id=${id}${from ? `&from=${from}` : ""}`}
                    forceOpen
                />
            </main>
        );
    }

    const invitation = await getBuilderInvitation({ id });

    if (!invitation) {
        notFound();
    }

    const backHref = from === "invitations" ? "/invitations" : `/builder?id=${invitation.id}`;
    const backLabel = from === "invitations" ? "Back to Invitations" : "Back to Editor";

    return (
        <div className="builderPreviewShell">
            <div className="builderPreviewTopbar">
                <Link href={backHref} className="backToBuilderBtn">
                    <ArrowLeft size={16} />
                    <span>{backLabel}</span>
                </Link>
                <span className="draftBadge">Draft Preview</span>
            </div>

            <PublicInviteExperience invitation={invitation} isPublic={false} />
        </div>
    );
}
