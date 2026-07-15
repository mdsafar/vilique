import InvitationsPageClient from "@/components/InvitationsPageClient";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import { createClient } from "@/lib/supabase/server";

export default async function InvitationsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return (
            <main className="profilePage invitationsPage">
                <AuthRequiredModal next="/invitations" forceOpen />
            </main>
        );
    }

    return <InvitationsPageClient />;
}
