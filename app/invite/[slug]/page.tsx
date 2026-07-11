import type { Metadata } from "next";
import { redirect } from "next/navigation";

type Props = {
    params: Promise<{
        slug: string;
    }>;
};

export const metadata: Metadata = {
    title: "Invitation",
};

export default async function PublicInvitePage({ params }: Props) {
    const { slug } = await params;
    redirect(`/i/${slug}`);
}
