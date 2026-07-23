"use client";

import { useEffect, useRef, useState, useCallback, useMemo, type UIEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWRInfinite from "swr/infinite";
import {
    CalendarDays,
    Clock,
    RefreshCw,
    Eye,
    BarChart3,
    PencilLine,
    Trash2,
    Search,
    X,
    ExternalLink,
    Copy,
    Check,
    Loader2,
    Power,
    AlertTriangle,
    FileText,
    CalendarCheck,
    Sparkles,
    CheckCircle2,
    WifiOff,
    Wifi,
    Lock,
    MoreVertical,
} from "lucide-react";
import { deleteInvitation } from "@/app/(app)/profile/actions";
import ListState from "@/components/ListState";
import { InvitationData } from "@/types/invitation";
import { getPublicInvitationUrl } from "@/lib/config/site";
import { getInvitationLifecycle, isInvitationCompleted, InvitationLifecycleStatus } from "@/lib/lifecycle";
import ConfirmModal from "./ConfirmModal";
import { useToast } from "./Toast";
import { useNavigationState } from "./NavigationStateProvider";
import { useSWRConfig } from "swr";
import { ButtonSkeleton, Skeleton, TextSkeleton } from "@/components/ui/Skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useTopOnlyHeaderVisibility } from "@/hooks/useTopOnlyHeaderVisibility";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import { useLineLoader } from "./TopLineLoader";
import { deduplicateItems, shouldStopRequesting, shouldDisableSentinel } from "@/lib/pagination";
import {
    InvitationsPageResponse,
    DashboardData,
    mutateInvitationState,
    getInvitationFilterBucket,
    adjustInvitationCounts,
    applyInvitationMutationsToPages,
    getPendingItemMutations,
    clearConfirmedPendingMutations,
    isInvitationVisibleInFilter,
    deriveInvitationFilterCacheState,
    reconcileInvitationCounts,
    type PendingMutation,
} from "@/lib/invitationCache";

interface ProfileInvitationsListProps {
    initialInvitations?: InvitationData[];
    invitationStats?: Record<string, { rsvps: number; views: number; acceptsRsvps?: boolean }>;
    showAuthModalOnUnauthorized?: boolean;
}

async function fetchInvitationPage(url: string): Promise<InvitationsPageResponse> {
    const clientRequestStartedAt = Date.now();
    const response = await fetch(url);
    if (!response.ok) {
        const error = new Error("An error occurred while fetching invitations.") as Error & {
            status?: number;
            info?: unknown;
        };
        error.status = response.status;
        error.info = await response.json().catch(() => ({}));
        throw error;
    }
    const result = await response.json() as InvitationsPageResponse;
    return {
        ...result,
        clientRequestStartedAt,
        clientReceivedAt: Date.now(),
    };
}

export default function ProfileInvitationsList({
    initialInvitations = [],
    invitationStats = {},
    showAuthModalOnUnauthorized = true,
}: ProfileInvitationsListProps) {
    const {
        invitationsSearch: searchTerm,
        setInvitationsSearch: setSearchTerm,
        invitationsFilter: statusFilter,
        setInvitationsFilter: setStatusFilter,
        listSizes,
        setListSize,
    } = useNavigationState();

    const { cache, mutate: globalMutate } = useSWRConfig();
    const refreshInvitationLists = useCallback(() => globalMutate(
        (key) => typeof key === "string" && (key.startsWith("/api/invitations") || key.startsWith("$inf$/api/invitations"))
    ), [globalMutate]);

    const debouncedSearch = useDebouncedValue(searchTerm, searchTerm ? 350 : 0);
    const [cachedCounts, setCachedCounts] = useState<Record<string, number> | null>(null);
    const [optimisticMutations, setOptimisticMutations] = useState<PendingMutation[]>([]);
    const {
        headerRevealRef,
        scheduleVisibilityUpdate:
            scheduleMobileTitleVisibilityUpdate,
    } = useTopOnlyHeaderVisibility({
        mediaQuery: "(max-width: 560px)",
        titleHeight: 44,
        expandedTopPadding: 18,
        collapsedTopPadding: 8,
        searchSpacing: 12,
    });
    const tabSizeKey = `invitations_${statusFilter}${debouncedSearch ? `_${debouncedSearch}` : ""}`;
    const savedSize = listSizes[tabSizeKey] ?? 1;

    const prevStatusFilterRef = useRef(statusFilter);
    const prevDebouncedSearchRef = useRef(debouncedSearch);

    const updateCountsState = useCallback((newCounts: Record<string, number>) => {
        setCachedCounts(newCounts);
        try {
            sessionStorage.setItem("invitations_cached_counts", JSON.stringify(newCounts));
        } catch {
            // Ignore storage quota error
        }
    }, []);

    const {
        data,
        error,
        size,
        setSize,
        isValidating,
        mutate,
    } = useSWRInfinite<InvitationsPageResponse>((pageIndex, previousPageData) => {
        if (shouldStopRequesting(previousPageData)) return null;
        const params = new URLSearchParams({
            status: statusFilter,
            sort: "updated_desc",
            limit: "10",
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (pageIndex && previousPageData?.nextCursor) params.set("cursor", previousPageData.nextCursor);
        return `/api/invitations?${params.toString()}`;
    }, fetchInvitationPage, {
        suspense: false,
        keepPreviousData: false,
        revalidateFirstPage: true,
        revalidateOnMount: true,
        revalidateIfStale: true,
        initialSize: savedSize,
        onSuccess: (invitationPages) => {
            const pendingMutations = getPendingItemMutations();
            const nextCounts = invitationPages?.[0]?.counts;
            const requestStartedAt = invitationPages?.[0]?.clientRequestStartedAt || 0;
            if (nextCounts) {
                updateCountsState(reconcileInvitationCounts(nextCounts, pendingMutations, requestStartedAt));
            }
            clearConfirmedPendingMutations(invitationPages, statusFilter);

            if (invitationPages) {
                setOptimisticMutations((prev) =>
                    prev.filter((mutation) => mutation.timestamp > requestStartedAt)
                );
            }
        },
    });

    const rawPages = useMemo(() => data || [], [data]);
    const itemMutations = useMemo(() => {
        const storeMutations = getPendingItemMutations();
        const mutationMap = new Map<string, PendingMutation>();
        for (const mutation of [...storeMutations, ...optimisticMutations]) {
            const existing = mutationMap.get(mutation.id);
            if (!existing || mutation.timestamp >= existing.timestamp) {
                mutationMap.set(mutation.id, mutation);
            }
        }
        return Array.from(mutationMap.values());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [optimisticMutations, statusFilter, rawPages]);
    const pages = useMemo(
        () => applyInvitationMutationsToPages(rawPages, itemMutations, statusFilter) || rawPages,
        [rawPages, itemMutations, statusFilter]
    );
    const cacheState = useMemo(() => deriveInvitationFilterCacheState({
        pages,
        isValidating,
        error,
        pendingMutations: itemMutations,
    }), [error, isValidating, itemMutations, pages]);

    const invitations = useMemo(() => {
        const rawInvitations = pages.flatMap((page) => page.items || []);
        const deduped = deduplicateItems(rawInvitations, "id");
        if (statusFilter === "all") return deduped;
        return deduped.filter((item) => isInvitationVisibleInFilter(item, statusFilter));
    }, [pages, statusFilter]);
    const firstPage = pages[0];
    const fallbackCounts = {
        all: initialInvitations.length,
        upcoming: 0,
        completed: 0,
        draft: 0,
        offline: 0,
    };
    const latestCounts = firstPage?.counts;
    const counts = cachedCounts || latestCounts || fallbackCounts;
    const hasMore = cacheState.hasMore;
    const mergedStats = pages.reduce((acc: Record<string, { rsvps: number; views: number; acceptsRsvps?: boolean }>, page: InvitationsPageResponse) => ({ ...acc, ...page.stats }), invitationStats);
    const shouldShowEndState = pages.length > 1 && !hasMore;
    const isSearching = searchTerm !== debouncedSearch;
    const isLoadingFirstPage = cacheState.isInitialLoading || isSearching;
    const isLoadingInitialTabs = cacheState.isInitialLoading && !cachedCounts;
    const isLoadingNextPage = isValidating && cacheState.hasLoadedInitialPage && hasMore && size > pages.length;
    const hasActiveFilters = Boolean(searchTerm) || statusFilter !== "all";

    useEffect(() => {
        if (process.env.NODE_ENV !== "production") {
            console.log(`[InvitationsCache] ProfileInvitationsList rendered at ${Date.now()}`, {
                statusFilter,
                size,
                rawPagesCount: rawPages.length,
                isLoadingFirstPage,
                hasCachedData: Boolean(data),
            });
        }
    }, [statusFilter, size, rawPages.length, isLoadingFirstPage, data]);

    const statusLabels: Record<string, string> = {
        all: "All",
        upcoming: "Upcoming",
        completed: "Completed",
        draft: "Drafts",
        offline: "Offline",
    };
    const emptyStateDetails = [
        statusFilter !== "all" ? `Tab: ${statusLabels[statusFilter] || statusFilter}` : null,
        searchTerm ? `Search: ${searchTerm}` : null,
    ].filter(Boolean) as string[];

    const handleLoadMore = () => {
        setSize((current) => {
            const next = current + 1;
            setListSize(tabSizeKey, next);
            return next;
        });
    };

    const sentinelRef = useInfiniteScroll<HTMLDivElement>({
        disabled: shouldDisableSentinel({ hasMore, isLoading: isLoadingNextPage, size, pageCount: pages.length }),
        onLoadMore: handleLoadMore,
    });
    const isUnauthorized = error?.status === 401;

    useEffect(() => {
        const hasFilterChanged = prevStatusFilterRef.current !== statusFilter || prevDebouncedSearchRef.current !== debouncedSearch;

        if (hasFilterChanged) {
            prevStatusFilterRef.current = statusFilter;
            prevDebouncedSearchRef.current = debouncedSearch;
            const restoredSize = listSizes[tabSizeKey] ?? 1;
            setSize(restoredSize);
        }
    }, [statusFilter, debouncedSearch, setSize, listSizes, tabSizeKey]);

    useEffect(() => {
        function handleProfileDataChanged() {
            // Detailed cache reconciliation is performed once by
            // mutateInvitationState. The event only triggers canonical refreshes.
            void refreshInvitationLists();
        }

        // Always refresh on mount to ensure cards reflect any recent builder edits
        void refreshInvitationLists();

        window.addEventListener("vilique:profile-data-changed", handleProfileDataChanged);
        return () => window.removeEventListener("vilique:profile-data-changed", handleProfileDataChanged);
    }, [globalMutate, statusFilter, refreshInvitationLists]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        if (params.get("reset") === "1") {
            const nextUrl = window.location.pathname + window.location.search.replace(/[?&]reset=1/, "").replace(/^&/, "?");
            window.history.replaceState(null, "", nextUrl || window.location.pathname);
            void refreshInvitationLists();
        }
    }, [refreshInvitationLists]);

    useEffect(() => {
        if (window.location.pathname !== "/invitations") return;
        const params = new URLSearchParams(window.location.search);

        const nextParams = new URLSearchParams();
        if (statusFilter !== "all") nextParams.set("status", statusFilter);
        if (debouncedSearch) nextParams.set("search", debouncedSearch);

        params.sort();
        nextParams.sort();

        if (params.toString() !== nextParams.toString()) {
            const nextUrl = nextParams.toString() ? `/invitations?${nextParams.toString()}` : "/invitations";
            window.history.replaceState(null, "", nextUrl);
        }
    }, [debouncedSearch, statusFilter]);

    const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
        scheduleMobileTitleVisibilityUpdate(
            event.currentTarget.scrollTop,
        );
    };

    if (isUnauthorized && showAuthModalOnUnauthorized) {
        return (
            <main className="profilePage invitationsPage">
                <AuthRequiredModal next="/invitations" forceOpen />
            </main>
        );
    }

    const handleClearSearch = () => setSearchTerm("");
    const handleResetAll = () => {
        setSearchTerm("");
        setStatusFilter("all");
    };

    return (
        <>
            <header ref={headerRevealRef} className="profileControls">
                <div className="profileControlsTitle">
                    <h2>Your invitations</h2>
                    <p>Manage and track all your invitation websites</p>
                </div>

                <div className="profileSearchWrapper">
                    <Search className="searchIcon" size={18} aria-hidden="true" />
                    <input
                        type="text"
                        placeholder="Search by title, couple, or event type..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="profileSearchInput"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className="clearSearchBtn"
                            aria-label="Clear search query"
                        >
                            <X size={15} />
                        </button>
                    )}
                </div>
            </header>

            <div className="profileInvitationsContainer">
                <nav className="profileFilterTabs" aria-label="Invitation filters">
                    {isLoadingInitialTabs ? (
                        <InvitationTabsSkeleton />
                    ) : (
                        <>
                            <button
                                type="button"
                                className={`filterTabBtn ${statusFilter === "all" ? "active" : ""}`}
                                onClick={() => setStatusFilter("all")}
                            >
                                All <span>{counts.all || 0}</span>
                            </button>
                            <button
                                type="button"
                                className={`filterTabBtn ${statusFilter === "upcoming" ? "active" : ""}`}
                                onClick={() => setStatusFilter("upcoming")}
                            >
                                Upcoming <span className="pub">{counts.upcoming || 0}</span>
                            </button>
                            <button
                                type="button"
                                className={`filterTabBtn ${statusFilter === "completed" ? "active" : ""}`}
                                onClick={() => setStatusFilter("completed")}
                            >
                                Completed <span>{counts.completed || 0}</span>
                            </button>
                            <button
                                type="button"
                                className={`filterTabBtn ${statusFilter === "draft" ? "active" : ""}`}
                                onClick={() => setStatusFilter("draft")}
                            >
                                Drafts <span className="drf">{counts.draft || 0}</span>
                            </button>
                            <button
                                type="button"
                                className={`filterTabBtn ${statusFilter === "offline" ? "active" : ""}`}
                                onClick={() => setStatusFilter("offline")}
                            >
                                Offline <span>{counts.offline || 0}</span>
                            </button>
                        </>
                    )}
                </nav>

                {isLoadingFirstPage ? (
                    <InvitationListSkeleton />
                ) : invitations.length ? (
                    <div className="profileInvitationList" onScroll={handleListScroll}>
                        {invitations.map((invitation) => (
                            <InvitationRow
                                invitation={invitation}
                                statusFilter={statusFilter}
                                key={invitation.id}
                                stats={mergedStats[invitation.id] || { rsvps: 0, views: 0, acceptsRsvps: false }}
                                onInvitationDeleted={(deletedInvitation) => {
                                    const prevBucket = getInvitationFilterBucket(deletedInvitation);
                                    const updatedCounts = adjustInvitationCounts(counts, prevBucket, null);
                                    updateCountsState(updatedCounts);
                                    setOptimisticMutations((current) => [
                                        ...current.filter((mutation) => mutation.id !== deletedInvitation.id),
                                        {
                                            id: deletedInvitation.id,
                                            deletedInvitation,
                                            timestamp: Date.now(),
                                        },
                                    ]);

                                    mutateInvitationState(globalMutate, undefined, undefined, deletedInvitation, false, cache);
                                }}
                                onInvitationUpdated={(updatedInvitation, previousInvitation) => {
                                    const prevBucket = previousInvitation ? getInvitationFilterBucket(previousInvitation) : null;
                                    const nextBucket = getInvitationFilterBucket(updatedInvitation);
                                    const updatedCounts = adjustInvitationCounts(counts, prevBucket, nextBucket);
                                    updateCountsState(updatedCounts);
                                    setOptimisticMutations((current) => [
                                        ...current.filter((mutation) => mutation.id !== updatedInvitation.id),
                                        {
                                            id: updatedInvitation.id,
                                            invitation: updatedInvitation,
                                            previous: previousInvitation,
                                            timestamp: Date.now(),
                                        },
                                    ]);

                                    mutateInvitationState(globalMutate, updatedInvitation, previousInvitation, undefined, false, cache);
                                }}
                            />
                        ))}
                        {isLoadingNextPage ? <InvitationAppendSkeleton /> : null}
                        {error && invitations.length ? (
                            <div className="listLoadState" role="status">
                                <span>Couldn&apos;t load more</span>
                                <button type="button" onClick={() => mutate()}>Retry</button>
                            </div>
                        ) : null}
                        {shouldShowEndState && invitations.length ? <div className="listEndState">You&apos;ve reached the end.</div> : null}
                        <div ref={sentinelRef} className="infiniteScrollSentinel" aria-hidden="true" />
                    </div>
                ) : (
                    <ListState
                        actionLabel={error ? "Retry" : hasActiveFilters ? "Reset search & filters" : "Browse templates"}
                        className="profileEmptyState"
                        description={
                            error
                                ? "We could not retrieve your invitations."
                                : hasActiveFilters
                                    ? "No invitations match this combination. Try a different tab or clear the search."
                                    : "Pick a template to publish your first invite."
                        }
                        details={hasActiveFilters ? emptyStateDetails : undefined}
                        href={hasActiveFilters ? undefined : "/"}
                        onAction={error ? () => { setSize(1); setListSize("invitations", 1); mutate(); } : hasActiveFilters ? handleResetAll : undefined}
                        title={error ? "Could not load invitations" : hasActiveFilters ? "No matching invitations" : "Choose a template to begin"}
                        variant={error ? "error" : hasActiveFilters ? "filtered" : "empty"}
                    />
                )}
            </div>
        </>
    );
}

