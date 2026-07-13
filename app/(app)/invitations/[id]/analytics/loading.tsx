import { ButtonSkeleton, Skeleton, TextSkeleton } from "@/components/ui/Skeleton";

export default function AnalyticsLoading() {
    return (
        <main className="profilePage analyticsPage" aria-busy="true">
            <section className="analyticsPanel">
                <header className="analyticsHeader analyticsHeader--skeleton">
                    <div className="analyticsHeaderText">
                        <TextSkeleton width={132} height={12} />
                        <TextSkeleton width={158} height={34} />
                        <TextSkeleton width={190} height={15} />
                    </div>
                    <ButtonSkeleton width={82} height={38} />
                </header>

                <section className="analyticsStats" aria-hidden="true">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <article className="analyticsStat analyticsStat--skeleton" key={index}>
                            <Skeleton className="analyticsStatIcon" rounded="lg" />
                            <div className="analyticsStatBody">
                                <TextSkeleton width={38} height={28} />
                                <TextSkeleton width={112} height={13} />
                                <TextSkeleton width={148} height={11} />
                            </div>
                        </article>
                    ))}
                </section>

                <section className="analyticsBreakdown" aria-hidden="true">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div className="analyticsBreakdownCard analyticsBreakdownCard--skeleton" key={index}>
                            <div className="analyticsPanelTitle">
                                <Skeleton style={{ width: 34, height: 34 }} rounded="lg" />
                                <div>
                                    <TextSkeleton width={112} height={16} />
                                    <TextSkeleton width={86} height={11} />
                                </div>
                            </div>
                            <div className="analyticsSkeletonRows">
                                <TextSkeleton width="100%" height={16} />
                                <TextSkeleton width="92%" height={16} />
                                <TextSkeleton width="78%" height={16} />
                            </div>
                        </div>
                    ))}
                </section>
            </section>
        </main>
    );
}
