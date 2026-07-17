"use client";

import { usePathname } from "next/navigation";
import TemplateDetailsSkeleton from "@/components/skeletons/TemplateDetailsSkeleton";
import TemplatePreviewSkeleton from "@/components/skeletons/TemplatePreviewSkeleton";

export default function TemplateDetailsRouteLoading() {
    const pathname = usePathname();

    if (pathname?.endsWith("/preview")) {
        return <TemplatePreviewSkeleton />;
    }

    return <TemplateDetailsSkeleton />;
}
