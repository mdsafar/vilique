import ProfilePageClient from "@/components/ProfilePageClient";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function ProfilePage() {
    return (
        <ProtectedRoute next="/profile" className="profilePage">
            <ProfilePageClient />
        </ProtectedRoute>
    );
}
