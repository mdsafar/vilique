import { Search } from "lucide-react";
import AppLogo from "@/components/AppLogo";
import { ButtonSkeleton, TextSkeleton } from "@/components/ui/Skeleton";
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
                                    <AppLogo size={36} />
                                </div>
                            </div>

                            <section className="marketSearch" aria-hidden="true">
                                <div className="searchBox">
                                    <Search size={18} aria-hidden="true" />
                                    <TextSkeleton width={132} height={13} />
                                </div>
                            </section>
                        </div>

                    </header>
                </section>

                <nav className="categoryScroller" aria-hidden="true">
                    <ButtonSkeleton width={70} height={32} />
                    <ButtonSkeleton width={104} height={32} />
                    <ButtonSkeleton width={96} height={32} />
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
