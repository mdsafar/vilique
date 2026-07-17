import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { templates } from "@/data/templates";
import { createDefaultInvitation } from "@/lib/defaultInvitation";
import PastelFloralWedding from "@/components/templates/PastelFloralWedding";
import TemplatePreviewBackButton from "@/components/TemplatePreviewBackButton";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const template = templates.find((item) => item.id === id);

    return {
        title: template ? `${template.name} Preview` : "Template Preview",
        description: template?.description || "Preview a Vilique invitation template.",
    };
}

export default async function TemplatePreviewPage({ params }: Props) {
    const { id } = await params;
    const template = templates.find((item) => item.id === id);

    if (!template || template.id !== "pastel-floral-wedding") {
        notFound();
    }

    const invitation = {
        ...createDefaultInvitation(),
        templateId: template.id,
        title: template.name,
    };

    return (
        <div className="invitePreviewShell templateStandalonePreview">
            <TemplatePreviewBackButton templateId={template.id} />

            <PastelFloralWedding invitation={invitation} useDemoCountdown />
        </div>
    );
}
