import type { Metadata } from "next";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
    title: "Builder",
    description: "Customize and publish invitation websites with Vilique Builder.",
};

export default async function BuilderLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return (
            <main className="builderShell">
                <AuthRequiredModal next="/builder" forceOpen />
            </main>
        );
    }

    return children;
}
