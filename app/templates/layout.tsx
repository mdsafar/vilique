import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Viliqu Templates",
    description: "Browse Viliqu templates for weddings, birthdays, engagements, housewarmings, and more.",
};

export default function TemplatesLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return children;
}
