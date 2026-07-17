import { Skeleton, TextSkeleton } from "@/components/ui/Skeleton";

export default function TemplatePreviewSkeleton() {
    return (
        <div className="invitePreviewShell templateStandalonePreview templatePreviewSkeletonShell" aria-busy="true">
            <span className="inviteBackButton templatePreviewBackSkeleton" aria-hidden="true">
                <Skeleton style={{ width: 16, height: 16 }} rounded="sm" />
                <TextSkeleton width={58} height={12} />
            </span>

            <section className="pastelWeddingPage templatePreviewSkeletonPage" aria-hidden="true">
                <div className="weddingCardWrapper">
                    <div className="weddingCard active templatePreviewSkeletonCard">
                        <TextSkeleton width={148} height={12} />
                        <TextSkeleton width={260} height={44} />
                        <TextSkeleton width={178} height={14} />
                        <Skeleton style={{ width: "100%", height: 84 }} rounded="lg" />
                        <Skeleton style={{ width: "76%", height: 34 }} rounded="full" />
                        <Skeleton style={{ width: "100%", height: 94 }} rounded="lg" />
                        <Skeleton style={{ width: "100%", height: 108 }} rounded="lg" />
                    </div>
                </div>
            </section>
        </div>
    );
}
