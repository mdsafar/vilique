import type { Metadata } from "next";
import TemplatesPageClient from "@/components/TemplatesPageClient";

export const metadata: Metadata = {
    title: {
        absolute: "Vilique",
    },
    description: "Browse Vilique templates for weddings, birthdays, engagements, housewarmings, and more.",
};

export default function HomePage() {
    return <TemplatesPageClient />;
}
