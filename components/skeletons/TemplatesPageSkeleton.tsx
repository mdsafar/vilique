import { Search } from "lucide-react";
import AppLogo from "@/components/AppLogo";
import { ButtonSkeleton, Skeleton, TextSkeleton } from "@/components/ui/Skeleton";
import TemplateCardSkeleton from "@/components/skeletons/TemplateCardSkeleton";

export default function TemplatesPageSkeleton() {
    return (
        <main className="page templatesPage" aria-busy="true">
            <section className="marketHeroPanel" aria-label="Loading templates">
                <header className="marketHeader">
                    <div className="templatesAppHeader" aria-label="Vilique">
                        <div className="templatesBrand" aria-hidden="true">
                            <AppLogo size={34} />
                        </div>
                    </div>

                    <div className="marketHeaderTop">
                        <div>
                            <TextSkeleton className="eyebrow" width={168} height={14} />
                            <Skeleton style={{ width: "min(70vw, 540px)", height: 54, marginTop: 14 }} rounded="md" />
                        </div>

                        <section className="marketSearch" aria-hidden="true">
                            <div className="searchBox">
                                <Search size={18} aria-hidden="true" />
                                <TextSkeleton width={150} height={14} />
                            </div>
                        </section>
                    </div>

                    <nav className="categoryScroller" aria-hidden="true">
                        <ButtonSkeleton width={70} height={42} />
                        <ButtonSkeleton width={104} height={42} />
                        <ButtonSkeleton width={96} height={42} />
                    </nav>
                </header>
            </section>

            <section className="templateGrid" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, index) => (
                    <TemplateCardSkeleton key={index} />
                ))}
            </section>
        </main>
    );
}
