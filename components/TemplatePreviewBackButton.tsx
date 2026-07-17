"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type TemplatePreviewBackButtonProps = {
    templateId: string;
};

export function getTemplatePreviewReturnKey(templateId: string) {
    return `vilique-template-preview-return-${templateId}`;
}

export default function TemplatePreviewBackButton({ templateId }: TemplatePreviewBackButtonProps) {
    const router = useRouter();
    const fallbackHref = `/templates/${templateId}`;

    return (
        <button
            className="inviteBackButton"
            type="button"
            onClick={() => {
                const returnKey = getTemplatePreviewReturnKey(templateId);
                const expectedReturnPath = window.sessionStorage.getItem(returnKey);
                window.sessionStorage.removeItem(returnKey);

                if (expectedReturnPath === fallbackHref) {
                    router.back();
                    return;
                }

                router.replace(fallbackHref);
            }}
        >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Template</span>
        </button>
    );
}
