"use client";

import useSWR from "swr";
import TemplatesCatalog from "@/components/TemplatesCatalog";
import TemplatesPageSkeleton from "@/components/skeletons/TemplatesPageSkeleton";
import { useScrollPreservation } from "./NavigationStateProvider";
import { useIsClient } from "@/hooks/useIsClient";

export default function TemplatesPageClient() {
    const isClient = useIsClient();

    // Fetch only after mounting on client. When key is null, SWR does not fetch or suspend.
    const { data: templates } = useSWR(isClient ? "/api/templates" : null);
    
    // Register scroll preservation on this page path
    useScrollPreservation("/templates");

    if (!isClient || !templates) {
        return (
            <main className="page templatesPage">
                <TemplatesPageSkeleton />
            </main>
        );
    }

    return (
        <main className="page templatesPage">
            <TemplatesCatalog templates={templates} />
        </main>
    );
}