function InvitationListSkeleton() {
    return (
        <div className="profileInvitationList" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, index) => (
                <InvitationSkeletonCard key={index} />
            ))}
        </div>
    );
}

function InvitationTabsSkeleton() {
    return (
        <>
            <ButtonSkeleton className="filterTabBtn" width={70} height={36} />
            <ButtonSkeleton className="filterTabBtn" width={112} height={36} />
            <ButtonSkeleton className="filterTabBtn" width={120} height={36} />
            <ButtonSkeleton className="filterTabBtn" width={92} height={36} />
            <ButtonSkeleton className="filterTabBtn" width={94} height={36} />
        </>
    );
}

export function ProfileInvitationsSkeleton() {
    return (
        <main className="profilePage invitationsPage" aria-busy="true">
            <section className="profileInvitations profileInvitationsFull">
                <header className="profileControls">
                    <div className="profileControlsTitle">
                        <h2>Your invitations</h2>
                        <p>Manage and track all your invitation websites</p>
                    </div>
                </header>
                <div className="profileInvitationsContainer">
                    <nav className="profileFilterTabs" aria-label="Invitation filters">
                        <InvitationTabsSkeleton />
                    </nav>
                    <InvitationListSkeleton />
                </div>
            </section>
        </main>
    );
}



function InvitationAppendSkeleton() {
    return (
        <>
            {Array.from({ length: 2 }).map((_, index) => (
                <InvitationSkeletonCard key={`append-${index}`} />
            ))}
        </>
    );
}

