import { Skeleton, TextSkeleton } from "@/components/ui/Skeleton";

export default function ProfilePageSkeleton() {
    return (
        <>
            <section className="profileOverview profileOverview--skeleton" aria-label="Loading profile overview">
                <article className="profileCard profileCard--skeleton">
                    <div className="profileIdentity">
                        <Skeleton style={{ width: 58, height: 58 }} rounded="full" />
                        <div className="profileDetails">
                            <TextSkeleton width={110} height={11} />
                            <TextSkeleton width={150} height={22} />
                            <TextSkeleton width={198} height={12} />
                        </div>
                    </div>
                    <Skeleton style={{ width: "100%", height: 112 }} rounded="xl" />
                </article>

                <section className="profileStats" aria-label="Loading invitation metrics">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <article className="profileStat" key={index}>
                            <Skeleton style={{ width: 30, height: 30 }} rounded="md" />
                            <div>
                                <TextSkeleton width={24} height={21} />
                                <TextSkeleton width={78} height={12} />
                                <TextSkeleton width={104} height={10} />
                            </div>
                        </article>
                    ))}
                </section>
            </section>

            <section className="profileActivityTabs profileActivityTabs--shellLoading" aria-label="Loading profile activity">
                <div className="profileTabList profileTabList--skeleton" aria-hidden="true">
                    <Skeleton style={{ width: 148, height: 36 }} rounded="lg" />
                    <Skeleton style={{ width: 132, height: 36 }} rounded="lg" />
                </div>

                <section className="profileTemplateRatings" aria-label="Loading used templates">
                    <div className="profileTemplateRatingsSection">
                        <div className="profileTemplateRatingGrid profileTemplateRatingGrid--skeleton" aria-hidden="true">
                            {Array.from({ length: 2 }).map((_, cardIndex) => (
                                <article className="profileTemplateRatingCard profileTemplateRatingCard--skeleton" key={cardIndex}>
                                    <div className="profileTemplateRatingHeader">
                                        <div className="profileTemplateRatingTitle">
                                            <TextSkeleton width={136} height={15} />
                                            <TextSkeleton width={78} height={11} />
                                            <Skeleton style={{ width: 62, height: 19 }} rounded="md" />
                                        </div>
                                        <div className="profileTemplateRatingStats">
                                            <TextSkeleton width={24} height={20} />
                                            <TextSkeleton width={104} height={10} />
                                            <TextSkeleton width={96} height={10} />
                                        </div>
                                    </div>

                                    <div className="profileTemplateRatingPanel">
                                        <div className="profileTemplateRatingPanelCopy">
                                            <TextSkeleton width={74} height={10} />
                                            <TextSkeleton width={58} height={13} />
                                        </div>
                                        <div className="profileTemplateRatingStars">
                                            {Array.from({ length: 5 }).map((_, index) => (
                                                <Skeleton
                                                    key={index}
                                                    style={{ width: 24, height: 24 }}
                                                    rounded="lg"
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="profileTemplateRatingDates">
                                        <Skeleton style={{ width: "100%", height: 34 }} rounded="lg" />
                                        <Skeleton style={{ width: "100%", height: 34 }} rounded="lg" />
                                    </div>
                                    <Skeleton
                                        className="profileTemplateRatingAction profileTemplateRatingAction--skeleton"
                                        style={{ width: 132, height: 32 }}
                                        rounded="lg"
                                    />
                                </article>
                            ))}
                        </div>
                    </div>
                </section>
            </section>
        </>
    );
}
