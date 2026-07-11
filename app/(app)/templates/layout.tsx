import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Templates",
    description: "Browse Vilique templates for weddings, birthdays, engagements, housewarmings, and more.",
};

export default function TemplatesLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return children;
}