function InvitationSkeletonCard() {
    return (
        <article className="profileInviteRow profileInviteRow--bg profileInviteRow--wedding profileInviteRow--skeleton">
            <div className="profileInviteInfo">
                <div className="profileInviteDetails">
                    <div className="profileInviteHeader">
                        <TextSkeleton className="profileInviteTitleSkeleton" width="52%" height={14} />
                        <ButtonSkeleton className="profileInviteStatusSkeleton" width={96} height={25} />
                    </div>
                    <TextSkeleton className="profileInviteNamesSkeleton" width="76%" height={21} />
                    <div className="profileInviteMeta">
                        <span className="profileInviteMetaPairSkeleton">
                            <Skeleton className="profileInviteMetaIconSkeleton" rounded="sm" />
                            <TextSkeleton className="profileInviteMetaTextSkeleton" width="100%" height={15} />
                        </span>
                        <span className="profileInviteMetaPairSkeleton">
                            <Skeleton className="profileInviteMetaIconSkeleton" rounded="full" />
                            <TextSkeleton className="profileInviteMetaTextSkeleton" width="100%" height={15} />
                        </span>
                        <span className="profileInviteMetaSecondary">
                            <Skeleton className="profileInviteMetaIconSkeleton" rounded="sm" />
                            <TextSkeleton width={138} height={14} />
                        </span>
                    </div>
                </div>
            </div>
            <div className="profilePublicLinkWrap profilePublicLinkWrap--skeleton">
                <div className="profilePublicLink">
                    <Skeleton className="profileInviteMetaIconSkeleton" rounded="sm" />
                    <TextSkeleton width="72%" height={17} />
                </div>
                <ButtonSkeleton className="profileCopyLinkSkeleton" width={30} height={28} />
            </div>
            <div className="profileInviteActions profileInviteActions--published profileInviteActions--skeleton">
                <ButtonSkeleton className="profileActionSkeleton" width="100%" height={36} />
                <ButtonSkeleton className="profileActionSkeleton" width="100%" height={36} />
                <ButtonSkeleton className="profileActionSkeleton" width="100%" height={36} />
                <ButtonSkeleton className="profileMoreActionSkeleton" width={40} height={36} />
            </div>
        </article>
    );
}

