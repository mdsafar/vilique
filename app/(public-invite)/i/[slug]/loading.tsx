import DelayedRouteSkeleton from "@/components/DelayedRouteSkeleton";
import PublicInviteSkeleton from "@/components/skeletons/PublicInviteSkeleton";

export default function PublicInviteLoading() {
    return (
        <DelayedRouteSkeleton>
            <PublicInviteSkeleton />
        </DelayedRouteSkeleton>
    );
}
