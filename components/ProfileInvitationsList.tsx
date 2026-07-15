"use client";

import { useEffect, useRef, useState } from "react";
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
import { getInvitationLifecycle, InvitationLifecycleStatus } from "@/lib/lifecycle";
import ConfirmModal from "./ConfirmModal";
import { useToast } from "./Toast";
import { useNavigationState } from "./NavigationStateProvider";
import { useSWRConfig } from "swr";
import { ButtonSkeleton, Skeleton, TextSkeleton } from "@/components/ui/Skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import AuthRequiredModal from "@/components/AuthRequiredModal";

interface DashboardData {
    profile: {
        email: string;
        name: string;
        avatarUrl: string | null;
    } | null;
    invitations: InvitationData[];
    published: number;
    drafts: number;
    views: number;
    rsvps: number;
    invitationStats: Record<string, { rsvps: number; views: number; acceptsRsvps?: boolean }>;
    totalSpent: number;
}

interface ProfileInvitationsListProps {
    initialInvitations?: InvitationData[];
    invitationStats?: Record<string, { rsvps: number; views: number; acceptsRsvps?: boolean }>;
    showAuthModalOnUnauthorized?: boolean;
}

type InvitationsPageResponse = {
    items: InvitationData[];
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
    counts: Record<string, number>;
    stats: Record<string, { rsvps: number; views: number; acceptsRsvps?: boolean }>;
};

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
    } = useNavigationState();

    const debouncedSearch = useDebouncedValue(searchTerm, searchTerm ? 350 : 0);
    const [cachedCounts, setCachedCounts] = useState<Record<string, number> | null>(null);
    const {
        data,
        error,
        setSize,
        isLoading,
        isValidating,
        mutate,
    } = useSWRInfinite<InvitationsPageResponse>((pageIndex, previousPageData) => {
        if (previousPageData && !previousPageData.hasMore) return null;
        const params = new URLSearchParams({
            status: statusFilter,
            sort: "updated_desc",
            limit: "12",
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (pageIndex && previousPageData?.nextCursor) params.set("cursor", previousPageData.nextCursor);
        return `/api/invitations?${params.toString()}`;
    }, null, {
        suspense: false,
        revalidateFirstPage: false,
        onSuccess: (invitationPages) => {
            const nextCounts = invitationPages?.[0]?.counts;
            if (nextCounts) setCachedCounts(nextCounts);
        },
    });

    const pages = data || [];
    const invitations = pages.flatMap((page) => page.items);
    const firstPage = pages[0];
    const fallbackCounts = {
        all: initialInvitations.length,
        upcoming: 0,
        completed: 0,
        draft: 0,
        offline: 0,
    };
    const latestCounts = firstPage?.counts;
    const counts = latestCounts || cachedCounts || fallbackCounts;
    const mergedStats = pages.reduce((acc, page) => ({ ...acc, ...page.stats }), invitationStats);
    const hasMore = Boolean(pages[pages.length - 1]?.hasMore);
    const shouldShowEndState = pages.length > 1 && !hasMore;
    const isSearching = searchTerm !== debouncedSearch;
    const isLoadingFirstPage = (isLoading && !pages.length) || isSearching;
    const isLoadingInitialTabs = isLoading && !pages.length && !cachedCounts;
    const isLoadingNextPage = isValidating && pages.length > 0;
    const hasActiveFilters = Boolean(searchTerm) || statusFilter !== "all";
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
    const sentinelRef = useInfiniteScroll<HTMLDivElement>({
        disabled: !hasMore || isLoadingNextPage,
        onLoadMore: () => setSize((current) => current + 1),
    });
    const isUnauthorized = error?.status === 401;

    useEffect(() => {
        if (window.location.pathname !== "/invitations") return;
        const params = new URLSearchParams(window.location.search);
        if (statusFilter === "all") params.delete("status");
        else params.set("status", statusFilter);
        if (debouncedSearch) params.set("search", debouncedSearch);
        else params.delete("search");
        const nextUrl = params.toString() ? `/invitations?${params.toString()}` : "/invitations";
        window.history.replaceState(null, "", nextUrl);
    }, [debouncedSearch, statusFilter]);

    useEffect(() => {
        void mutate();
    }, [mutate]);

    if (isUnauthorized && showAuthModalOnUnauthorized) {
        return (
            <>
                <AuthRequiredModal next="/invitations" forceOpen />
                <InvitationListSkeleton />
            </>
        );
    }

    const handleClearSearch = () => setSearchTerm("");
    const handleResetAll = () => {
        setSearchTerm("");
        setStatusFilter("all");
    };

    return (
        <>
            <header className="profileControls">
                <div>
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
                <div className="profileInvitationList">
                    {invitations.map((invitation) => (
                        <InvitationRow
                            invitation={invitation}
                            key={invitation.id}
                            stats={mergedStats[invitation.id] || { rsvps: 0, views: 0, acceptsRsvps: false }}
                            onInvitationDeleted={(deletedInvitation) => {
                                mutate((currentPages) => removeInvitationFromPages(currentPages, deletedInvitation), { revalidate: false });
                            }}
                            onInvitationUpdated={(updatedInvitation, previousInvitation) => {
                                mutate(
                                    (currentPages) => updateInvitationInPages(currentPages, updatedInvitation, previousInvitation, statusFilter),
                                    { revalidate: false }
                                );
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
                    href={hasActiveFilters ? undefined : "/templates"}
                    onAction={error ? () => mutate() : hasActiveFilters ? handleResetAll : undefined}
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

function removeInvitationFromPages(
    pages: InvitationsPageResponse[] | undefined,
    invitation: InvitationData
) {
    if (!pages) return pages;
    const bucket = getInvitationFilterBucket(invitation);
    return pages.map((page) => ({
        ...page,
        items: page.items.filter((item) => item.id !== invitation.id),
        totalCount: Math.max(0, page.totalCount - 1),
        counts: adjustInvitationCounts(page.counts, bucket, null),
        stats: omitInvitationStat(page.stats, invitation.id),
    }));
}

function updateInvitationInPages(
    pages: InvitationsPageResponse[] | undefined,
    updatedInvitation: InvitationData,
    previousInvitation: InvitationData,
    activeFilter: string
) {
    if (!pages) return pages;
    const previousBucket = getInvitationFilterBucket(previousInvitation);
    const nextBucket = getInvitationFilterBucket(updatedInvitation);
    const shouldKeepInCurrentFilter = isInvitationVisibleInFilter(updatedInvitation, activeFilter);

    return pages.map((page) => ({
        ...page,
        items: page.items
            .map((item) => item.id === updatedInvitation.id ? updatedInvitation : item)
            .filter((item) => item.id !== updatedInvitation.id || shouldKeepInCurrentFilter),
        totalCount: page.totalCount + (shouldKeepInCurrentFilter ? 0 : -1),
        counts: adjustInvitationCounts(page.counts, previousBucket, nextBucket),
    }));
}

function getInvitationFilterBucket(invitation: InvitationData) {
    const lifecycleStatus = getVisibleLifecycleStatus(invitation);
    if (lifecycleStatus === "draft") return "draft";
    if (lifecycleStatus === "offline") return "offline";
    if (lifecycleStatus === "completed") return "completed";
    return "upcoming";
}

function getVisibleLifecycleStatus(invitation: InvitationData): DashboardLifecycleStatus {
    const isPaidPublishFailed = invitation.paymentStatus === "paid" &&
        !invitation.firstPublishedAt &&
        invitation.status !== "published";
    return isPaidPublishFailed ? "offline" : getInvitationLifecycleStatus(invitation);
}

function isInvitationVisibleInFilter(invitation: InvitationData, activeFilter: string) {
    if (activeFilter === "all") return true;
    return getInvitationFilterBucket(invitation) === activeFilter;
}

function adjustInvitationCounts(
    counts: Record<string, number>,
    previousBucket: string | null,
    nextBucket: string | null
) {
    const nextCounts = { ...counts };
    if (previousBucket) nextCounts[previousBucket] = Math.max(0, (nextCounts[previousBucket] || 0) - 1);
    if (nextBucket) nextCounts[nextBucket] = (nextCounts[nextBucket] || 0) + 1;
    if (!nextBucket) nextCounts.all = Math.max(0, (nextCounts.all || 0) - 1);
    return nextCounts;
}

function omitInvitationStat(
    stats: Record<string, { rsvps: number; views: number; acceptsRsvps?: boolean }>,
    invitationId: string
) {
    const nextStats = { ...stats };
    delete nextStats[invitationId];
    return nextStats;
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
        <article className="profileInviteRow profileInviteRow--bg profileInviteRow--wedding">
            <div className="profileInviteInfo">
                <div className="profileInviteDetails">
                    <div className="profileInviteHeader">
                        <TextSkeleton width={150} height={14} />
                        <ButtonSkeleton width={92} height={26} />
                    </div>
                    <TextSkeleton width={220} height={24} />
                    <TextSkeleton width="82%" height={15} />
                    <div className="profileInviteMeta">
                        <TextSkeleton width={112} height={15} />
                        <TextSkeleton width={150} height={15} />
                        <TextSkeleton width={140} height={15} />
                    </div>
                </div>
            </div>
            <Skeleton className="profilePublicLinkWrap" style={{ width: "100%", height: 40 }} rounded="lg" />
            <div className="profileInviteActions">
                <ButtonSkeleton width="100%" height={34} />
                <ButtonSkeleton width="100%" height={34} />
                <ButtonSkeleton width="100%" height={34} />
            </div>
        </article>
    );
}

function InvitationRow({
    invitation,
    onInvitationDeleted,
    onInvitationUpdated,
}: {
    invitation: InvitationData;
    stats: { rsvps: number; views: number; acceptsRsvps?: boolean };
    onInvitationDeleted: (invitation: InvitationData) => void;
    onInvitationUpdated: (updatedInvitation: InvitationData, previousInvitation: InvitationData) => void;
}) {
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isOfflineOpen, setIsOfflineOpen] = useState(false);
    const [isOnlineOpen, setIsOnlineOpen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isTakingOffline, setIsTakingOffline] = useState(false);
    const [isMakingOnline, setIsMakingOnline] = useState(false);
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);
    const moreMenuFirstItemRef = useRef<HTMLButtonElement>(null);
    const router = useRouter();
    const { showToast } = useToast();
    const { mutate } = useSWRConfig();
    const refreshInvitationLists = () => mutate((key) => typeof key === "string" && key.startsWith("/api/invitations"));

    const isPaidPublishFailed = invitation.paymentStatus === "paid" &&
        !invitation.firstPublishedAt &&
        invitation.status !== "published";
    const lifecycleStatus = isPaidPublishFailed ? "offline" : getInvitationLifecycleStatus(invitation);
    const isDraft = lifecycleStatus === "draft";
    const isUpcoming = lifecycleStatus === "upcoming";
    const isLiveToday = lifecycleStatus === "live_today";
    const isCompleted = lifecycleStatus === "completed";
    const isOffline = lifecycleStatus === "offline";
    const isPublic = isUpcoming || isLiveToday || isCompleted;
    const hasAnalyticsAccess = Boolean(invitation.firstPublishedAt || invitation.publishedAt);
    const isSample = invitation.id.startsWith("sample-");
    const editHref = isSample ? "/templates" : `/builder?id=${invitation.id}&from=invitations`;
    const analyticsHref = `/invitations/${invitation.id}/analytics`;
    const previewHref = isSample
        ? "/templates"
        : isPublic
            ? `/i/${invitation.slug}`
            : `/builder/preview?id=${invitation.id}&from=invitations`;
    const publicUrl = getPublicInvitationUrl(invitation.slug);

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
        const originalData = await mutate("/api/profile/dashboard");

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
            refreshInvitationLists();
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
        const originalData = await mutate("/api/profile/dashboard");

        mutate("/api/profile/dashboard", (current?: DashboardData) => {
            if (!current) return current;
            const updatedInvitations = current.invitations.map((item) => {
                if (item.id === invitation.id) {
                    return {
                        ...item,
                        status: "draft" as const,
                        lifecycleStatus: "unpublished" as const,
                        eventStatus: "unpublished" as const,
                    };
                }
                return item;
            });
            return {
                ...current,
                invitations: updatedInvitations,
                published: current.published - 1,
                drafts: current.drafts + 1,
            };
        }, { revalidate: false });

        try {
            const response = await fetch(`/api/invitations/${invitation.id}/unpublish`, {
                method: "POST",
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                showToast(result.error || "Unable to take invitation offline.", "error");
                mutate("/api/profile/dashboard", originalData, { revalidate: false });
                return;
            }
            onInvitationUpdated({
                ...invitation,
                status: "draft",
                lifecycleStatus: "unpublished",
                eventStatus: "unpublished",
                updatedAt: new Date().toISOString(),
            }, invitation);
            showToast("Invitation taken offline.", "success");
            mutate("/api/profile/dashboard");
            refreshInvitationLists();
        } catch {
            showToast("Unable to take invitation offline.", "error");
            mutate("/api/profile/dashboard", originalData, { revalidate: false });
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
        setIsMakingOnline(true);
        const originalData = await mutate("/api/profile/dashboard");

        mutate("/api/profile/dashboard", (current?: DashboardData) => {
            if (!current) return current;
            const updatedInvitations = current.invitations.map((item) => {
                if (item.id === invitation.id) {
                    return {
                        ...item,
                        status: "published" as const,
                        lifecycleStatus: "published" as const,
                        eventStatus: "published" as const,
                    };
                }
                return item;
            });
            return {
                ...current,
                invitations: updatedInvitations,
                published: current.published + 1,
                drafts: current.drafts - 1,
            };
        }, { revalidate: false });

        try {
            const response = await fetch(`/api/invitations/${invitation.id}/publish`, {
                method: "POST",
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                showToast(result.error || "Unable to make invitation online.", "error");
                mutate("/api/profile/dashboard", originalData, { revalidate: false });
                return;
            }
            onInvitationUpdated({
                ...invitation,
                slug: result.slug || invitation.slug,
                status: "published",
                lifecycleStatus: "published",
                eventStatus: "published",
                paymentStatus: "paid",
                publishedAt: result.published_at || invitation.publishedAt || new Date().toISOString(),
                firstPublishedAt: invitation.firstPublishedAt || result.published_at || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }, invitation);
            showToast("Invitation is online again.", "success");
            mutate("/api/profile/dashboard");
            refreshInvitationLists();
        } catch {
            showToast("Unable to make invitation online.", "error");
            mutate("/api/profile/dashboard", originalData, { revalidate: false });
        } finally {
            setIsMakingOnline(false);
            setIsOnlineOpen(false);
        }
    }

    function handleCopyPublicLink() {
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
                    <p className="inviteMessage">
                        {isPaidPublishFailed
                            ? "Paid, but publish did not complete. Edit and publish again."
                            : getDashboardInviteSummary(lifecycleStatus)}
                    </p>

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
                        <span>
                            <RefreshCw size={14} aria-hidden="true" />
                            Updated {formatDate(invitation.updatedAt)}
                        </span>
                    </div>

                </div>
            </div>

            {isPublic && !isSample ? (
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
            ) : isDraft || isOffline ? (
                <div className="profilePublicLinkWrap profilePublicLinkWrap--empty">
                    <span className="profilePublicLinkPlaceholder">
                        <Lock size={14} aria-hidden="true" />
                        {isOffline
                            ? isPaidPublishFailed
                                ? "Paid, but not live yet. Edit and publish again."
                                : "Offline. Public link disabled."
                            : "Not published yet. Preview or edit to continue."}
                    </span>
                </div>
            ) : null}

            <div className={`profileInviteActions ${isCompleted ? "profileInviteActions--two" : isOffline && hasAnalyticsAccess ? "profileInviteActions--published" : isUpcoming || isLiveToday ? "profileInviteActions--published" : ""}`}>
                {isDraft ? (
                    <>
                        <Link href={previewHref} className="profileActionBtn profileActionBtn--primary">
                            <Eye size={14} aria-hidden="true" />
                            <span>Preview</span>
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
                        <Link href={previewHref} className="profileActionBtn profileActionBtn--primary">
                            <Eye size={14} aria-hidden="true" />
                            <span>Preview</span>
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
                ) : isUpcoming || isLiveToday ? (
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
	                        <a href={previewHref} target="_blank" rel="noreferrer" className="profileActionBtn profileActionBtn--primary">
	                            <Eye size={14} aria-hidden="true" />
	                            <span>View</span>
	                        </a>
	                        <Link href={analyticsHref} className="profileActionBtn">
	                            <BarChart3 size={14} aria-hidden="true" />
	                            <span>Analytics</span>
	                        </Link>
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

function getDashboardInviteSummary(status: DashboardLifecycleStatus) {
    switch (status) {
        case "draft":
            return "Complete details, then publish when ready.";
        case "upcoming":
            return "Public invite is live and ready for guests.";
        case "live_today":
            return "Event is live today. Track guest activity.";
        case "completed":
            return "Event completed. Review views and activity.";
        case "offline":
            return "Offline. Guests cannot access this invitation.";
    }
}

function getDisplayNames(invitation: InvitationData) {
    return invitation.secondaryName
        ? `${invitation.primaryName} & ${invitation.secondaryName}`
        : invitation.primaryName;
}

function getInvitationArtClass(invitation: InvitationData) {
    const category = invitation.category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
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

function formatEventTimeRange(value: string) {
    return value.replace(/\s*-\s*/g, " - ").trim();
}
