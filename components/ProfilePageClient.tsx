"use client";

import { CSSProperties, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import ProfilePageSkeleton from "@/components/skeletons/ProfilePageSkeleton";
import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    ClipboardCheck,
    Download,
    Eye,
    HelpCircle,
    Loader2,
    MoreVertical,
    PencilLine,
    Receipt,
    RefreshCw,
    Star,
    Trash2,
    UsersRound,
} from "lucide-react";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import ListState from "@/components/ListState";
import ProfileCard from "@/components/ProfileCard";
import { Skeleton, TextSkeleton } from "@/components/ui/Skeleton";
import { getPublicInvitationUrl } from "@/lib/config/site";
import { formatPaiseToCurrency } from "@/lib/currency";
import { getTransactionLifecycle, TransactionLifecycleState } from "@/lib/payments/transactionLifecycle";
import { useScrollPreservation, useNavigationState } from "./NavigationStateProvider";
import { InvitationData } from "@/types/invitation";
import { useToast } from "./Toast";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { deduplicateItems, shouldStopRequesting, shouldDisableSentinel } from "@/lib/pagination";

type PaymentRecord = {
    id: string;
    invitation_id: string;
    template_id: string | null;
    amount_paise: number;
    currency: string;
    status: string;
    payment_status?: string | null;
    publish_status?: string | null;
    refund_status?: string | null;
    recovery_status?: string | null;
    refund_reason?: string | null;
    refund_reference?: string | null;
    refund_processed_at?: string | null;
    published_at?: string | null;
    receipt: string | null;
    created_at: string;
    templateName: string | null;
    invitationTitle: string | null;
    invitationSlug: string | null;
};

type TemplateRatingItem = {
    templateId: string;
    templateKey: string;
    templateName: string;
    category: string;
    accentColor: string | null;
    previewImageUrl: string | null;
    userRating: number | null;
    averageRating: number | null;
    ratingCount: number;
    purchaseCount: number;
    invitationCount: number;
    firstPurchaseAt: string | null;
    firstUsedAt: string | null;
    lastUpdatedAt: string | null;
};

type ProfileTab = "templates" | "transactions";

type PaginatedTemplateRatings = {
    ratings: TemplateRatingItem[];
    items: TemplateRatingItem[];
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
};

type PaginatedPayments = {
    payments: PaymentRecord[];
    items: PaymentRecord[];
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
    paymentsError?: string | null;
};

type DashboardData = {
    profile: {
        email: string;
        name: string;
        avatarUrl: string | null;
    } | null;
    invitations: InvitationData[];
    dashboard: {
        published: number;
        drafts: number;
        views: number;
        rsvps: number;
        totalSpent?: number;
    };
};

type Props = {
    initialDashboardData?: DashboardData;
};

