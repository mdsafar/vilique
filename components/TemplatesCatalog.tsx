"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Search, Star } from "lucide-react";
import useSWRInfinite from "swr/infinite";
import AppLogo from "@/components/AppLogo";
import ListState from "@/components/ListState";
import type { InvitationCategory } from "@/types/invitation";
import { useNavigationState } from "@/components/NavigationStateProvider";
import { formatTemplateRating } from "@/lib/templateRatingFormat";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import TemplateCardSkeleton from "@/components/skeletons/TemplateCardSkeleton";
import { ButtonSkeleton } from "@/components/ui/Skeleton";
import { deduplicateItems, shouldStopRequesting, shouldDisableSentinel } from "@/lib/pagination";

type TemplateItem = {
    id: string;
    name: string;
    category: InvitationCategory;
    accent: string;
    gradient: string;
    description: string;
    mood: string;
    badge: "Free" | "Premium";
    popularity: "Featured" | "Popular" | "Newest";
    features: string[];
    palette: string[];
    ratingAverage?: number | null;
    ratingCount?: number;
};

type TemplatesResponse = {
    items: TemplateItem[];
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
    counts: Record<string, number>;
};

const categoryLabels: Record<InvitationCategory | "all", string> = {
    all: "All",
    wedding: "Wedding",
    birthday: "Birthday",
    engagement: "Engagement",
    housewarming: "Housewarming",
    baby_shower: "Baby Shower",
    graduation: "Graduation",
    party: "Party",
    corporate: "Corporate",
    festival: "Festival",
    custom: "Custom",
};

