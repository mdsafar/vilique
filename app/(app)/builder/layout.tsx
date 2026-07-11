import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Viliqu Builder",
    description: "Customize and publish invitation websites with Viliqu Builder.",
};

export default function BuilderLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return children;
}
