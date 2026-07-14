"use client";

import TemplatesCatalog from "@/components/TemplatesCatalog";
import { useScrollPreservation } from "./NavigationStateProvider";

export default function TemplatesPageClient() {
    // Register scroll preservation on this page path
    useScrollPreservation("/templates");

    return (
        <main className="page templatesPage">
            <TemplatesCatalog />
        </main>
    );
}
