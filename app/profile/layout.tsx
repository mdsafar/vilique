import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Viliqu Dashboard",
    description: "Manage, preview, and publish your Viliqu invitation websites.",
};

export default function ProfileLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return children;
}
