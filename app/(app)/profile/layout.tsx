import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Dashboard",
    description: "Manage, preview, and publish your Vilique invitation websites.",
};

export default function ProfileLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return children;
}
