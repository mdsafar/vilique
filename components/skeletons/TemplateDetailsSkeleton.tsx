import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ButtonSkeleton, Skeleton, TextSkeleton } from "@/components/ui/Skeleton";

export default function TemplateDetailsSkeleton() {
    return (
        <main className="page templateDetailsPage" aria-busy="true">
            <header className="templateDetailTopbar analyticsHeader">
                <div className="templateDetailCrumb">
                    <Link aria-label="Back to templates" className="analyticsBackBtn" href="/templates">
                        <ArrowLeft size={16} aria-hidden="true" />
                        <span>Templates</span>
                    </Link>
                </div>
                <div className="analyticsHeaderText">
                    <h1>Template details</h1>
                    <p>Loading template</p>
                </div>
                <div className="analyticsHeaderSpacer" aria-hidden="true" />
            </header>

            <section className="templateDetailHero">
                <Skeleton className="templateDetailPreview templateLivePreview" style={{ minHeight: 540 }} rounded="xl" />

                <div className="templateDetailContent">
                    <div className="templateDetailHeader">
                        <TextSkeleton className="eyebrow" width={128} height={12} />
                        <TextSkeleton width="min(100%, 330px)" height={38} />
                        <div className="detailRating">
                            <TextSkeleton width={96} height={16} />
                            <TextSkeleton width={42} height={16} />
                            <TextSkeleton width={72} height={14} />
                        </div>
                    </div>

                    <div className="detailLead">
                        <TextSkeleton width="100%" />
                        <TextSkeleton width="92%" />
                        <TextSkeleton width="64%" />
                    </div>

                    <div className="detailBadges">
                        <ButtonSkeleton width={74} height={26} />
                        <ButtonSkeleton width={92} height={26} />
                        <ButtonSkeleton width={108} height={26} />
                    </div>

                    <div className="heroActions detailActions">
                        <ButtonSkeleton width={156} height={46} />
                        <ButtonSkeleton width={150} height={46} />
                    </div>

                    <div className="detailBlock">
                        <TextSkeleton width={118} height={14} />
                        <div className="detailFeatureGrid">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <ButtonSkeleton height={38} key={index} width="100%" />
                            ))}
                        </div>
                    </div>

                    <div className="detailPerfectFor">
                        <TextSkeleton width={92} height={14} />
                        <div className="detailPerfectForOptions">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <ButtonSkeleton height={38} key={index} width="100%" />
                            ))}
                        </div>
                    </div>

                    <Skeleton className="detailCustomizable" style={{ width: "100%" }} rounded="lg" />
                </div>
            </section>
        </main>
    );
}
