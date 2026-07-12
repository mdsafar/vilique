import DelayedRouteSkeleton from "@/components/DelayedRouteSkeleton";
import TemplateDetailsSkeleton from "@/components/skeletons/TemplateDetailsSkeleton";

export default function TemplateDetailsLoading() {
    return (
        <DelayedRouteSkeleton>
            <TemplateDetailsSkeleton />
        </DelayedRouteSkeleton>
    );
}
