"use client";

import { KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import ProfilePageSkeleton from "@/components/skeletons/ProfilePageSkeleton";
import { useIsClient } from "@/hooks/useIsClient";
import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    ClipboardCheck,
    Download,
    ExternalLink,
    Eye,
    HelpCircle,
    PencilLine,
    Receipt,
    RefreshCw,
    Star,
    UsersRound,
} from "lucide-react";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import ListState from "@/components/ListState";
import ProfileCard from "@/components/ProfileCard";
import { Skeleton, TextSkeleton } from "@/components/ui/Skeleton";
import { getPublicInvitationUrl } from "@/lib/config/site";
import { formatPaiseToCurrency } from "@/lib/currency";
import { useScrollPreservation } from "./NavigationStateProvider";
import { InvitationData } from "@/types/invitation";
import { useToast } from "./Toast";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

type PaymentRecord = {
    id: string;
    invitation_id: string;
    template_id: string | null;
    amount_paise: number;
    currency: string;
    status: string;
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

export default function ProfilePageClient() {
    const isClient = useIsClient();
    const [activeTab, setActiveTab] = useState<ProfileTab>(() => getInitialProfileTab());
    const [hasOpenedTransactions, setHasOpenedTransactions] = useState(() => getInitialProfileTab() === "transactions");
    const [hasChangedTab, setHasChangedTab] = useState(false);

    const {
        data: dashboardData,
        error: dashboardError,
        mutate: mutateDashboard,
    } = useSWR(isClient ? "/api/profile/dashboard" : null, null, { suspense: false });
    const {
        data: templateRatingsPages,
        error: templateRatingsError,
        mutate: mutateTemplateRatings,
        setSize: setTemplateRatingsSize,
        isLoading: isTemplateRatingsLoading,
        isValidating: isTemplateRatingsValidating,
    } = useSWRInfinite<PaginatedTemplateRatings>((pageIndex, previousPageData) => {
        if (!isClient || !dashboardData?.profile) return null;
        if (previousPageData && !previousPageData.hasMore) return null;
        const params = new URLSearchParams({ sort: "recently_used", limit: "9" });
        if (pageIndex && previousPageData?.nextCursor) params.set("cursor", previousPageData.nextCursor);
        return `/api/profile/template-ratings?${params.toString()}`;
    }, null, { suspense: false, keepPreviousData: true, revalidateFirstPage: false });
    const {
        data: paymentsPages,
        error: paymentsFetchError,
        setSize: setPaymentsSize,
        isLoading: isPaymentsInitialLoading,
        isValidating: isPaymentsValidating,
    } = useSWRInfinite<PaginatedPayments>((pageIndex, previousPageData) => {
        if (!isClient || !dashboardData?.profile || !hasOpenedTransactions) return null;
        if (previousPageData && !previousPageData.hasMore) return null;
        const params = new URLSearchParams({ sort: "newest", limit: "10" });
        if (pageIndex && previousPageData?.nextCursor) params.set("cursor", previousPageData.nextCursor);
        return `/api/profile/payments?${params.toString()}`;
    }, null, { suspense: false, keepPreviousData: true, revalidateFirstPage: false });

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

    if (isClient && dashboardError?.status === 401) {
        return (
            <>
                <AuthRequiredModal next="/profile" />
                <main className="profilePage" aria-busy="true">
                    <ProfilePageSkeleton />
                </main>
            </>
        );
    }

    if (isClient && dashboardError) {
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

    if (!isClient || !dashboardData) {
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

    const templateRatings = (templateRatingsPages || []).flatMap((page) => page.ratings || page.items || []);
    const templateRatingsHasMore = Boolean(templateRatingsPages?.[templateRatingsPages.length - 1]?.hasMore);
    const payments = (paymentsPages || []).flatMap((page) => page.payments || page.items || []);
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

    return (
        <main className="profilePage">
            <AuthRequiredModal next="/profile" />

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

            {profile ? (
                <ProfileActivityTabs
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
                            onLoadMore={() => setTemplateRatingsSize((current) => current + 1)}
                            onRatingSaved={() => mutateTemplateRatings()}
                            onRetry={() => mutateTemplateRatings()}
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
                            onLoadMore={() => setPaymentsSize((current) => current + 1)}
                        />
                    }
                />
            ) : null}
        </main>
    );
}

function ProfileActivityTabs({
    activeTab,
    onTabChange,
    templateCount,
    transactionCount,
    templatesPanel,
    transactionsPanel,
}: {
    activeTab: ProfileTab;
    onTabChange: (tab: ProfileTab) => void;
    templateCount: number | null;
    transactionCount: number | null;
    templatesPanel: ReactNode;
    transactionsPanel: ReactNode;
}) {
    const sectionRef = useRef<HTMLElement | null>(null);
    const [isTabsPinned, setIsTabsPinned] = useState(false);
    const tabs: { id: ProfileTab; label: string; count: number | null }[] = [
        { id: "templates", label: "Used Templates", count: templateCount },
        { id: "transactions", label: "Transactions", count: transactionCount },
    ];

    useEffect(() => {
        function updatePinnedState() {
            const section = sectionRef.current;
            if (!section || !window.matchMedia("(max-width: 860px)").matches) {
                setIsTabsPinned(false);
                return;
            }

            const rect = section.getBoundingClientRect();
            setIsTabsPinned(rect.top <= 0 && rect.bottom > 90);
        }

        updatePinnedState();
        window.addEventListener("scroll", updatePinnedState, { passive: true });
        window.addEventListener("resize", updatePinnedState);

        return () => {
            window.removeEventListener("scroll", updatePinnedState);
            window.removeEventListener("resize", updatePinnedState);
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
        >
            <div className="profileTabList" role="tablist" aria-label="Profile sections">
                {tabs.map((tab, index) => (
                    <button
                        type="button"
                        id={`profile-tab-${tab.id}`}
                        key={tab.id}
                        className={activeTab === tab.id ? "active" : ""}
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        aria-controls={`profile-panel-${tab.id}`}
                        tabIndex={activeTab === tab.id ? 0 : -1}
                        onClick={() => onTabChange(tab.id)}
                        onKeyDown={(event) => handleTabKeyDown(event, index)}
                    >
                        <span>{tab.label}</span>
                        {tab.count !== null ? <b>{tab.count}</b> : null}
                    </button>
                ))}
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
    onLoadMore: () => void;
    onRatingSaved: () => void;
    onRetry: () => void;
}) {
    const sentinelRef = useInfiniteScroll<HTMLDivElement>({
        disabled: !hasMore || isLoadingMore,
        onLoadMore,
    });

    return (
        <section className="profileTemplateRatings" id="template-ratings" aria-label="Used Templates">
            <div className="profileTemplateRatingsSection">
                {isLoading ? (
                    <ProfileTemplateRatingsSkeleton />
                ) : hasError ? (
                    <div className="paymentsErrorCard">
                        <AlertTriangle size={20} />
                        <div>
                            <strong>Error Loading Used Templates</strong>
                            <p>We could not retrieve your used templates.</p>
                            <button type="button" className="profileTabRetryBtn" onClick={onRetry}>Retry</button>
                        </div>
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
                    <Skeleton className="profileTemplateRatingAction" rounded="lg" />
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
                className="profileTemplateRatingAction"
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
    onLoadMore,
}: {
    payments: PaymentRecord[];
    hasError: boolean;
    isLoading: boolean;
    isLoadingMore: boolean;
    hasMore: boolean;
    pageCount: number;
    onLoadMore: () => void;
}) {
    const sentinelRef = useInfiniteScroll<HTMLDivElement>({
        disabled: !hasMore || isLoadingMore,
        onLoadMore,
    });

    return (
        <section className="profileTransactions" id="profile-transactions" aria-label="Transactions">
            <div className="paymentsSection">
                {isLoading ? (
                    <ProfileTransactionsSkeleton />
                ) : hasError ? (
                    <div className="paymentsErrorCard">
                        <AlertTriangle size={20} />
                        <div>
                            <strong>Error Loading Records</strong>
                            <p>We could not retrieve your transaction logs. Please reload the page.</p>
                        </div>
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
                        <TextSkeleton width={132} height={16} />
                        <Skeleton style={{ width: 62, height: 20 }} rounded="full" />
                    </div>
                    <TextSkeleton width={160} height={12} />
                </div>
                <div className="profileTransactionAside">
                    <TextSkeleton width={52} height={20} />
                    <TextSkeleton width={26} height={10} />
                </div>
            </div>
            <div className="profileTransactionMeta">
                <TextSkeleton width={160} height={12} />
                <TextSkeleton width={140} height={18} />
            </div>
            <div className="profileTransactionAction">
                <Skeleton style={{ width: 134, height: 30 }} rounded="lg" />
            </div>
        </article>
    );
}

function PaymentRecordCard({ payment }: { payment: PaymentRecord }) {
    const templateName = payment.templateName || "Premium Design";
    const invitationTitle = payment.invitationTitle || "Deleted Invitation";
    const publicUrl = payment.invitationSlug ? getPublicInvitationUrl(payment.invitationSlug) : null;
    const dateString = new Date(payment.created_at).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
    const status = getPaymentStatus(payment.status);
    const StatusIcon = status.icon;

    return (
        <article className="profileTransactionCard">
            <div className="profileTransactionTop">
                <div className="profileTransactionIcon">
                    <Receipt size={18} aria-hidden="true" />
                </div>

                <div className="profileTransactionBody">
                    <div className="profileTransactionTitle">
                        <h3>{templateName}</h3>
                        <span className={`paymentStatusBadge ${status.className}`}>
                            <StatusIcon size={12} />
                            <span>{status.label}</span>
                        </span>
                    </div>

                    <p>
                        For <strong>{invitationTitle}</strong>
                    </p>
                </div>

                <div className="profileTransactionAside">
                    <strong>{formatPaiseToCurrency(payment.amount_paise, payment.currency)}</strong>
                    <span>{payment.currency}</span>
                </div>
            </div>

            <div className="profileTransactionMeta">
                <span className="profileTransactionDate">
                    <Calendar size={13} className="metaIcon" />
                    <span>{dateString}</span>
                </span>
                {payment.receipt ? (
                    <span className="profileTransactionRef">
                        <span className="refLabel">Ref</span>
                        <code>{payment.receipt}</code>
                    </span>
                ) : null}
            </div>

            <div className="profileTransactionAction">
                {publicUrl && payment.status === "paid" ? (
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="paymentLinkAction">
                        <ExternalLink size={13} />
                        <span>View Site</span>
                    </a>
                ) : (
                    <span className="paymentNoAction">No public link</span>
                )}
                <button
                    type="button"
                    className="paymentInvoiceAction"
                    onClick={() => downloadPaymentInvoice({ dateString, invitationTitle, payment, statusLabel: status.label, templateName })}
                >
                    <Download size={13} />
                    <span>Invoice</span>
                </button>
            </div>
        </article>
    );
}

function downloadPaymentInvoice({
    dateString,
    invitationTitle,
    payment,
    statusLabel,
    templateName,
}: {
    dateString: string;
    invitationTitle: string;
    payment: PaymentRecord;
    statusLabel: string;
    templateName: string;
}) {
    const invoiceNumber = payment.receipt || payment.id;
    const fileName = `vilique-invoice-${sanitizeFileName(invoiceNumber)}.html`;
    const html = buildInvoiceHtml({
        amount: formatPaiseToCurrency(payment.amount_paise, payment.currency),
        currency: payment.currency,
        dateString,
        invitationTitle,
        invoiceNumber,
        statusLabel,
        templateName,
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function buildInvoiceHtml({
    amount,
    currency,
    dateString,
    invitationTitle,
    invoiceNumber,
    statusLabel,
    templateName,
}: {
    amount: string;
    currency: string;
    dateString: string;
    invitationTitle: string;
    invoiceNumber: string;
    statusLabel: string;
    templateName: string;
}) {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Vilique Invoice ${escapeHtml(invoiceNumber)}</title>
  <style>
    body { margin: 0; padding: 32px; color: #1f1235; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fbf7ff; }
    .invoice { max-width: 720px; margin: 0 auto; border: 1px solid #eadff3; border-radius: 20px; padding: 28px; background: #fff; box-shadow: 0 24px 70px rgba(42, 30, 36, .08); }
    header { display: flex; justify-content: space-between; gap: 18px; border-bottom: 1px solid #eee6f5; padding-bottom: 18px; }
    h1 { margin: 0; font-size: 28px; }
    .brand { color: #7e3ff2; font-size: 13px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    .amount { text-align: right; }
    .amount strong { display: block; font-size: 32px; line-height: 1; }
    .amount span, .muted { color: #8b7c9f; font-size: 13px; font-weight: 750; }
    dl { display: grid; grid-template-columns: 180px 1fr; gap: 12px 20px; margin: 24px 0 0; }
    dt { color: #8b7c9f; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
    dd { margin: 0; font-weight: 800; }
    .status { color: #16a34a; }
    footer { margin-top: 26px; padding-top: 16px; border-top: 1px solid #eee6f5; color: #8b7c9f; font-size: 12px; }
  </style>
</head>
<body>
  <main class="invoice">
    <header>
      <div>
        <div class="brand">Vilique</div>
        <h1>Invoice</h1>
        <p class="muted">${escapeHtml(invoiceNumber)}</p>
      </div>
      <div class="amount">
        <strong>${escapeHtml(amount)}</strong>
        <span>${escapeHtml(currency)}</span>
      </div>
    </header>
    <dl>
      <dt>Template</dt><dd>${escapeHtml(templateName)}</dd>
      <dt>Invitation</dt><dd>${escapeHtml(invitationTitle)}</dd>
      <dt>Date</dt><dd>${escapeHtml(dateString)}</dd>
      <dt>Status</dt><dd class="status">${escapeHtml(statusLabel)}</dd>
      <dt>Reference</dt><dd>${escapeHtml(invoiceNumber)}</dd>
    </dl>
    <footer>This invoice was generated from your Vilique transaction history.</footer>
  </main>
</body>
</html>`;
}

function sanitizeFileName(value: string) {
    return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "transaction";
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
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

function getPaymentStatus(status: string) {
    if (status === "paid") {
        return { label: "Paid", className: "paid", icon: CheckCircle2 };
    }
    if (status === "failed") {
        return { label: "Failed", className: "failed", icon: AlertTriangle };
    }
    if (status === "refunded") {
        return { label: "Refunded", className: "refunded", icon: RefreshCw };
    }
    if (status === "cancelled") {
        return { label: "Cancelled", className: "cancelled", icon: AlertTriangle };
    }
    if (status === "partially_refunded") {
        return { label: "Part. Refunded", className: "refunded", icon: RefreshCw };
    }
    return { label: "Pending", className: "pending", icon: HelpCircle };
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
