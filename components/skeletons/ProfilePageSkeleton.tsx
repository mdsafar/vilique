"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Skeleton, TextSkeleton } from "@/components/ui/Skeleton";

export default function ProfilePageSkeleton() {
    const fixedSectionRef = useRef<HTMLDivElement | null>(null);
    const [fixedSectionHeight, setFixedSectionHeight] = useState(0);

    useEffect(() => {
        const fixedSection = fixedSectionRef.current;
        if (!fixedSection) return;

        function updateHeight() {
            if (window.matchMedia("(min-width: 861px)").matches) {
                setFixedSectionHeight(Math.ceil(fixedSection!.getBoundingClientRect().height));
            } else {
                setFixedSectionHeight(0);
            }
        }

        updateHeight();
        const ro = new ResizeObserver(updateHeight);
        ro.observe(fixedSection);
        window.addEventListener("resize", updateHeight);

        return () => {
            ro.disconnect();
            window.removeEventListener("resize", updateHeight);
        };
    }, []);

    const profileOverviewSkeleton = (
        <section className="profileOverview profileOverview--skeleton" aria-label="Loading profile overview">
            <article className="profileCard profileCard--skeleton">
                <div className="profileCardMain">
                    <div className="profileAvatar" style={{ background: "rgba(229, 231, 235, 0.5)", border: "3px solid #ffffff", boxShadow: "none" }}>
                        <Skeleton style={{ width: "100%", height: "100%" }} rounded="full" />
                    </div>
                    <div className="profileDetails">
                        <TextSkeleton className="profileGreeting" width={110} height={9.5} />
                        <Skeleton style={{ width: 150, height: 20, marginTop: 2, marginBottom: 6 }} rounded="sm" />
                        <TextSkeleton width={198} height={11} />
                    </div>
                </div>

                <div className="profileHeaderButtons profileHeaderButtons--skeleton">
                    <Skeleton className="profileHistoryButton" style={{ width: 92, height: 36 }} rounded="lg" />
                    <Skeleton className="profileLogoutButton" style={{ width: 92, height: 36 }} rounded="lg" />
                </div>

                <div className="profilePlanUsage profilePlanUsage--skeleton">
                    <div className="usageMeta">
                        <TextSkeleton width={138} height={12} />
                    </div>
                    <div className="pricingRateInfo">
                        {Array.from({ length: 2 }).map((_, index) => (
                            <div className="rateDetails rateDetails--skeleton" key={index}>
                                <TextSkeleton className="rateLabel" width={index === 0 ? 84 : 70} height={9.5} />
                                <TextSkeleton className="rateValue" width={32} height={18} />
                            </div>
                        ))}
                    </div>
                    <TextSkeleton width="86%" height={10} />
                </div>
            </article>

            <section className="profileStats" aria-label="Loading invitation metrics">
                {Array.from({ length: 4 }).map((_, index) => (
                    <article className="profileStat" key={index}>
                        <span style={{ background: "rgba(229, 231, 235, 0.5)", width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0 }}>
                            <Skeleton style={{ width: "100%", height: "100%" }} rounded="md" />
                        </span>
                        <div>
                            <Skeleton style={{ width: 24, height: 18 }} rounded="sm" />
                            <Skeleton style={{ width: 78, height: 10.5, marginTop: 4 }} rounded="sm" />
                            <Skeleton style={{ width: 104, height: 9, marginTop: 2 }} rounded="sm" />
                        </div>
                    </article>
                ))}
            </section>
        </section>
    );

    return (
        <section
            className="profileActivityTabs profileActivityTabs--shellLoading"
            aria-label="Loading profile"
            style={{ "--profile-fixed-section-height": `${fixedSectionHeight}px` } as CSSProperties}
        >
            <div className="profileFixedDesktopSection" ref={fixedSectionRef}>
                <div className="profileFixedDesktopInner">
                    <div className="profileActivityHeader">
                        {profileOverviewSkeleton}
                    </div>
                    <div className="profileTabListBar">
                        <div className="profileTabList profileTabList--skeleton" aria-hidden="true">
                            <Skeleton className="profileTabSkeletonItem" style={{ width: 138, height: 28 }} rounded="md" />
                            <Skeleton className="profileTabSkeletonItem" style={{ width: 124, height: 28 }} rounded="md" />
                        </div>
                    </div>
                </div>
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
                                    className="profileTemplateRatingAction--skeleton"
                                    style={{ width: "100%", height: 38 }}
                                    rounded="lg"
                                />
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </section>
    );
}
