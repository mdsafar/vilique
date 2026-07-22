import { Search } from "lucide-react";
import AppLogo from "@/components/AppLogo";
import { ButtonSkeleton } from "@/components/ui/Skeleton";
import TemplateCardSkeleton from "@/components/skeletons/TemplateCardSkeleton";

export default function TemplatesPageSkeleton() {
    return (
        <>
            <div className="templatesFixedHeader">
                <section className="marketHeroPanel" aria-label="Loading templates">
                    <header className="marketHeader">
                        <div className="marketHeaderTop">
                            <div className="templatesAppHeader" aria-label="Vilique">
                                <div className="templatesBrand" aria-hidden="true">
                                    <AppLogo showMark={false} />
                                </div>
                            </div>

                            <section className="marketSearch" aria-hidden="true">
                                <div className="searchBox">
                                    <Search size={18} aria-hidden="true" />
                                    <input
                                        disabled
                                        placeholder="Search floral, pastel"
                                    />
                                </div>
                            </section>
                        </div>

                    </header>
                </section>

                <nav className="categoryScroller" aria-hidden="true">
                    <ButtonSkeleton className="categoryTabSkeleton" width={72} height={36} />
                    <ButtonSkeleton className="categoryTabSkeleton" width={104} height={36} />
                    <ButtonSkeleton className="categoryTabSkeleton" width={96} height={36} />
                </nav>
            </div>

            <section className="templateGrid" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, index) => (
                    <TemplateCardSkeleton key={index} />
                ))}
            </section>
        </>
    );
}
