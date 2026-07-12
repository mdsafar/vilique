import { ArrowLeft } from "lucide-react";
import { ButtonSkeleton, Skeleton, TextSkeleton } from "@/components/ui/Skeleton";

export default function TemplateDetailsSkeleton() {
    return (
        <main className="page templateDetailsPage" aria-busy="true">
            <header className="templateDetailTopbar">
                <div className="templateDetailCrumb" aria-hidden="true">
                    <span>
                        <ArrowLeft size={16} />
                        <TextSkeleton width={78} height={14} />
                    </span>
                </div>
                <ButtonSkeleton width={150} height={36} />
            </header>

            <section className="templateDetailHero">
                <Skeleton className="templateDetailPreview" style={{ minHeight: 500 }} rounded="xl" />

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

                    <Skeleton style={{ width: "100%", height: 160 }} rounded="xl" />
                    <Skeleton style={{ width: "100%", height: 120 }} rounded="xl" />
                </div>
            </section>
        </main>
    );
}
