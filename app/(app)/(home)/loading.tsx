import TemplatesPageSkeleton from "@/components/skeletons/TemplatesPageSkeleton";

export default function TemplatesLoading() {
    return (
        <main className="page templatesPage" aria-busy="true">
            <TemplatesPageSkeleton />
        </main>
    );
}