export default function TemplatesCatalog() {
    const {
        templatesSearch: searchTerm,
        setTemplatesSearch: setSearchTerm,
        templatesFilter: activeCategory,
        setTemplatesFilter: setActiveCategory,
        listSizes,
        setListSize,
    } = useNavigationState();
    const debouncedSearch = useDebouncedValue(searchTerm, searchTerm ? 350 : 0);
    const [cachedCounts, setCachedCounts] = useState<Record<string, number> | null>(null);
    const [isMobileHeaderCollapsed, setIsMobileHeaderCollapsed] = useState(false);
    const savedSize = listSizes["templates"] ?? 1;

    const prevCategoryRef = useRef(activeCategory);
    const prevDebouncedSearchRef = useRef(debouncedSearch);

    const getFirstPageKey = (category: string, search: string) => {
        const params = new URLSearchParams({
            category,
            sort: "popular",
            limit: "10",
        });
        if (search) params.set("search", search);
        return `/api/templates?${params.toString()}`;
    };

    const {
        data,
        error,
        size,
        setSize,
        isLoading,
        isValidating,
        mutate,
    } = useSWRInfinite<TemplatesResponse>((pageIndex, previousPageData) => {
        if (shouldStopRequesting(previousPageData)) return null;
        const params = new URLSearchParams({
            category: activeCategory,
            sort: "popular",
            limit: "10",
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (pageIndex && previousPageData?.nextCursor) params.set("cursor", previousPageData.nextCursor);
        return `/api/templates?${params.toString()}`;
    }, null, {
        suspense: false,
        keepPreviousData: false,
        revalidateFirstPage: false,
        initialSize: savedSize,
        onSuccess: (templatePages, key) => {
            const currentActiveKey = getFirstPageKey(activeCategory, debouncedSearch);
            if (key && key.includes(currentActiveKey)) {
                const nextCounts = templatePages?.[0]?.counts;
                if (nextCounts) setCachedCounts(nextCounts);
            }
        },
    });
    const todayLabel = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
    }).format(new Date()).toUpperCase();
    const pages = data || [];
    const rawTemplates = pages.flatMap((page) => page.items);
    const templates = deduplicateItems(rawTemplates, "id");
    const latestCounts = pages[0]?.counts;
    const counts = latestCounts || cachedCounts || { all: 0 };
    const categories = Object.keys(categoryLabels).filter((category) => category === "all" || counts[category] > 0) as (InvitationCategory | "all")[];
    const hasActiveFilters = Boolean(debouncedSearch) || activeCategory !== "all";
    const activeCategoryLabel = activeCategory in categoryLabels
        ? categoryLabels[activeCategory as InvitationCategory | "all"]
        : activeCategory;
    const emptyStateDetails = [
        activeCategory !== "all" ? `Category: ${activeCategoryLabel}` : null,
        debouncedSearch ? `Search: ${debouncedSearch}` : null,
    ].filter(Boolean) as string[];
    const hasMore = Boolean(pages[pages.length - 1]?.hasMore);
    const shouldShowEndState = pages.length > 1 && !hasMore;
    const isSearching = searchTerm !== debouncedSearch;
    const isLoadingFirstPage = (isLoading && !pages.length) || isSearching;
    const isLoadingInitialTabs = isLoading && !pages.length && !cachedCounts;
    const isLoadingNextPage = isValidating && pages.length > 0 && hasMore && size > pages.length;

    const handleLoadMore = () => {
        setSize((current) => {
            const next = current + 1;
            setListSize("templates", next);
            return next;
        });
    };

    const sentinelRef = useInfiniteScroll<HTMLDivElement>({
        disabled: shouldDisableSentinel({ hasMore, isLoading: isLoadingNextPage, size, pageCount: pages.length }),
        onLoadMore: handleLoadMore,
    });

    useEffect(() => {
        const hasFilterChanged = prevCategoryRef.current !== activeCategory || prevDebouncedSearchRef.current !== debouncedSearch;
        
        if (hasFilterChanged) {
            prevCategoryRef.current = activeCategory;
            prevDebouncedSearchRef.current = debouncedSearch;
            setSize(1);
            setListSize("templates", 1);
        }
    }, [activeCategory, debouncedSearch, setSize, setListSize]);

    useEffect(() => {
        if (window.location.pathname !== "/") return;
        const params = new URLSearchParams(window.location.search);
        
        const nextParams = new URLSearchParams();
        if (activeCategory !== "all") nextParams.set("category", activeCategory);
        if (debouncedSearch) nextParams.set("search", debouncedSearch);
        
        params.sort();
        nextParams.sort();
        
        if (params.toString() !== nextParams.toString()) {
            const nextUrl = nextParams.toString() ? `/?${nextParams.toString()}` : "/";
            window.history.replaceState(null, "", nextUrl);
        }
    }, [activeCategory, debouncedSearch]);

    useEffect(() => {
        const mobileQuery = window.matchMedia("(max-width: 767px)");
        let lastScrollY = window.scrollY;
        let animationFrame = 0;

        const updateHeaderVisibility = () => {
            animationFrame = 0;
            const currentScrollY = window.scrollY;
            const scrollDelta = currentScrollY - lastScrollY;
            const focusedElement = document.activeElement;
            const isSearching = focusedElement instanceof Element && focusedElement.closest(".marketHeroPanel");

            if (!mobileQuery.matches || currentScrollY < 40 || isSearching) {
                setIsMobileHeaderCollapsed(false);
                lastScrollY = currentScrollY;
                return;
            }

            if (scrollDelta > 8 && currentScrollY > 90) {
                setIsMobileHeaderCollapsed(true);
            } else if (scrollDelta < -8) {
                setIsMobileHeaderCollapsed(false);
            }

            lastScrollY = currentScrollY;
        };

        const handleScroll = () => {
            if (animationFrame) return;
            animationFrame = window.requestAnimationFrame(updateHeaderVisibility);
        };

        const handleViewportChange = () => {
            if (!mobileQuery.matches) setIsMobileHeaderCollapsed(false);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        mobileQuery.addEventListener("change", handleViewportChange);

        return () => {
            window.removeEventListener("scroll", handleScroll);
            mobileQuery.removeEventListener("change", handleViewportChange);
            if (animationFrame) window.cancelAnimationFrame(animationFrame);
        };
    }, []);

    return (
        <>
            <div className={`templatesFixedHeader${isMobileHeaderCollapsed ? " isHeaderCondensed" : ""}`}>
                <section className="marketHeroPanel" aria-label="Template marketplace">
                    <header className="marketHeader">
                        <div className="marketHeaderTop">
                            <div className="templatesAppHeader" aria-label="Vilique">
                                <Link href="/" className="templatesBrand">
                                    <AppLogo size={36} />
                                </Link>
                            </div>

                            <section className="marketSearch" aria-label="Template search">
                                <label className="searchBox">
                                    <Search size={18} aria-hidden="true" />
                                    <input
                                        value={searchTerm}
                                        onChange={(event) => setSearchTerm(event.target.value)}
                                        placeholder="Search floral, pastel"
                                    />
                                </label>
                            </section>
                        </div>

                    </header>
                </section>

                <nav className="categoryScroller" aria-label="Template categories">
                    {isLoadingInitialTabs ? (
                        <TemplateCategoryTabsSkeleton />
                    ) : (
                        categories.map((category) => (
                            <button
                                className={category === activeCategory ? "active" : ""}
                                key={category}
                                type="button"
                                onClick={() => setActiveCategory(category)}
                            >
                                {categoryLabels[category]} <span>{counts[category] || 0}</span>
                            </button>
                        ))
                    )}
                </nav>
            </div>

            {isLoadingFirstPage ? (
                <section className="templateGrid" aria-hidden="true">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <TemplateCardSkeleton key={index} />
                    ))}
                </section>
            ) : error && !templates.length ? (
                <ListState
                    actionLabel="Try again"
                    className="templatesListState"
                    description="We could not load the template catalog. Check your connection and try again."
                    onAction={() => { setSize(1); setListSize("templates", 1); void mutate(); }}
                    title="Templates did not load"
                    variant="error"
                />
            ) : templates.length ? (
                <section className="templateGrid">
                    {templates.map((template) => {
                        const details = [template.popularity, categoryLabels[template.category]];
                        const featureChips = template.features.slice(0, 3);
                        const ratingLabel = formatTemplateRating({
                            average: template.ratingAverage ?? null,
                            count: template.ratingCount ?? 0,
                        });

                        return (
                            <article className="templateCard" key={template.id}>
                                <Link
                                    href={`/templates/${template.id}`}
                                    className="templateCardLink"
                                    aria-label={`View ${template.name}`}
                                    prefetch={false}
                                >
                                    <div className="templatePreviewContainer">
                                        <div
                                            className="templatePreview templatePreviewReference"
                                            style={{ background: template.gradient }}
                                        >
                                            <div className="templateReferenceCard">
                                                <small>WEDDING INVITATION</small>
                                                <strong>Name 1 & Name 2</strong>
                                                <span>{todayLabel} · 05:30 PM</span>
                                            </div>
                                            <i className="templateFlower flowerOne" />
                                            <i className="templateFlower flowerTwo" />
                                            <span className="templateAggregateRating">
                                                {ratingLabel === "New" ? (
                                                    "New"
                                                ) : (
                                                    <>
                                                        <span>{ratingLabel}</span>
                                                        <Star size={13} fill="currentColor" aria-hidden="true" />
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="templateInfo">
                                        <div className="templateText">
                                            <p className="templatePopularity">{details.join(" · ")}</p>
                                            <h2>{template.name}</h2>
                                            <span className="templateMood">{template.mood}</span>
                                            <div className="templateFeatureChips" aria-label={`${template.name} features`}>
                                                {featureChips.map((feature) => (
                                                    <span key={feature}>{feature}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </article>
                        );
                    })}
                    {isLoadingNextPage ? (
                        <>
                            {Array.from({ length: 2 }).map((_, index) => (
                                <TemplateCardSkeleton key={`append-${index}`} />
                            ))}
                        </>
                    ) : null}
                    {error && templates.length ? (
                        <div className="listLoadState" role="status">
                            <span>Couldn&apos;t load more</span>
                            <button type="button" onClick={() => mutate()}>Retry</button>
                        </div>
                    ) : null}
                    {shouldShowEndState && templates.length ? <div className="listEndState">You&apos;ve reached the end.</div> : null}
                    <div ref={sentinelRef} className="infiniteScrollSentinel" aria-hidden="true" />
                </section>
            ) : (
                <ListState
                    actionLabel={hasActiveFilters ? "Reset filters" : undefined}
                    className="templatesListState"
                    description="No templates match this combination. Try another category or clear the search."
                    details={emptyStateDetails}
                    onAction={() => {
                        setSearchTerm("");
                        setActiveCategory("all");
                    }}
                    title="No matching templates"
                    variant="filtered"
                />
            )}
        </>
    );
}

function TemplateCategoryTabsSkeleton() {
    return (
        <>
            <ButtonSkeleton className="categoryTabSkeleton" width={72} height={36} />
            <ButtonSkeleton className="categoryTabSkeleton" width={104} height={36} />
            <ButtonSkeleton className="categoryTabSkeleton" width={96} height={36} />
        </>
    );
}
