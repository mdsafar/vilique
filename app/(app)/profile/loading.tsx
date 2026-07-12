import DelayedRouteSkeleton from "@/components/DelayedRouteSkeleton";
import ProfilePageSkeleton from "@/components/skeletons/ProfilePageSkeleton";

export default function ProfileLoading() {
    return (
        <DelayedRouteSkeleton delayMs={0}>
            <ProfilePageSkeleton />
        </DelayedRouteSkeleton>
    );
}
