"use client";

import { usePathname } from "next/navigation";
import TemplateDetailsSkeleton from "@/components/skeletons/TemplateDetailsSkeleton";

export default function TemplateDetailsRouteLoading() {
    const pathname = usePathname();

    if (pathname?.endsWith("/preview")) {
        return null;
    }

    return <TemplateDetailsSkeleton />;
}
