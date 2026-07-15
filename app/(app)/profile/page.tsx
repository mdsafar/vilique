import ProfilePageClient from "@/components/ProfilePageClient";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import ProfilePageSkeleton from "@/components/skeletons/ProfilePageSkeleton";
import { getProfilePageData } from "@/lib/profilePageData";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return (
            <>
                <AuthRequiredModal next="/profile" forceOpen />
                <main className="profilePage" aria-busy="true">
                    <ProfilePageSkeleton />
                </main>
            </>
        );
    }

    const initialDashboardData = await getProfilePageData();

    return <ProfilePageClient initialDashboardData={initialDashboardData} />;
}
