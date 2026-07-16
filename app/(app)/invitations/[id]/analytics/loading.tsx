import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton, TextSkeleton } from "@/components/ui/Skeleton";

export default function AnalyticsLoading() {
    return (
        <main className="profilePage analyticsPage" aria-busy="true">
            <section className="analyticsPanel">
                <header className="analyticsHeader">
                    <Link href="/invitations" className="analyticsBackBtn" aria-label="Back to invitations">
                        <ArrowLeft size={16} />
                        <span>Back</span>
                    </Link>
                    <div className="analyticsHeaderText">
                        <h1>Analytics</h1>
                        <p>Loading invitation analytics</p>
                    </div>
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
