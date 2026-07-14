import DelayedRouteSkeleton from "@/components/DelayedRouteSkeleton";
import TemplatesPageSkeleton from "@/components/skeletons/TemplatesPageSkeleton";

export default function TemplatesLoading() {
    return (
        <DelayedRouteSkeleton>
            <main className="page templatesPage" aria-busy="true">
                <TemplatesPageSkeleton />
            </main>
        </DelayedRouteSkeleton>
    );
}
