import { Skeleton, TextSkeleton } from "@/components/ui/Skeleton";

export default function TemplateCardSkeleton() {
    return (
        <article className="templateCard" aria-hidden="true">
            <div className="templateCardLink templateCardSkeletonLink">
                <div className="templatePreviewContainer">
                    <Skeleton className="templatePreview templateSkeletonPreview" rounded="xl" />
                </div>
                <div className="templateInfo">
                    <div className="templateText">
                        <TextSkeleton width={92} height={10} />
                        <TextSkeleton width="82%" height={18} />
                        <div className="templateCardSkeletonMeta">
                            <TextSkeleton width={50} height={10} />
                            <TextSkeleton width={52} height={10} />
                        </div>
                        <div className="templateCardSkeletonSummary">
                            <TextSkeleton width="92%" height={9} />
                            <TextSkeleton width="70%" height={9} />
                        </div>
                        <div className="templateCardSkeletonIncluded">
                            <TextSkeleton className="templateCardSkeletonIncludedLabel" width={68} height={9} />
                            <div className="templateCardSkeletonFeatures">
                                <Skeleton style={{ width: 86, height: 20 }} rounded="sm" />
                                <Skeleton style={{ width: 72, height: 20 }} rounded="sm" />
                                <Skeleton style={{ width: 58, height: 20 }} rounded="sm" />
                                <Skeleton style={{ width: 76, height: 20 }} rounded="sm" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}
