import BottomNav from "@/components/BottomNav";
import { AppProviders } from "@/components/AppProviders";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    const navUser = user ? { id: user.id, email: user.email, user_metadata: user.user_metadata } : null;

    return (
        <AppProviders>
            {children}
            <BottomNav key={navUser?.id ?? "signed-out"} initialUser={navUser} />
        </AppProviders>
    );
}
