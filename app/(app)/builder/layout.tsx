import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Builder",
    description: "Customize and publish invitation websites with Vilique Builder.",
};

export default function BuilderLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return children;
}
