"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { Eye, Loader2 } from "lucide-react";
import { getTemplatePreviewReturnKey } from "@/components/TemplatePreviewBackButton";

type TemplateLivePreviewLinkProps = {
    templateId: string;
};

export default function TemplateLivePreviewLink({ templateId }: TemplateLivePreviewLinkProps) {
    return (
        <Link
            className="secondaryBtn livePreviewLink"
            href={`/templates/${templateId}/preview`}
            prefetch={false}
            onClick={() => {
                window.sessionStorage.setItem(getTemplatePreviewReturnKey(templateId), `/templates/${templateId}`);
            }}
        >
            <LivePreviewLinkIcon />
            <span>Live Preview</span>
        </Link>
    );
}

function LivePreviewLinkIcon() {
    const { pending } = useLinkStatus();

    if (pending) {
        return <Loader2 size={17} className="spinner" aria-hidden="true" />;
    }

    return <Eye size={17} aria-hidden="true" />;
}