export default function ProfilePageClient({ initialDashboardData }: Props) {
    const [activeTab, setActiveTab] = useState<ProfileTab>(() => getInitialProfileTab());
    const [hasOpenedTransactions, setHasOpenedTransactions] = useState(() => getInitialProfileTab() === "transactions");
    const [hasChangedTab, setHasChangedTab] = useState(false);
    const { listSizes, setListSize } = useNavigationState();

    const savedTemplateRatingsSize = listSizes["templateRatings"] ?? 1;
    const savedPaymentsSize = listSizes["payments"] ?? 1;

    const {
        data: dashboardData,
        error: dashboardError,
        mutate: mutateDashboard,
    } = useSWR<DashboardData>("/api/profile/dashboard", null, {
        fallbackData: initialDashboardData,
        suspense: false,
    });
    const {
        data: templateRatingsPages,
        error: templateRatingsError,
        mutate: mutateTemplateRatings,
        setSize: setTemplateRatingsSize,
        size: templateRatingsSize,
        isLoading: isTemplateRatingsLoading,
        isValidating: isTemplateRatingsValidating,
    } = useSWRInfinite<PaginatedTemplateRatings>((pageIndex, previousPageData) => {
        if (!dashboardData?.profile) return null;
        if (shouldStopRequesting(previousPageData)) return null;
        const params = new URLSearchParams({ sort: "recently_used", limit: "10" });
        if (pageIndex && previousPageData?.nextCursor) params.set("cursor", previousPageData.nextCursor);
        return `/api/profile/template-ratings?${params.toString()}`;
    }, null, { suspense: false, keepPreviousData: false, revalidateFirstPage: false, initialSize: savedTemplateRatingsSize });
    const {
        data: paymentsPages,
        error: paymentsFetchError,
        mutate: mutatePayments,
        setSize: setPaymentsSize,
        size: paymentsSize,
        isLoading: isPaymentsInitialLoading,
        isValidating: isPaymentsValidating,
    } = useSWRInfinite<PaginatedPayments>((pageIndex, previousPageData) => {
        if (!dashboardData?.profile || !hasOpenedTransactions) return null;
        if (shouldStopRequesting(previousPageData)) return null;
        const params = new URLSearchParams({ sort: "newest", limit: "10" });
        if (pageIndex && previousPageData?.nextCursor) params.set("cursor", previousPageData.nextCursor);
        return `/api/profile/payments?${params.toString()}`;
    }, null, { suspense: false, keepPreviousData: false, revalidateFirstPage: false, initialSize: savedPaymentsSize });

    // Register scroll preservation on this page path
    useScrollPreservation("/profile");

    useEffect(() => {
        function handlePopState() {
            const nextTab = getInitialProfileTab();
            setActiveTab(nextTab);
            setHasChangedTab(true);
            if (nextTab === "transactions") {
                setHasOpenedTransactions(true);
            }
        }

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    useEffect(() => {
        function handleProfileDataChanged() {
            setListSize("templateRatings", 1);
            setListSize("payments", 1);
            void setTemplateRatingsSize(1);
            void setPaymentsSize(1);
            void mutateDashboard();
            void mutateTemplateRatings();
            void mutatePayments();
        }

        window.addEventListener("vilique:profile-data-changed", handleProfileDataChanged);
        return () => window.removeEventListener("vilique:profile-data-changed", handleProfileDataChanged);
    }, [mutateDashboard, mutatePayments, mutateTemplateRatings, setTemplateRatingsSize, setPaymentsSize, setListSize]);

    if (dashboardError?.status === 401) {
        return (
            <main className="profilePage">
                <AuthRequiredModal next="/profile" forceOpen />
            </main>
        );
    }

    if (dashboardError) {
        return (
            <main className="profilePage profileStatePage">
                <ListState
                    title="Profile could not load"
                    description="Something went wrong while loading your profile. Try again in a moment."
                    actionLabel="Try again"
                    onAction={() => void mutateDashboard()}
                    variant="error"
                />
            </main>
        );
    }

    if (!dashboardData) {
        return (
            <main className="profilePage" aria-busy="true">
                <ProfilePageSkeleton />
            </main>
        );
    }

    const profile = dashboardData?.profile || null;
    const invitations = (dashboardData?.invitations || []) as InvitationData[];
    const dashboard = dashboardData?.dashboard || {
        published: 0,
        drafts: 0,
        views: 0,
        rsvps: 0,
        totalSpent: 0,
    };

    const rawTemplateRatings = (templateRatingsPages || []).flatMap((page) => page.ratings || page.items || []);
    const templateRatings = deduplicateItems(rawTemplateRatings, "templateId");
    const templateRatingsHasMore = Boolean(templateRatingsPages?.[templateRatingsPages.length - 1]?.hasMore);
    const rawPayments = (paymentsPages || []).flatMap((page) => page.payments || page.items || []);
    const payments = deduplicateItems(rawPayments, "id");
    const paymentsLastPage = paymentsPages?.[paymentsPages.length - 1];
    const isTemplateRatingsInitialLoading = Boolean(profile)
        && isTemplateRatingsLoading
        && !templateRatingsPages?.length
        && !templateRatingsError;
    const isPaymentsLoading = hasOpenedTransactions && isPaymentsInitialLoading && !paymentsPages?.length && !paymentsFetchError;
    const shouldHoldInitialProfileSkeleton = !hasChangedTab
        && (
            (activeTab === "templates" && isTemplateRatingsInitialLoading)
            || (activeTab === "transactions" && isPaymentsLoading)
        );
    const paymentsError = paymentsFetchError || paymentsLastPage?.paymentsError || null;

    const displayName = profile?.name || "Guest";
    const initials = getInitials(displayName);
    const greeting = getGreeting();

    const stats = [
        {
            label: "Published",
            value: String(dashboard.published || invitations.filter((item) => item.status === "published").length),
            detail: "Live invitations",
            icon: ClipboardCheck,
            tone: "green",
        },
        {
            label: "Drafts",
            value: String(dashboard.drafts || invitations.filter((item) => item.status === "draft").length),
            detail: "Ready to refine",
            icon: PencilLine,
            tone: "orange",
        },
        {
            label: "Views",
            value: String(dashboard.views),
            detail: "Total invite views",
            icon: Eye,
            tone: "blue",
        },
        {
            label: "RSVPs",
            value: String(dashboard.rsvps),
            detail: "Guests responded",
            icon: UsersRound,
            tone: "rose",
        },
    ];

    const activePublishedCount = dashboard.published || invitations.filter((item) => item.status === "published").length;

    if (shouldHoldInitialProfileSkeleton) {
        return (
            <main className="profilePage" aria-busy="true">
                <ProfilePageSkeleton />
            </main>
        );
    }

    const profileOverview = (
        <section className="profileOverview" aria-label="Profile overview">
            <ProfileCard
                profile={profile}
                activePublishedCount={activePublishedCount}
                totalSpent={dashboard.totalSpent || 0}
                initials={initials}
                greeting={greeting}
            />

            <section className="profileStats" aria-label="Invitation metrics">
                {stats.map((item) => {
                    const Icon = item.icon;

                    return (
                        <article className={`profileStat ${item.tone}`} key={item.label}>
                            <span>
                                <Icon size={24} aria-hidden="true" />
                            </span>
                            <div>
                                <strong>{item.value}</strong>
                                <b>{item.label}</b>
                                <p>{item.detail}</p>
                            </div>
                        </article>
                    );
                })}
            </section>
        </section>
    );

    return (
        <main className="profilePage">
            {profile ? null : profileOverview}

            {profile ? (
                <ProfileActivityTabs
                    header={profileOverview}
                    activeTab={activeTab}
                    onTabChange={(tab) => {
                        setActiveTab(tab);
                        setHasChangedTab(true);
                        if (tab === "transactions") {
                            setHasOpenedTransactions(true);
                        }
                        updateProfileTabUrl(tab);
                    }}
                    templateCount={templateRatingsPages?.[0]?.totalCount ?? null}
                    transactionCount={paymentsPages?.[0]?.totalCount ?? null}
                    templatesPanel={
                        <ProfileUsedTemplates
                            ratings={templateRatings}
                            hasError={Boolean(templateRatingsError)}
                            isLoading={isTemplateRatingsInitialLoading}
                            isLoadingMore={isTemplateRatingsValidating && Boolean(templateRatingsPages?.length)}
                            hasMore={templateRatingsHasMore}
                            pageCount={templateRatingsPages?.length || 0}
                            size={templateRatingsSize}
                            onLoadMore={() => {
                                setTemplateRatingsSize((current) => {
                                    const next = current + 1;
                                    setListSize("templateRatings", next);
                                    return next;
                                });
                            }}
                            onRatingSaved={() => mutateTemplateRatings()}
                            onRetry={() => {
                                setTemplateRatingsSize(1);
                                setListSize("templateRatings", 1);
                                mutateTemplateRatings();
                            }}
                        />
                    }
                    transactionsPanel={
                        <ProfileTransactions
                            payments={payments}
                            hasError={Boolean(paymentsError)}
                            isLoading={isPaymentsLoading}
                            isLoadingMore={isPaymentsValidating && Boolean(paymentsPages?.length)}
                            hasMore={Boolean(paymentsLastPage?.hasMore)}
                            pageCount={paymentsPages?.length || 0}
                            size={paymentsSize}
                            onLoadMore={() => {
                                setPaymentsSize((current) => {
                                    const next = current + 1;
                                    setListSize("payments", next);
                                    return next;
                                });
                            }}
                            onRetry={() => {
                                setPaymentsSize(1);
                                setListSize("payments", 1);
                                mutatePayments();
                            }}
                        />
                    }
                />
            ) : null}
        </main>
    );
}

function ProfileActivityTabs({
    header,
    activeTab,
    onTabChange,
    templateCount,
    transactionCount,
    templatesPanel,
    transactionsPanel,
}: {
    header: ReactNode;
    activeTab: ProfileTab;
    onTabChange: (tab: ProfileTab) => void;
    templateCount: number | null;
    transactionCount: number | null;
    templatesPanel: ReactNode;
    transactionsPanel: ReactNode;
}) {
    const sectionRef = useRef<HTMLElement | null>(null);
    const fixedSectionRef = useRef<HTMLDivElement | null>(null);
    const headerRef = useRef<HTMLDivElement | null>(null);
    const [isTabsPinned, setIsTabsPinned] = useState(false);
    const [fixedSectionHeight, setFixedSectionHeight] = useState(0);
    const tabs: { id: ProfileTab; label: string; count: number | null }[] = [
        { id: "templates", label: "Used Templates", count: templateCount },
        { id: "transactions", label: "Transactions", count: transactionCount },
    ];

    useEffect(() => {
        function updatePinnedState() {
            const section = sectionRef.current;
            const header = headerRef.current;
            if (!section || !window.matchMedia("(max-width: 860px)").matches) {
                setIsTabsPinned(false);
                return;
            }

            const rect = section.getBoundingClientRect();
            const headerHeight = header?.getBoundingClientRect().height || 0;
            setIsTabsPinned(rect.top + headerHeight <= 0 && rect.bottom > 90);
        }

        updatePinnedState();
        window.addEventListener("scroll", updatePinnedState, { passive: true });
        window.addEventListener("resize", updatePinnedState);

        return () => {
            window.removeEventListener("scroll", updatePinnedState);
            window.removeEventListener("resize", updatePinnedState);
        };
    }, []);

    useEffect(() => {
        const fixedSection = fixedSectionRef.current;
        if (!fixedSection) return;
        const fixedSectionElement = fixedSection;

        function updateFixedSectionHeight() {
            if (!window.matchMedia("(min-width: 861px)").matches) {
                setFixedSectionHeight(0);
                return;
            }

            setFixedSectionHeight(Math.ceil(fixedSectionElement.getBoundingClientRect().height));
        }

        updateFixedSectionHeight();
        const resizeObserver = new ResizeObserver(updateFixedSectionHeight);
        resizeObserver.observe(fixedSectionElement);
        window.addEventListener("resize", updateFixedSectionHeight);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", updateFixedSectionHeight);
        };
    }, []);

    function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

        event.preventDefault();
        const nextIndex = event.key === "Home"
            ? 0
            : event.key === "End"
                ? tabs.length - 1
                : event.key === "ArrowRight"
                    ? (currentIndex + 1) % tabs.length
                    : (currentIndex - 1 + tabs.length) % tabs.length;
        const nextTab = tabs[nextIndex];
        onTabChange(nextTab.id);
        document.getElementById(`profile-tab-${nextTab.id}`)?.focus();
    }

    return (
        <section
            className={`profileActivityTabs ${isTabsPinned ? "isProfileTabsPinned" : ""}`}
            aria-label="Profile activity"
            ref={sectionRef}
            style={{ "--profile-fixed-section-height": `${fixedSectionHeight}px` } as CSSProperties}
        >
            <div className="profileFixedDesktopSection" ref={fixedSectionRef}>
                <div className="profileFixedDesktopInner">
                    <div className="profileActivityHeader" ref={headerRef}>
                        {header}
                    </div>
                    <div className="profileTabListBar">
                        <div className="profileTabList" role="tablist" aria-label="Profile sections">
                            {tabs.map((tab, index) => (
                                <button
                                    type="button"
                                    id={`profile-tab-${tab.id}`}
                                    key={tab.id}
                                    className={`profileTabItem ${activeTab === tab.id ? "active" : ""}`}
                                    role="tab"
                                    aria-selected={activeTab === tab.id}
                                    aria-controls={`profile-panel-${tab.id}`}
                                    tabIndex={activeTab === tab.id ? 0 : -1}
                                    onClick={() => onTabChange(tab.id)}
                                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                                >
                                    <span className="profileTabLabel">{tab.label}</span>
                                    {tab.count !== null ? <span className="profileTabBadge">{tab.count}</span> : null}
                                    {activeTab === tab.id ? <span className="profileTabIndicator" /> : null}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div
                id="profile-panel-templates"
                role="tabpanel"
                aria-labelledby="profile-tab-templates"
                hidden={activeTab !== "templates"}
            >
                {activeTab === "templates" ? templatesPanel : null}
            </div>
            <div
                id="profile-panel-transactions"
                role="tabpanel"
                aria-labelledby="profile-tab-transactions"
                hidden={activeTab !== "transactions"}
            >
                {activeTab === "transactions" ? transactionsPanel : null}
            </div>
        </section>
    );
}

function ProfileUsedTemplates({
    ratings,
    hasError,
    isLoading,
    isLoadingMore,
    hasMore,
    pageCount,
    size,
    onLoadMore,
    onRatingSaved,
    onRetry,
}: {
    ratings: TemplateRatingItem[];
    hasError: boolean;
    isLoading: boolean;
    isLoadingMore: boolean;
    hasMore: boolean;
    pageCount: number;
    size: number;
    onLoadMore: () => void;
    onRatingSaved: () => void;
    onRetry: () => void;
}) {
    const sentinelRef = useInfiniteScroll<HTMLDivElement>({
        disabled: shouldDisableSentinel({ hasMore, isLoading: isLoadingMore, size, pageCount }),
        onLoadMore,
    });

    return (
        <section className="profileTemplateRatings" id="template-ratings" aria-label="Used Templates">
            <div className="profileTemplateRatingsSection">
                {isLoading ? (
                    <ProfileTemplateRatingsSkeleton />
                ) : hasError ? (
                    <div className="paymentsErrorCard" role="alert">
                        <span className="paymentsErrorIcon" aria-hidden="true">
                            <AlertTriangle size={18} />
                        </span>
                        <div className="paymentsErrorBody">
                            <strong>Error Loading Used Templates</strong>
                            <p>We could not retrieve your used templates.</p>
                        </div>
                        <button type="button" className="paymentsErrorAction" onClick={onRetry}>
                            <RefreshCw size={14} />
                            <span>Retry</span>
                        </button>
                    </div>
                ) : ratings.length === 0 ? (
                    <div className="paymentsEmptyState">
                        <div className="emptyIconWrap">
                            <Star size={30} />
                        </div>
                        <h2>No purchased templates yet.</h2>
                        <p>Publish an invitation to see your used templates and leave ratings.</p>
                    </div>
                ) : (
                    <div className="profileTemplateRatingGrid">
                        {ratings.map((rating) => (
                            <ProfileTemplateRatingCard
                                item={rating}
                                key={`${rating.templateId}-${rating.userRating ?? 0}`}
                                onRatingSaved={onRatingSaved}
                            />
                        ))}
                        {isLoadingMore ? <ProfileTemplateRatingsAppendSkeleton /> : null}
                        {hasError && ratings.length ? (
                            <div className="listLoadState" role="status">
                                <span>Couldn&apos;t load more</span>
                                <button type="button" onClick={onRetry}>Retry</button>
                            </div>
                        ) : null}
                        {pageCount > 1 && !hasMore && ratings.length ? <div className="listEndState">You&apos;ve reached the end.</div> : null}
                        <div ref={sentinelRef} className="infiniteScrollSentinel" aria-hidden="true" />
                    </div>
                )}
            </div>
        </section>
    );
}

function ProfileTemplateRatingsAppendSkeleton() {
    return (
        <>
            {Array.from({ length: 2 }).map((_, index) => (
                <article className="profileTemplateRatingCard profileTemplateRatingCard--skeleton" key={`append-${index}`}>
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
                            {Array.from({ length: 5 }).map((_, starIndex) => (
                                <Skeleton key={starIndex} style={{ width: 24, height: 24 }} rounded="lg" />
                            ))}
                        </div>
                    </div>
                    <Skeleton className="profileTemplateRatingAction--skeleton" style={{ width: "100%", height: 38 }} rounded="lg" />
                </article>
            ))}
        </>
    );
}

function ProfileTemplateRatingCard({
    item,
    onRatingSaved,
}: {
    item: TemplateRatingItem;
    onRatingSaved: () => void;
}) {
    const [selectedRating, setSelectedRating] = useState(item.userRating || 0);
    const [currentRating, setCurrentRating] = useState(item.userRating || 0);
    const [isSaving, setIsSaving] = useState(false);
    const { showToast } = useToast();

    const communityRating = item.ratingCount && item.averageRating !== null
        ? `${item.averageRating.toFixed(1)} (${item.ratingCount}) ★`
        : null;
    const actionLabel = selectedRating === 0 && currentRating
        ? "Remove Rating"
        : currentRating
            ? "Update Rating"
            : "Rate Template";
    const purchaseLabel = item.purchaseCount === 1
        ? "Purchased 1 time"
        : `Purchased ${item.purchaseCount} times`;
    const usageLabel = item.invitationCount === 1
        ? "Used for 1 invitation"
        : `Used for ${item.invitationCount} invitations`;

    async function handleApplyRating() {
        if (isSaving || (!selectedRating && !currentRating) || selectedRating === currentRating) return;

        setIsSaving(true);
        const previousRating = currentRating;
        setCurrentRating(selectedRating);

        try {
            const response = await fetch(`/api/templates/${encodeURIComponent(item.templateKey)}/rating`, {
                method: selectedRating ? "PUT" : "DELETE",
                ...(selectedRating
                    ? {
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ rating: selectedRating }),
                    }
                    : {}),
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(result.error || "Unable to save rating.");
            }

            setCurrentRating(result.userRating ?? selectedRating);
            showToast(selectedRating ? "Rating saved" : "Rating removed", "success");
            onRatingSaved();
        } catch (error) {
            setCurrentRating(previousRating);
            setSelectedRating(previousRating);
            showToast(error instanceof Error ? error.message : "Unable to save rating.", "error");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <article className="profileTemplateRatingCard">
            <div className="profileTemplateRatingHeader">
                <div className="profileTemplateRatingTitle">
                    <h3>{item.templateName}</h3>
                    <p>{formatCategoryLabel(item.category)} Template</p>
                    {communityRating ? (
                        <span className="profileTemplateCommunityRating">{communityRating}</span>
                    ) : null}
                </div>

                <div className="profileTemplateRatingStats" aria-label={`${usageLabel}. ${purchaseLabel}.`}>
                    <strong>{item.invitationCount}</strong>
                    <span>{usageLabel.replace(/^Used for /, "Used ")}</span>
                    <small>{purchaseLabel}</small>
                </div>
            </div>

            <div className="profileTemplateRatingPanel">
                <div className="profileTemplateRatingPanelCopy">
                    <span>Your rating</span>
                    <strong>{formatUserRatingLabel(currentRating)}</strong>
                </div>
                <div className="profileTemplateRatingStars" aria-label={`Your current rating is ${currentRating || 0} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, index) => {
                        const rating = index + 1;
                        const isActive = rating <= selectedRating;

                        return (
                            <button
                                type="button"
                                key={rating}
                                className={isActive ? "active" : ""}
                                onClick={() => setSelectedRating(selectedRating === rating ? 0 : rating)}
                                aria-label={selectedRating === rating ? "Clear rating selection" : `Select ${rating} out of 5 stars`}
                            >
                                <Star size={19} fill={isActive ? "currentColor" : "none"} aria-hidden="true" />
                            </button>
                        );
                    })}
                </div>
            </div>

            {(item.firstPurchaseAt || item.lastUpdatedAt) ? (
                <div className="profileTemplateRatingDates">
                    {item.firstPurchaseAt ? (
                        <span>
                            <Calendar size={13} aria-hidden="true" />
                            <span>
                                <small>Purchased</small>
                                <strong>{formatTimelineDate(item.firstPurchaseAt)}</strong>
                            </span>
                        </span>
                    ) : null}
                    {item.lastUpdatedAt ? (
                        <span>
                            <Calendar size={13} aria-hidden="true" />
                            <span>
                                <small>Last used</small>
                                <strong>{formatTimelineDate(item.lastUpdatedAt)}</strong>
                            </span>
                        </span>
                    ) : null}
                </div>
            ) : null}

            <button
                type="button"
                className={`profileTemplateRatingAction${selectedRating !== currentRating ? " hasUnsavedSelection" : ""}`}
                onClick={handleApplyRating}
                disabled={isSaving || (!selectedRating && !currentRating) || selectedRating === currentRating}
            >
                {isSaving ? "Saving..." : actionLabel}
            </button>
        </article>
    );
}

function ProfileTemplateRatingsSkeleton() {
    return (
        <div className="profileTemplateRatingGrid" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, index) => (
                <article className="profileTemplateRatingCard profileTemplateRatingCard--skeleton" key={index}>
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
                            {Array.from({ length: 5 }).map((_, starIndex) => (
                                <Skeleton
                                    key={starIndex}
                                    style={{ width: 24, height: 24 }}
                                    rounded="lg"
                                />
                            ))}
                        </div>
                    </div>
                    <div className="profileTemplateRatingDates">
                        <Skeleton style={{ width: 132, height: 34 }} rounded="lg" />
                        <Skeleton style={{ width: 124, height: 34 }} rounded="lg" />
                    </div>
                    <Skeleton className="profileTemplateRatingAction" rounded="lg" />
                </article>
            ))}
        </div>
    );
}

function ProfileTransactions({
    payments,
    hasError,
    isLoading,
    isLoadingMore,
    hasMore,
    pageCount,
    size,
    onLoadMore,
    onRetry,
}: {
    payments: PaymentRecord[];
    hasError: boolean;
    isLoading: boolean;
    isLoadingMore: boolean;
    hasMore: boolean;
    pageCount: number;
    size: number;
    onLoadMore: () => void;
    onRetry: () => void;
}) {
    const sentinelRef = useInfiniteScroll<HTMLDivElement>({
        disabled: shouldDisableSentinel({ hasMore, isLoading: isLoadingMore, size, pageCount }),
        onLoadMore,
    });

    return (
        <section className="profileTransactions" id="profile-transactions" aria-label="Transactions">
            <div className="paymentsSection">
                {isLoading ? (
                    <ProfileTransactionsSkeleton />
                ) : hasError ? (
                    <div className="paymentsErrorCard" role="alert">
                        <span className="paymentsErrorIcon" aria-hidden="true">
                            <AlertTriangle size={18} />
                        </span>
                        <div className="paymentsErrorBody">
                            <strong>Error Loading Records</strong>
                            <p>We could not retrieve your transaction logs.</p>
                        </div>
                        <button type="button" className="paymentsErrorAction" onClick={onRetry}>
                            <RefreshCw size={14} />
                            <span>Reload</span>
                        </button>
                    </div>
                ) : payments.length === 0 ? (
                    <div className="paymentsEmptyState">
                        <div className="emptyIconWrap">
                            <Receipt size={30} />
                        </div>
                        <h2>No transactions yet.</h2>
                        <p>Your successful template purchases will appear here.</p>
                    </div>
                ) : (
                    <div className="paymentsList">
                        {payments.map((payment) => (
                            <PaymentRecordCard payment={payment} key={payment.id} />
                        ))}
                        {isLoadingMore ? <ProfileTransactionsAppendSkeleton /> : null}
                        {hasError && payments.length ? (
                            <div className="listLoadState" role="status">
                                <span>Couldn&apos;t load more</span>
                                <button type="button" onClick={onLoadMore}>Retry</button>
                            </div>
                        ) : null}
                        {pageCount > 1 && !hasMore && payments.length ? <div className="listEndState">You&apos;ve reached the end.</div> : null}
                        <div ref={sentinelRef} className="infiniteScrollSentinel" aria-hidden="true" />
                    </div>
                )}
            </div>
        </section>
    );
}

function ProfileTransactionsAppendSkeleton() {
    return (
        <>
            {Array.from({ length: 2 }).map((_, index) => (
                <PaymentSkeletonCard key={`append-${index}`} />
            ))}
        </>
    );
}

function ProfileTransactionsSkeleton() {
    return (
        <div className="paymentsList" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, index) => (
                <PaymentSkeletonCard key={index} />
            ))}
        </div>
    );
}

function PaymentSkeletonCard() {
    return (
        <article className="profileTransactionCard profileTransactionCard--skeleton" aria-hidden="true">
            <div className="profileTransactionTop">
                <Skeleton className="profileTransactionIcon" rounded="lg" />
                <div className="profileTransactionBody">
                    <div className="profileTransactionTitle">
                        <TextSkeleton className="profileTransactionTitleSkeleton" width={132} height={16} />
                    </div>
                    <TextSkeleton className="profileTransactionSubtitleSkeleton" width={160} height={12} />
                </div>
                <div className="profileTransactionHeaderActions">
                    <Skeleton className="profileTransactionStatusSkeleton" rounded="full" />
                    <Skeleton className="profileTransactionMenuSkeleton" rounded="md" />
                </div>
                <div className="profileTransactionAside profileTransactionAside--skeleton">
                    <TextSkeleton className="profileTransactionAmountSkeleton" width={52} height={20} />
                </div>
            </div>
            <div className="profileTransactionMeta">
                <span className="profileTransactionMetaSkeleton">
                    <Skeleton className="profileTransactionMetaIconSkeleton" rounded="sm" />
                    <TextSkeleton className="profileTransactionMetaTextSkeleton" width={132} height={12} />
                </span>
                <span className="profileTransactionMetaSkeleton profileTransactionMetaSkeleton--receipt">
                    <Skeleton className="profileTransactionMetaIconSkeleton" rounded="sm" />
                    <TextSkeleton className="profileTransactionMetaTextSkeleton" width={150} height={12} />
                </span>
            </div>
        </article>
    );
}

function PaymentRecordCard({ payment }: { payment: PaymentRecord }) {
    const [downloadingDocument, setDownloadingDocument] = useState<"invoice" | "refund" | null>(null);
    const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
    const actionMenuRef = useRef<HTMLDivElement | null>(null);
    const { showToast } = useToast();
    const templateName = payment.templateName || "Premium Design";
    const invitationTitle = payment.invitationTitle || "Deleted Invitation";
    const publicUrl = payment.invitationSlug ? getPublicInvitationUrl(payment.invitationSlug) : null;
    const dateString = formatTransactionDate(payment.created_at);
    const lifecycle = getTransactionLifecycle(payment);
    const status = getPaymentStatus(lifecycle);
    const StatusIcon = status.icon;
    const CardIcon = invitationTitle === "Deleted Invitation" ? Trash2 : StatusIcon;
    const amountLabel = formatPaiseToCurrency(payment.amount_paise, payment.currency);
    const refundReference = payment.refund_reference || null;
    const invitationAccessRevoked = lifecycle === "refunded" && !publicUrl;
    const isDownloadingInvoice = downloadingDocument === "invoice";
    const isDownloadingRefund = downloadingDocument === "refund";
    const showPrimaryAction = lifecycle === "refund_pending";
    const canDownloadInvoice = lifecycle !== "failed" && lifecycle !== "recovery_pending" && lifecycle !== "processing";
    const canDownloadRefundReceipt = lifecycle === "refunded" && Boolean(refundReference);
    const showRefundPendingReceiptMessage = lifecycle === "refund_pending";
    const showActions = showPrimaryAction || canDownloadInvoice || canDownloadRefundReceipt || showRefundPendingReceiptMessage;

    useEffect(() => {
        if (!isActionMenuOpen) return;

        function handlePointerDown(event: PointerEvent) {
            const target = event.target;
            if (!(target instanceof Node) || actionMenuRef.current?.contains(target)) return;
            setIsActionMenuOpen(false);
        }

        function handleKeyDown(event: globalThis.KeyboardEvent) {
            if (event.key === "Escape") setIsActionMenuOpen(false);
        }

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isActionMenuOpen]);

    async function handleDownloadDocument(kind: "invoice" | "refund") {
        if (downloadingDocument) return;
        setIsActionMenuOpen(false);
        setDownloadingDocument(kind);
        try {
            await downloadServerDocument(payment.id, kind);
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Unable to download document.", "error");
        } finally {
            setDownloadingDocument(null);
        }
    }

    return (
        <article className={`profileTransactionCard ${showActions ? "profileTransactionCard--withActions" : "profileTransactionCard--noActions"}`}>
            <div className="profileTransactionTop">
                <div className={`profileTransactionIcon profileTransactionIcon--${status.className}`}>
                    <CardIcon size={18} aria-hidden="true" />
                </div>

                <div className="profileTransactionBody">
                    <div className="profileTransactionTitle">
                        <h3>{templateName}</h3>
                    </div>

                    <p>
                        <strong>{invitationTitle}</strong>
                    </p>
                </div>

                <div className="profileTransactionHeaderActions">
                    <span className={`paymentStatusBadge profileTransactionHeaderBadge ${status.className}`}>
                        <StatusIcon size={12} />
                        <span>{status.label}</span>
                    </span>

                    {showActions ? (
                        <div className="profileTransactionMenu" ref={actionMenuRef}>
                            <button
                                type="button"
                                className="profileTransactionMenuButton"
                                aria-label="Transaction actions"
                                aria-expanded={isActionMenuOpen}
                                onClick={() => setIsActionMenuOpen((current) => !current)}
                            >
                                <MoreVertical size={16} aria-hidden="true" />
                            </button>

                            {isActionMenuOpen ? (
                                <div className="profileTransactionMenuPanel" role="menu">
                                    {lifecycle === "refund_pending" ? (
                                        <span className="profileTransactionMenuItem profileTransactionMenuItem--muted" role="menuitem">
                                            <Loader2 size={13} className="spinner" />
                                            <span>Refund Pending</span>
                                        </span>
                                    ) : null}

                                    {canDownloadInvoice ? (
                                        <button
                                            type="button"
                                            className="profileTransactionMenuItem"
                                            role="menuitem"
                                            onClick={() => handleDownloadDocument("invoice")}
                                            disabled={Boolean(downloadingDocument)}
                                        >
                                            {isDownloadingInvoice ? <Loader2 size={13} className="spinner" /> : <Download size={13} />}
                                            <span>{isDownloadingInvoice ? "Preparing..." : "Invoice"}</span>
                                        </button>
                                    ) : null}

                                    {canDownloadRefundReceipt ? (
                                        <button
                                            type="button"
                                            className="profileTransactionMenuItem"
                                            role="menuitem"
                                            onClick={() => handleDownloadDocument("refund")}
                                            disabled={Boolean(downloadingDocument)}
                                        >
                                            {isDownloadingRefund ? <Loader2 size={13} className="spinner" /> : <Download size={13} />}
                                            <span>{isDownloadingRefund ? "Preparing..." : "Refund Receipt"}</span>
                                        </button>
                                    ) : showRefundPendingReceiptMessage ? (
                                        <span className="profileTransactionMenuItem profileTransactionMenuItem--muted" role="menuitem">
                                            Refund receipt after completion
                                        </span>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <div className="profileTransactionAside">
                    <strong>{amountLabel}</strong>
                    <span>{payment.currency}</span>
                </div>
            </div>

            {status.message ? (
                <div className={`profileTransactionNotice ${status.className}`}>
                    {status.message}
                </div>
            ) : null}

            {invitationAccessRevoked ? (
                <div className="profileTransactionAccessRevoked">
                    Invitation access revoked.
                </div>
            ) : null}

            <div className="profileTransactionMeta">
                <span className="profileTransactionDate">
                    <Calendar size={13} aria-hidden="true" />
                    <span>{dateString}</span>
                </span>
                {payment.receipt ? (
                    <span className="profileTransactionRef">
                        <Receipt size={13} aria-hidden="true" />
                        Receipt #{formatTransactionReference(payment.receipt)}
                    </span>
                ) : null}
            </div>
        </article>
    );
}

async function downloadServerDocument(transactionId: string, kind: "invoice" | "refund") {
    const response = await fetch(`/api/profile/transactions/${encodeURIComponent(transactionId)}/${kind === "invoice" ? "invoice" : "refund-receipt"}`);
    if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error || "Unable to download document.");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = getDownloadFileName(response.headers.get("Content-Disposition"), kind, transactionId);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function getDownloadFileName(contentDisposition: string | null, kind: "invoice" | "refund", fallback: string) {
    const match = contentDisposition?.match(/filename="([^"]+)"/i);
    if (match?.[1]) return match[1];
    return `vilique-${kind === "invoice" ? "invoice" : "refund"}-${fallback}.pdf`;
}

function formatTransactionDate(value: string, options: { includeTime?: boolean } = {}) {
    const includeTime = options.includeTime ?? true;
    const date = new Date(value);
    const day = new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);

    if (!includeTime) return day;

    const time = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(date);

    return `${day} · ${time}`;
}

function formatTransactionReference(value: string) {
    return value.replace(/^(rcpt_|rfnd_)/i, "").slice(0, 6).toUpperCase();
}

function formatCategoryLabel(category: string) {
    return category
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function formatTimelineDate(value: string) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(value));
}

function formatUserRatingLabel(value: number) {
    if (!value) return "Not rated";
    return `${value} out of 5`;
}

function getInitialProfileTab(): ProfileTab {
    if (typeof window === "undefined") return "templates";
    const tab = new URLSearchParams(window.location.search).get("tab");
    return tab === "transactions" ? "transactions" : "templates";
}

function updateProfileTabUrl(tab: ProfileTab) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
}

function getPaymentStatus(status: TransactionLifecycleState) {
    if (status === "paid") {
        return { label: "Paid", className: "paid", icon: CheckCircle2 };
    }
    if (status === "failed") {
        return { label: "Failed", className: "failed", icon: AlertTriangle };
    }
    if (status === "refund_pending") {
        return { label: "Refund Pending", className: "refundPending", icon: RefreshCw };
    }
    if (status === "refunded") {
        return { label: "Refunded", className: "refunded", icon: RefreshCw };
    }
    if (status === "recovery_pending") {
        return {
            label: "Publishing...",
            className: "recovery",
            icon: Loader2,
            message: "Your payment was successful. Publishing is being completed automatically. Please do not pay again.",
        };
    }
    return { label: "Not Completed", className: "cancelled", icon: HelpCircle };
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
}

function getInitials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "VQ";
}
