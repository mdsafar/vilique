import ProfilePageClient from "@/components/ProfilePageClient";
import ProtectedRoute from "@/components/ProtectedRoute";
import ProfilePageSkeleton from "@/components/skeletons/ProfilePageSkeleton";

export default function ProfilePage() {
    return (
        <ProtectedRoute
            next="/profile"
            className="profilePage"
            fallback={
                <main className="profilePage" aria-busy="true">
                    <ProfilePageSkeleton />
                </main>
            }
        >
            <ProfilePageClient />
        </ProtectedRoute>
    );
}