function InvitationRow({
    invitation,
    statusFilter,
    onInvitationDeleted,
    onInvitationUpdated,
}: {
    invitation: InvitationData;
    statusFilter: string;
    stats: { rsvps: number; views: number; acceptsRsvps?: boolean };
    onInvitationDeleted: (invitation: InvitationData) => void;
    onInvitationUpdated: (updatedInvitation: InvitationData, previousInvitation: InvitationData) => void;
}) {
    const { startLineLoader } = useLineLoader();
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isOfflineOpen, setIsOfflineOpen] = useState(false);
    const [isOnlineOpen, setIsOnlineOpen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isTakingOffline, setIsTakingOffline] = useState(false);
    const [isMakingOnline, setIsMakingOnline] = useState(false);
    const [isMoreOpen, setIsMoreOpen] = useState(false);

    const handlePreview = useCallback(() => {
        startLineLoader();
        setIsPreviewing(true);
    }, [startLineLoader]);
    const moreMenuRef = useRef<HTMLDivElement>(null);
    const moreMenuFirstItemRef = useRef<HTMLButtonElement>(null);
    const router = useRouter();
    const { showToast } = useToast();
    const { cache, mutate } = useSWRConfig();
    const getCachedDashboard = () => {
        const state = cache.get("/api/profile/dashboard") as { data?: DashboardData } | undefined;
        return state?.data;
    };
    const refreshInvitationLists = () => mutate(
        (key) => typeof key === "string" && (key.startsWith("/api/invitations") || key.startsWith("$inf$/api/invitations"))
    );

    const isPaidPublishFailed = invitation.paymentStatus === "paid" &&
        !invitation.firstPublishedAt &&
        invitation.status !== "published";
    const lifecycleStatus = isPaidPublishFailed ? "offline" : getInvitationLifecycleStatus(invitation);
    const isDraft = lifecycleStatus === "draft";
    const isUpcoming = lifecycleStatus === "upcoming";
    const isLiveToday = lifecycleStatus === "live_today";
    const isCompleted = lifecycleStatus === "completed";
    const isOffline = lifecycleStatus === "offline";
    const isOfflineRecord =
        invitation.lifecycleStatus === "unpublished" ||
        invitation.eventStatus === "unpublished" ||
        isOffline;
    const isPublic = isUpcoming || isLiveToday || isCompleted;
    const isPublicLinkAvailable = isPublic && !isOfflineRecord;
    const hasAnalyticsAccess = Boolean(invitation.firstPublishedAt || invitation.publishedAt);
    const isSample = invitation.id.startsWith("sample-");
    const returnToUrl = `/invitations?status=${statusFilter}`;
    const editHref = isSample ? "/" : `/builder?id=${invitation.id}&returnTo=${encodeURIComponent(returnToUrl)}`;
    const analyticsHref = `/invitations/${invitation.id}/analytics`;
    const previewHref = isSample
        ? "/"
        : isPublicLinkAvailable
            ? `/i/${invitation.slug}`
            : `/builder/preview?id=${invitation.id}&from=invitations`;
    const publicUrl = getPublicInvitationUrl(invitation.slug);
    const showUpdatedDate = hasMeaningfulUpdate(invitation.createdAt, invitation.updatedAt);

    useEffect(() => {
        if (!isMoreOpen) return;

        function handlePointerDown(event: PointerEvent) {
            if (!moreMenuRef.current?.contains(event.target as Node)) {
                setIsMoreOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsMoreOpen(false);
            }
        }

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        window.requestAnimationFrame(() => moreMenuFirstItemRef.current?.focus());
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isMoreOpen]);

    const handleEdit = () => {
        setIsEditing(true);
        router.push(editHref);
    };

    async function handleDeleteConfirm() {
        setIsDeleting(true);
        const originalData = getCachedDashboard();

        mutate("/api/profile/dashboard", (current?: DashboardData) => {
            if (!current) return current;
            const updatedInvitations = current.invitations.filter((item) => item.id !== invitation.id);
            const isDraftState = invitation.status === "draft";
            return {
                ...current,
                invitations: updatedInvitations,
                published: current.published - (isDraftState ? 0 : 1),
                drafts: current.drafts - (isDraftState ? 1 : 0),
            };
        }, { revalidate: false });

        try {
            const formData = new FormData();
            formData.append("id", invitation.id);
            const result = await deleteInvitation(formData);
            if (!result?.ok) {
                showToast(result?.error || "Failed to delete invitation", "error");
                mutate("/api/profile/dashboard", originalData, { revalidate: false });
                return;
            }
            onInvitationDeleted(invitation);
            showToast(isDraft ? "Draft deleted." : "Invitation deleted.", "success");
            mutate("/api/profile/dashboard");
            void refreshInvitationLists();
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Failed to delete invitation", "error");
            mutate("/api/profile/dashboard", originalData, { revalidate: false });
        } finally {
            setIsDeleting(false);
            setIsDeleteOpen(false);
        }
    }

    function handleTakeOfflineClick() {
        setIsMoreOpen(false);
        setIsOfflineOpen(true);
    }

    async function handleTakeOfflineConfirm() {
        if (isTakingOffline) return;
        setIsTakingOffline(true);

        try {
            const response = await fetch(`/api/invitations/${invitation.id}/unpublish`, {
                method: "POST",
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                showToast(result.error || "Unable to take invitation offline.", "error");
                return;
            }
            const updatedInvitation: InvitationData = {
                ...invitation,
                status: (result.status as InvitationData["status"]) || "draft",
                lifecycleStatus: "unpublished",
                eventStatus: "unpublished",
                updatedAt: new Date().toISOString(),
            };
            onInvitationUpdated(updatedInvitation, invitation);
            showToast("Invitation taken offline.", "success");
            void refreshInvitationLists();
        } catch {
            showToast("Unable to take invitation offline.", "error");
        } finally {
            setIsTakingOffline(false);
            setIsOfflineOpen(false);
        }
    }

    function handleMakeOnlineClick() {
        setIsMoreOpen(false);
        setIsOnlineOpen(true);
    }

    async function handleMakeOnlineConfirm() {
        if (isMakingOnline) return;

        if (isInvitationCompleted(invitation)) {
            const completedInvitation: InvitationData = {
                ...invitation,
                lifecycleStatus: "completed",
                eventStatus: "completed",
                updatedAt: new Date().toISOString(),
            };
            onInvitationUpdated(completedInvitation, invitation);
            showToast("This invitation is completed and cannot be reactivated.", "info");
            setIsOnlineOpen(false);
            return;
        }

        setIsMakingOnline(true);

        try {
            const response = await fetch(`/api/invitations/${invitation.id}/restore`, {
                method: "POST",
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (result.code === "INVITATION_COMPLETED_LOCKED" || result.error === "This invitation is completed and can no longer be restored.") {
                    const completedInvitation: InvitationData = {
                        ...invitation,
                        lifecycleStatus: "completed",
                        eventStatus: "completed",
                        updatedAt: new Date().toISOString(),
                    };
                    onInvitationUpdated(completedInvitation, invitation);
                }
                showToast(result.error || "Unable to make invitation online.", "error");
                return;
            }
            const confirmedUpdated: InvitationData = {
                ...invitation,
                slug: result.slug || invitation.slug,
                status: "published",
                lifecycleStatus: result.lifecycle_status || "published",
                eventStatus: result.event_status || "published",
                paymentStatus: result.payment_status || "paid",
                publishedAt: result.published_at || invitation.publishedAt || new Date().toISOString(),
                firstPublishedAt: invitation.firstPublishedAt || result.published_at || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            onInvitationUpdated(confirmedUpdated, invitation);
            showToast("Invitation is online again.", "success");
            void refreshInvitationLists();
        } catch {
            showToast("Unable to make invitation online.", "error");
        } finally {
            setIsMakingOnline(false);
            setIsOnlineOpen(false);
        }
    }

    function handleCopyPublicLink() {
        if (!isPublicLinkAvailable) return;
        navigator.clipboard.writeText(publicUrl).then(() => {
            setIsCopied(true);
            showToast("Invitation link copied.", "success");
            window.setTimeout(() => setIsCopied(false), 1600);
        }).catch(() => {
            showToast("Could not copy link", "error");
        });
    }

    return (
        <article className={`profileInviteRow profileInviteRow--bg ${getInvitationArtClass(invitation)}`}>
            <div className="profileInviteInfo">
                <div className="profileInviteDetails">
                    <div className="profileInviteHeader">
                        <p className="inviteType">{invitation.title}</p>
                        <span className={`profileStatus ${lifecycleStatus}`}>
                            {getLifecycleStatusIcon(lifecycleStatus)}
                            {getLifecycleStatusLabel(lifecycleStatus)}
                        </span>
                        {isSample && <span className="sampleLabel">Sample Template</span>}
                    </div>

                    <h3>{getDisplayNames(invitation)}</h3>

                    <div className="profileInviteMeta">
                        <span>
                            <CalendarDays size={14} aria-hidden="true" />
                            {formatDate(invitation.eventDate)}
                        </span>
                        {invitation.eventTime ? (
                            <span>
                                <Clock size={14} aria-hidden="true" />
                                {formatEventTimeRange(invitation.eventTime)}
                            </span>
                        ) : null}
                        <span className="profileInviteMetaSecondary">
                            {showUpdatedDate ? (
                                <RefreshCw size={14} aria-hidden="true" />
                            ) : (
                                <CalendarDays size={14} aria-hidden="true" />
                            )}
                            {showUpdatedDate
                                ? `Updated ${formatDateTime(invitation.updatedAt)}`
                                : `Created ${formatDateTime(invitation.createdAt)}`}
                        </span>
                    </div>

                </div>
            </div>

            {isPublicLinkAvailable && !isSample ? (
                <div className="profilePublicLinkWrap">
                    <a className="profilePublicLink" href={previewHref} target="_blank" rel="noreferrer">
                        <ExternalLink size={13} aria-hidden="true" />
                        <span>{publicUrl}</span>
                    </a>
                    <button
                        className="profileCopyLinkBtn"
                        type="button"
                        onClick={handleCopyPublicLink}
                        aria-label="Copy invitation link"
                    >
                        {isCopied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                    </button>
                </div>
            ) : isDraft || isOfflineRecord ? (
                <div className="profilePublicLinkWrap profilePublicLinkWrap--empty">
                    <span className="profilePublicLinkPlaceholder">
                        <Lock size={14} aria-hidden="true" />
                        <span>
                            {isOfflineRecord
                                ? isPaidPublishFailed
                                    ? "Paid, but not live yet. Edit and publish again."
                                    : "Public link unavailable while this invitation is offline."
                                : "Not published yet. Preview or edit to continue."}
                        </span>
                    </span>
                </div>
            ) : null}

            <div className={`profileInviteActions ${isCompleted || isLiveToday ? "profileInviteActions--two" : isOffline && hasAnalyticsAccess ? "profileInviteActions--published" : isUpcoming ? "profileInviteActions--published" : ""}`}>
                {isDraft ? (
                    <>
                        <Link href={previewHref} className="profileActionBtn profileActionBtn--primary" onClick={handlePreview}>
                            {isPreviewing ? (
                                <Loader2 size={14} className="spinner" aria-hidden="true" />
                            ) : (
                                <Eye size={14} aria-hidden="true" />
                            )}
                            <span>{isPreviewing ? "Loading…" : "Preview"}</span>
                        </Link>
                        <button
                            type="button"
                            className="profileActionBtn"
                            onClick={handleEdit}
                            disabled={isEditing}
                        >
                            {isEditing ? (
                                <>
                                    <Loader2 size={14} className="spinner" aria-hidden="true" />
                                    <span>Editing...</span>
                                </>
                            ) : (
                                <>
                                    <PencilLine size={14} aria-hidden="true" />
                                    <span>Edit</span>
                                </>
                            )}
                        </button>
                        {isSample ? null : (
                            <button
                                type="button"
                                className="profileActionBtn profileActionBtn--danger"
                                onClick={() => setIsDeleteOpen(true)}
                                aria-label={`Delete draft ${invitation.title}`}
                            >
                                <Trash2 size={14} aria-hidden="true" />
                                <span>Delete</span>
                            </button>
                        )}
                    </>
                ) : isOffline ? (
                    <>
                        <Link href={previewHref} className="profileActionBtn profileActionBtn--primary" onClick={handlePreview}>
                            {isPreviewing ? (
                                <Loader2 size={14} className="spinner" aria-hidden="true" />
                            ) : (
                                <Eye size={14} aria-hidden="true" />
                            )}
                            <span>{isPreviewing ? "Loading…" : "Preview"}</span>
                        </Link>
                        <button
                            type="button"
                            className="profileActionBtn"
                            onClick={handleEdit}
                            disabled={isEditing}
                        >
                            {isEditing ? (
                                <>
                                    <Loader2 size={14} className="spinner" aria-hidden="true" />
                                    <span>Editing...</span>
                                </>
                            ) : (
                                <>
                                    <PencilLine size={14} aria-hidden="true" />
                                    <span>Edit</span>
                                </>
                            )}
                        </button>
                        {hasAnalyticsAccess ? (
                            <Link href={analyticsHref} className="profileActionBtn">
                                <BarChart3 size={14} aria-hidden="true" />
                                <span>Analytics</span>
                            </Link>
                        ) : null}
                        {hasAnalyticsAccess ? (
                            <div className="profileActionOverflow" ref={moreMenuRef}>
                                <button
                                    type="button"
                                    className="profileActionBtn profileActionBtn--more"
                                    onClick={() => setIsMoreOpen((open) => !open)}
                                    aria-label={`More actions for ${invitation.title}`}
                                    aria-haspopup="menu"
                                    aria-expanded={isMoreOpen}
                                >
                                    <MoreVertical size={15} aria-hidden="true" />
                                </button>
                                {isMoreOpen ? (
                                    <div className="profileActionMenu" role="menu" aria-label={`More actions for ${invitation.title}`}>
                                        <button
                                            ref={moreMenuFirstItemRef}
                                            type="button"
                                            className="profileActionMenuItem profileActionMenuItem--online"
                                            onClick={handleMakeOnlineClick}
                                            disabled={isMakingOnline}
                                            role="menuitem"
                                        >
                                            {isMakingOnline ? (
                                                <Loader2 size={14} className="spinner" aria-hidden="true" />
                                            ) : (
                                                <Wifi size={14} aria-hidden="true" />
                                            )}
                                            <span>Go Live</span>
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="profileActionBtn profileActionBtn--online"
                                onClick={handleMakeOnlineClick}
                                disabled={isMakingOnline}
                            >
                                {isMakingOnline ? (
                                    <Loader2 size={14} className="spinner" aria-hidden="true" />
                                ) : (
                                    <Wifi size={14} aria-hidden="true" />
                                )}
                                <span>Go Live</span>
                            </button>
                        )}
                        {/* Keep for future use:
                        {!isSample && (
                            <button
                                type="button"
                                className="profileActionBtn profileActionBtn--danger"
                                onClick={() => setIsDeleteOpen(true)}
                                aria-label={`Delete invitation ${invitation.title}`}
                            >
                                <Trash2 size={14} aria-hidden="true" />
                                <span>Delete</span>
                            </button>
                        )}
                        */}
                    </>
                ) : isUpcoming ? (
                    <>
                        <a href={previewHref} target="_blank" rel="noreferrer" className="profileActionBtn profileActionBtn--primary">
                            <ExternalLink size={14} aria-hidden="true" />
                            <span>Open</span>
                        </a>
                        <button
                            type="button"
                            className="profileActionBtn"
                            onClick={handleEdit}
                            disabled={isEditing}
                        >
                            {isEditing ? (
                                <>
                                    <Loader2 size={14} className="spinner" aria-hidden="true" />
                                    <span>Editing...</span>
                                </>
                            ) : (
                                <>
                                    <PencilLine size={14} aria-hidden="true" />
                                    <span>Edit</span>
                                </>
                            )}
                        </button>
                        {hasAnalyticsAccess ? (
                            <Link href={analyticsHref} className="profileActionBtn">
                                <BarChart3 size={14} aria-hidden="true" />
                                <span>Analytics</span>
                            </Link>
                        ) : null}
                        <div className="profileActionOverflow" ref={moreMenuRef}>
                            <button
                                type="button"
                                className="profileActionBtn profileActionBtn--more"
                                onClick={() => setIsMoreOpen((open) => !open)}
                                aria-label={`More actions for ${invitation.title}`}
                                aria-haspopup="menu"
                                aria-expanded={isMoreOpen}
                            >
                                <MoreVertical size={15} aria-hidden="true" />
                            </button>
                            {isMoreOpen ? (
                                <div className="profileActionMenu" role="menu" aria-label={`More actions for ${invitation.title}`}>
                                    <button
                                        ref={moreMenuFirstItemRef}
                                        type="button"
                                        className="profileActionMenuItem"
                                        onClick={handleTakeOfflineClick}
                                        disabled={isTakingOffline}
                                        role="menuitem"
                                    >
                                        {isTakingOffline ? (
                                            <Loader2 size={14} className="spinner" aria-hidden="true" />
                                        ) : (
                                            <Power size={14} aria-hidden="true" />
                                        )}
                                        <span>Go Offline</span>
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </>
                ) : (
                    <>
                        <Link
                            href={previewHref}
                            target={isPublicLinkAvailable ? "_blank" : undefined}
                            rel={isPublicLinkAvailable ? "noreferrer" : undefined}
                            className="profileActionBtn profileActionBtn--primary"
                        >
                            {isPublicLinkAvailable ? (
                                <>
                                    <ExternalLink size={14} aria-hidden="true" />
                                    <span>Open</span>
                                </>
                            ) : (
                                <>
                                    <Eye size={14} aria-hidden="true" />
                                    <span>Preview</span>
                                </>
                            )}
                        </Link>
                        {hasAnalyticsAccess ? (
                            <Link href={analyticsHref} className="profileActionBtn">
                                <BarChart3 size={14} aria-hidden="true" />
                                <span>Analytics</span>
                            </Link>
                        ) : null}
                    </>
                )}
            </div>
            {!isSample ? (
                <>
                    <ConfirmModal
                        isOpen={isDeleteOpen}
                        onClose={() => setIsDeleteOpen(false)}
                        onConfirm={handleDeleteConfirm}
                        isPending={isDeleting}
                        title={isDraft ? "Delete Draft" : "Delete Invitation"}
                        message={
                            isDraft ? (
                                <p style={{ margin: 0, lineHeight: "1.5" }}>
                                    Are you sure you want to delete the draft <strong>{invitation.title}</strong>? This action is permanent and cannot be undone.
                                </p>
                            ) : (
                                <p style={{ margin: 0, lineHeight: "1.5" }}>
                                    Are you sure you want to delete <strong>{invitation.title}</strong>? This will permanently delete your website, guest RSVPs, and wishes. This action cannot be undone.
                                </p>
                            )
                        }
                        confirmText={isDraft ? "Delete Draft" : "Delete Invitation"}
                        confirmClassName="modalBtnConfirm--red-pastel"
                        icon={
                            <span className="modalWarningIcon" style={{ color: "#be123c", background: "rgba(255, 241, 242, 0.9)" }}>
                                <AlertTriangle size={24} />
                            </span>
                        }
                    />

                    <ConfirmModal
                        isOpen={isOfflineOpen}
                        onClose={() => setIsOfflineOpen(false)}
                        onConfirm={handleTakeOfflineConfirm}
                        isPending={isTakingOffline}
                        title="Take Invitation Offline"
                        message={
                            <p style={{ margin: 0, lineHeight: "1.5" }}>
                                Are you sure you want to take <strong>{invitation.title}</strong> offline? This disables the public page and guest RSVPs. You can republish it online at any time.
                            </p>
                        }
                        confirmText="Take Offline"
                        confirmClassName="modalBtnConfirm--orange-pastel"
                        icon={
                            <span className="modalWarningIcon" style={{ color: "#b45309", background: "rgba(255, 251, 235, 0.9)" }}>
                                <WifiOff size={24} />
                            </span>
                        }
                    />

                    <ConfirmModal
                        isOpen={isOnlineOpen}
                        onClose={() => setIsOnlineOpen(false)}
                        onConfirm={handleMakeOnlineConfirm}
                        isPending={isMakingOnline}
                        title="Publish Invitation"
                        message={
                            <p style={{ margin: 0, lineHeight: "1.5" }}>
                                Are you sure you want to make <strong>{invitation.title}</strong> live? This activates the public page and allows guests to view details and RSVP.
                            </p>
                        }
                        confirmText="Go Live"
                        confirmClassName="modalBtnConfirm--green-pastel"
                        icon={
                            <span className="modalWarningIcon" style={{ color: "#047857", background: "rgba(236, 253, 245, 0.9)" }}>
                                <Wifi size={24} />
                            </span>
                        }
                    />
                </>
            ) : null}
        </article>
    );
}

type DashboardLifecycleStatus = InvitationLifecycleStatus;

function getInvitationLifecycleStatus(invitation: InvitationData): DashboardLifecycleStatus {
    return getInvitationLifecycle(invitation);
}

function getLifecycleStatusLabel(status: DashboardLifecycleStatus) {
    switch (status) {
        case "draft":
            return "Draft";
        case "upcoming":
            return "Upcoming";
        case "live_today":
            return "Live Today";
        case "completed":
            return "Completed";
        case "offline":
            return "Offline";
    }
}

function getLifecycleStatusIcon(status: DashboardLifecycleStatus) {
    const size = 12;
    switch (status) {
        case "draft":
            return <FileText size={size} aria-hidden="true" />;
        case "upcoming":
            return <CalendarCheck size={size} aria-hidden="true" />;
        case "live_today":
            return <Sparkles size={size} aria-hidden="true" />;
        case "completed":
            return <CheckCircle2 size={size} aria-hidden="true" />;
        case "offline":
            return <WifiOff size={size} aria-hidden="true" />;
    }
}

function getDisplayNames(invitation: InvitationData) {
    return invitation.secondaryName
        ? `${invitation.primaryName} & ${invitation.secondaryName}`
        : invitation.primaryName;
}

function getInvitationArtClass(invitation: InvitationData) {
    const category =
        (invitation.category ?? "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-");
    if (category.includes("birthday")) return "profileInviteRow--birthday";
    if (category.includes("house")) return "profileInviteRow--housewarming";
    if (category.includes("engagement")) return "profileInviteRow--engagement";
    if (category.includes("graduation")) return "profileInviteRow--graduation";
    if (category.includes("wedding")) return "profileInviteRow--wedding";
    return "profileInviteRow--default";
}

function formatDate(value: string) {
    try {
        return new Intl.DateTimeFormat("en", {
            month: "short",
            day: "numeric",
            year: "numeric",
        }).format(new Date(value));
    } catch {
        return value;
    }
}

function formatDateTime(value: string) {
    try {
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(value));
    } catch {
        return value;
    }
}

function hasMeaningfulUpdate(createdAt: string, updatedAt: string) {
    const createdTime = new Date(createdAt).getTime();
    const updatedTime = new Date(updatedAt).getTime();
    if (!Number.isFinite(createdTime) || !Number.isFinite(updatedTime)) return false;
    return updatedTime - createdTime > 60_000;
}

function formatEventTimeRange(value: string) {
    return value.replace(/\s*-\s*/g, " - ").trim();
}
