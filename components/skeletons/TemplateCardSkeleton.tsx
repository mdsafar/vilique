import { Skeleton, TextSkeleton } from "@/components/ui/Skeleton";

export default function TemplateCardSkeleton() {
    return (
        <article className="templateCard" aria-hidden="true">
            <div className="templatePreviewContainer">
                <Skeleton className="templatePreview templateSkeletonPreview" rounded="xl" />
            </div>
            <div className="templateInfo">
                <div className="templateText">
                    <TextSkeleton width={72} height={11} />
                    <TextSkeleton width={156} height={18} />
                    <TextSkeleton width={132} height={13} />
                    <div className="templateFeatureChips">
                        <Skeleton style={{ width: 82, height: 22 }} rounded="full" />
                        <Skeleton style={{ width: 76, height: 22 }} rounded="full" />
                        <Skeleton style={{ width: 64, height: 22 }} rounded="full" />
                    </div>
                </div>
            </div>
        </article>
    );
}
