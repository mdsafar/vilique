import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Invitations",
    description: "Manage, preview, and publish your Vilique invitation websites.",
};

export default function InvitationsLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return children;
}
