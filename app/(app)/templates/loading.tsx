import DelayedRouteSkeleton from "@/components/DelayedRouteSkeleton";
import TemplatesPageSkeleton from "@/components/skeletons/TemplatesPageSkeleton";

export default function TemplatesLoading() {
    return (
        <DelayedRouteSkeleton>
            <TemplatesPageSkeleton />
        </DelayedRouteSkeleton>
    );
}
