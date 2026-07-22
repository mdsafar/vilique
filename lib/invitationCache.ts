import { InvitationData } from "@/types/invitation";
import { getInvitationLifecycle, InvitationLifecycleStatus } from "@/lib/lifecycle";
import { notifyProfileDataChanged } from "@/lib/events";

export type InvitationsPageResponse = {
    items: InvitationData[];
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
    counts: Record<string, number>;
    stats: Record<string, { rsvps: number; views: number; acceptsRsvps?: boolean }>;
    /** Client-only metadata. It is never sent by the invitations API. */
    clientRequestStartedAt?: number;
    clientReceivedAt?: number;
    clientMutationVersions?: Record<string, number>;
};

export type InvitationFilterCacheState = {
    items: InvitationData[];
    hasLoadedInitialPage: boolean;
    isInitialLoading: boolean;
    isRefreshing: boolean;
    hasMore: boolean;
    nextPage: number | null;
    lastFetchedAt: number | null;
    error: unknown | null;
    pendingMutationIds: string[];
};

export interface DashboardData {
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

export interface PendingMutation {
    id: string;
    invitation?: InvitationData;
    previous?: InvitationData | null;
    deletedInvitation?: InvitationData;
    timestamp: number;
}

const MAX_PENDING_ITEM_MUTATIONS = 100;

let pendingItemMutationsStore: PendingMutation[] = [];
const latestInvitationByIdStore = new Map<string, InvitationData>();

export function recordLatestInvitationState(invitation: InvitationData, force: boolean = false) {
    if (!invitation || !invitation.id) return;
    const existing = latestInvitationByIdStore.get(invitation.id);
    if (force || !existing || new Date(invitation.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
        latestInvitationByIdStore.set(invitation.id, invitation);
    }
}

export function recordPendingItemMutation(mutation: Omit<PendingMutation, "timestamp">, force: boolean = false) {
    const now = Date.now();
    if (mutation.invitation) {
        recordLatestInvitationState(mutation.invitation, force);
    }
    pendingItemMutationsStore = pendingItemMutationsStore.filter(
        (item) => item.id !== mutation.id
    );
    const recorded = { ...mutation, timestamp: now };
    pendingItemMutationsStore.push(recorded);
    pendingItemMutationsStore = pendingItemMutationsStore.slice(-MAX_PENDING_ITEM_MUTATIONS);
    return recorded;
}

export function getPendingItemMutations() {
    return pendingItemMutationsStore;
}

export function clearPendingItemMutations() {
    pendingItemMutationsStore = [];
}

export function removePendingItemMutation(id: string) {
    pendingItemMutationsStore = pendingItemMutationsStore.filter((item) => item.id !== id);
}

export function clearConfirmedPendingMutations(pages: InvitationsPageResponse[] | undefined, activeFilter: string = "all") {
    if (!pages || !Array.isArray(pages) || pages.length === 0) return;
    const pending = getPendingItemMutations();
    if (pending.length === 0) return;

    const serverItemsMap = new Map<string, InvitationData>();
    for (const page of pages) {
        if (Array.isArray(page?.items)) {
            for (const item of page.items) {
                serverItemsMap.set(item.id, item);
            }
        }
    }

    for (const mutation of pending) {
        const requestStartedAt = pages[0]?.clientRequestStartedAt;
        if (requestStartedAt !== undefined && requestStartedAt >= mutation.timestamp) {
            removePendingItemMutation(mutation.id);
            continue;
        }
        const serverItem = serverItemsMap.get(mutation.id);
        if (serverItem && mutation.invitation) {
            const serverBucket = getInvitationFilterBucket(serverItem);
            const mutationBucket = getInvitationFilterBucket(mutation.invitation);
            const serverTime = new Date(serverItem.updatedAt).getTime();
            const mutationTime = new Date(mutation.invitation.updatedAt).getTime();

            if ((activeFilter === mutationBucket || activeFilter === "all") && serverBucket === mutationBucket && serverTime >= mutationTime) {
                removePendingItemMutation(mutation.id);
            }
        } else if (!serverItem && mutation.deletedInvitation) {
            removePendingItemMutation(mutation.id);
        }
    }
}

export function getFilterFromSWRKey(key: string): string {
    if (typeof key !== "string") return "all";
    try {
        const cleanKey = key.replace(/^\$inf\$/, "");
        const queryIdx = cleanKey.indexOf("?");
        if (queryIdx === -1) return "all";
        const searchParams = new URLSearchParams(cleanKey.slice(queryIdx + 1));
        return searchParams.get("status") || "all";
    } catch {
        return "all";
    }
}

export function getInvitationFilterBucket(invitation: InvitationData) {
    const lifecycleStatus = getVisibleLifecycleStatus(invitation);
    if (lifecycleStatus === "draft") return "draft";
    if (lifecycleStatus === "offline") return "offline";
    if (lifecycleStatus === "completed") return "completed";
    return "upcoming";
}

export function getVisibleLifecycleStatus(invitation: InvitationData): InvitationLifecycleStatus {
    const isPaidPublishFailed = invitation.paymentStatus === "paid" &&
        !invitation.firstPublishedAt &&
        invitation.status !== "published";
    return isPaidPublishFailed ? "offline" : getInvitationLifecycle(invitation);
}

export function isInvitationVisibleInFilter(invitation: InvitationData, activeFilter: string) {
    if (activeFilter === "all") return true;
    return getInvitationFilterBucket(invitation) === activeFilter;
}

export function adjustInvitationCounts(
    counts: Record<string, number>,
    previousBucket: string | null,
    nextBucket: string | null
) {
    const nextCounts = { ...counts };
    if (previousBucket && previousBucket !== nextBucket) {
        nextCounts[previousBucket] = Math.max(0, (nextCounts[previousBucket] || 0) - 1);
    }
    if (nextBucket && previousBucket !== nextBucket) {
        nextCounts[nextBucket] = (nextCounts[nextBucket] || 0) + 1;
    }
    if (!previousBucket && nextBucket) {
        nextCounts.all = (nextCounts.all || 0) + 1;
    } else if (previousBucket && !nextBucket) {
        nextCounts.all = Math.max(0, (nextCounts.all || 0) - 1);
    }
    return nextCounts;
}

export function deriveInvitationFilterCacheState({
    pages,
    isValidating,
    error,
    pendingMutations = [],
}: {
    pages: InvitationsPageResponse[] | undefined;
    isValidating: boolean;
    error?: unknown;
    pendingMutations?: PendingMutation[];
}): InvitationFilterCacheState {
    const safePages = Array.isArray(pages) ? pages : [];
    const hasLoadedInitialPage = safePages.length > 0 && Boolean(safePages[0]);
    const items = hasLoadedInitialPage
        ? safePages.flatMap((page) => Array.isArray(page.items) ? page.items : [])
        : [];
    const hasMore = hasLoadedInitialPage && Boolean(safePages[safePages.length - 1]?.hasMore);

    return {
        items,
        hasLoadedInitialPage,
        isInitialLoading: !hasLoadedInitialPage && !error,
        isRefreshing: hasLoadedInitialPage && isValidating,
        hasMore,
        nextPage: hasMore ? safePages.length + 1 : null,
        lastFetchedAt: hasLoadedInitialPage
            ? safePages.reduce((latest, page) => Math.max(latest, page.clientReceivedAt || 0), 0) || null
            : null,
        error: error || null,
        pendingMutationIds: pendingMutations.map((mutation) => mutation.id),
    };
}

export function removeInvitationFromPages(
    pages: InvitationsPageResponse[] | undefined,
    invitation: InvitationData,
    activeFilter: string = "all",
    mutationTimestamp: number = Date.now(),
) {
    if (!pages || !Array.isArray(pages) || pages.length === 0) return pages;
    if (getAppliedMutationVersion(pages, invitation.id) >= mutationTimestamp) return pages;
    const bucket = getInvitationFilterBucket(invitation);
    const nextCounts = pages[0]?.counts
        ? adjustInvitationCounts(pages[0].counts, bucket, null)
        : undefined;
    const affectsCurrentFilter = isInvitationVisibleInFilter(invitation, activeFilter);
    const existsInPages = pages.some((page) => page.items?.some((item) => item.id === invitation.id));

    return pages.map((page) => ({
        ...page,
        items: Array.isArray(page?.items) ? page.items.filter((item) => item.id !== invitation.id) : [],
        totalCount: Math.max(0, page.totalCount - (affectsCurrentFilter || existsInPages ? 1 : 0)),
        counts: nextCounts || page.counts,
        stats: omitInvitationStat(page.stats, invitation.id),
        clientMutationVersions: {
            ...page.clientMutationVersions,
            [invitation.id]: mutationTimestamp,
        },
    }));
}

export function getSortFromSWRKey(key: string): string {
    if (typeof key !== "string") return "updated_desc";
    try {
        const cleanKey = key.replace(/^\$inf\$/, "");
        const queryIdx = cleanKey.indexOf("?");
        if (queryIdx === -1) return "updated_desc";
        const searchParams = new URLSearchParams(cleanKey.slice(queryIdx + 1));
        return searchParams.get("sort") || "updated_desc";
    } catch {
        return "updated_desc";
    }
}

function getSortCompareFn(sortKey: string = "updated_desc") {
    return (a: InvitationData, b: InvitationData) => {
        let result: number;
        if (sortKey === "newest") {
            result = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        } else if (sortKey === "oldest") {
            result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        } else if (sortKey === "event_soonest") {
            const dateA = a.eventDate ? new Date(a.eventDate).getTime() : Infinity;
            const dateB = b.eventDate ? new Date(b.eventDate).getTime() : Infinity;
            result = dateA - dateB;
        } else {
            // The API's updated_desc key intentionally sorts by created_at DESC.
            result = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (result !== 0) return result;
        return sortKey === "oldest" || sortKey === "event_soonest"
            ? a.id.localeCompare(b.id)
            : b.id.localeCompare(a.id);
    };
}

export function updateInvitationInPages(
    pages: InvitationsPageResponse[] | undefined,
    updatedInvitation: InvitationData,
    previousInvitation?: InvitationData | null,
    activeFilter: string = "all",
    sortKey: string = "updated_desc",
    mutationTimestamp: number = Date.now(),
): InvitationsPageResponse[] | undefined {
    if (!pages || !Array.isArray(pages) || pages.length === 0) return pages;
    if (getAppliedMutationVersion(pages, updatedInvitation.id) >= mutationTimestamp) return pages;

    const shouldKeepInCurrentFilter = isInvitationVisibleInFilter(updatedInvitation, activeFilter);
    const originalPageSizes = pages.map((page) => page.items?.length || 0);
    const originalItems = dedupeInvitations(pages.flatMap((page) => page.items || []));
    const existingServerItem = originalItems.find((item) => item.id === updatedInvitation.id);
    const prevItem = previousInvitation || existingServerItem;
    const prevBucket = prevItem ? getInvitationFilterBucket(prevItem) : null;
    const nextBucket = getInvitationFilterBucket(updatedInvitation);
    const nextCounts = pages[0]?.counts
        ? adjustInvitationCounts(pages[0].counts, prevBucket, nextBucket)
        : undefined;
    const wasVisibleInCurrentFilter = previousInvitation
        ? isInvitationVisibleInFilter(previousInvitation, activeFilter)
        : Boolean(existingServerItem);
    const totalCountDelta = Number(shouldKeepInCurrentFilter) - Number(wasVisibleInCurrentFilter);
    const nextTotalCount = Math.max(0, (pages[0]?.totalCount || 0) + totalCountDelta);

    let reconciledItems = originalItems.filter((item) => item.id !== updatedInvitation.id);
    if (shouldKeepInCurrentFilter) {
        reconciledItems.push(existingServerItem
            ? { ...existingServerItem, ...updatedInvitation }
            : updatedInvitation);
        reconciledItems.sort(getSortCompareFn(sortKey));
    }

    const originalLoadedCount = originalPageSizes.reduce((sum, count) => sum + count, 0);
    // Keep every already-fetched item when inserting. Dropping the previous
    // boundary item would make the unchanged server cursor skip that item on
    // the next infinite-scroll request. Revalidation restores canonical page
    // sizes and cursors in the background.
    const insertionRoom = shouldKeepInCurrentFilter && !wasVisibleInCurrentFilter ? 1 : 0;
    reconciledItems = reconciledItems.slice(0, originalLoadedCount + insertionRoom);

    let offset = 0;
    return pages.map((page, index) => {
        const isLastPage = index === pages.length - 1;
        const targetSize = isLastPage
            ? reconciledItems.length - offset
            : Math.min(originalPageSizes[index], Math.max(0, reconciledItems.length - offset));
        const items = reconciledItems.slice(offset, offset + targetSize);
        offset += targetSize;
        return {
            ...page,
            items,
            totalCount: nextTotalCount,
            counts: nextCounts || page.counts,
            clientMutationVersions: {
                ...page.clientMutationVersions,
                [updatedInvitation.id]: mutationTimestamp,
            },
        };
    });
}

export function applyInvitationMutationsToPages(
    pages: InvitationsPageResponse[] | undefined,
    mutations: PendingMutation[],
    activeFilter: string,
    sortKey: string = "updated_desc",
): InvitationsPageResponse[] | undefined {
    // A mutation is not an API page. An unvisited filter must remain
    // uninitialized until its first-page request succeeds.
    if (!pages || !Array.isArray(pages) || pages.length === 0) return pages;

    let resultPages = pages;

    if (mutations && mutations.length > 0) {
        resultPages = mutations.reduce<InvitationsPageResponse[] | undefined>((currentPages, mutation) => {
            if (!currentPages) return currentPages;
            const requestStartedAt = currentPages[0]?.clientRequestStartedAt || 0;
            if (requestStartedAt >= mutation.timestamp) return currentPages;

            if (mutation.invitation) {
                return updateInvitationInPages(
                    currentPages,
                    mutation.invitation,
                    mutation.previous,
                    activeFilter,
                    sortKey,
                    mutation.timestamp,
                );
            }

            if (mutation.deletedInvitation) {
                return removeInvitationFromPages(
                    currentPages,
                    mutation.deletedInvitation,
                    activeFilter,
                    mutation.timestamp,
                );
            }

            return currentPages;
        }, pages) || pages;
    }

    return resultPages.map((page) => {
        if (!Array.isArray(page?.items)) return page;
        let itemsChanged = false;
        const updatedItems = page.items.map((item) => {
            const latest = latestInvitationByIdStore.get(item.id);
            if (latest && latest !== item && getInvitationUpdatedAt(latest) > getInvitationUpdatedAt(item)) {
                itemsChanged = true;
                return { ...item, ...latest };
            }
            return item;
        });

        const validItems = activeFilter === "all"
            ? updatedItems
            : updatedItems.filter((item) => isInvitationVisibleInFilter(item, activeFilter));

        if (!itemsChanged && validItems.length === page.items.length) return page;

        return {
            ...page,
            items: validItems,
        };
    });
}

export function reconcileInvitationCounts(
    serverCounts: Record<string, number>,
    mutations: PendingMutation[],
    requestStartedAt: number,
) {
    return mutations
        .filter((mutation) => mutation.timestamp > requestStartedAt)
        .reduce((counts, mutation) => {
            if (mutation.invitation) {
                const previousBucket = mutation.previous
                    ? getInvitationFilterBucket(mutation.previous)
                    : null;
                return adjustInvitationCounts(
                    counts,
                    previousBucket,
                    getInvitationFilterBucket(mutation.invitation),
                );
            }
            if (mutation.deletedInvitation) {
                return adjustInvitationCounts(
                    counts,
                    getInvitationFilterBucket(mutation.deletedInvitation),
                    null,
                );
            }
            return counts;
        }, serverCounts);
}

function getAppliedMutationVersion(pages: InvitationsPageResponse[], invitationId: string) {
    return pages.reduce(
        (latest, page) => Math.max(latest, page.clientMutationVersions?.[invitationId] || 0),
        0,
    );
}

function dedupeInvitations(items: InvitationData[]) {
    const byId = new Map<string, InvitationData>();
    for (const item of items) byId.set(item.id, item);
    return Array.from(byId.values());
}

function getInvitationUpdatedAt(invitation: InvitationData) {
    const timestamp = new Date(invitation.updatedAt).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function omitInvitationStat(
    stats: Record<string, { rsvps: number; views: number; acceptsRsvps?: boolean }>,
    invitationId: string
) {
    const nextStats = { ...stats };
    delete nextStats[invitationId];
    return nextStats;
}

export type GlobalMutateFn = (
    key: string | ((key: unknown) => boolean),
    data?: unknown,
    opts?: { revalidate?: boolean }
) => Promise<unknown>;

export type InvitationCacheProvider = {
    keys: () => IterableIterator<unknown>;
};

export function getInitializedInvitationListKeys(cache?: InvitationCacheProvider) {
    if (!cache) return [];
    return Array.from(cache.keys()).filter(
        (key): key is string => typeof key === "string" && key.startsWith("$inf$/api/invitations?"),
    );
}

export function mutateInvitationState(
    globalMutate: GlobalMutateFn,
    updatedInvitation?: InvitationData,
    previousInvitation?: InvitationData | null,
    deletedInvitation?: InvitationData,
    force: boolean = false,
    cache?: InvitationCacheProvider,
) {
    let recordedMutation: PendingMutation | null = null;
    if (updatedInvitation) {
        recordedMutation = recordPendingItemMutation({ id: updatedInvitation.id, invitation: updatedInvitation, previous: previousInvitation }, force);
    } else if (deletedInvitation) {
        recordedMutation = recordPendingItemMutation({ id: deletedInvitation.id, deletedInvitation }, force);
        latestInvitationByIdStore.delete(deletedInvitation.id);
    }
    const timestamp = recordedMutation?.timestamp || Date.now();

    if (process.env.NODE_ENV !== "production") {
        console.log(`[InvitationsCache] mutateInvitationState dispatched at ${timestamp}`, {
            id: updatedInvitation?.id || deletedInvitation?.id,
            status: updatedInvitation?.status,
        });
    }

    for (const key of getInitializedInvitationListKeys(cache)) {
        void globalMutate(
            key,
            (currentPages: InvitationsPageResponse[] | undefined) => {
            if (!currentPages || !Array.isArray(currentPages)) return currentPages;
            const filter = getFilterFromSWRKey(key);
            const sort = getSortFromSWRKey(key);
            if (updatedInvitation) {
                return updateInvitationInPages(currentPages, updatedInvitation, previousInvitation, filter, sort, timestamp);
            }
            if (deletedInvitation) {
                return removeInvitationFromPages(currentPages, deletedInvitation, filter, timestamp);
            }
            return currentPages;
            },
            { revalidate: false },
        );
    }

    if (updatedInvitation) {
        void globalMutate(`/api/invitations/${updatedInvitation.id}`, updatedInvitation, { revalidate: false });
    }

    if (updatedInvitation) {
        void globalMutate("/api/profile/dashboard", (current?: DashboardData) => {
            if (!current) return current;
            const existing = current.invitations.find((item) => item.id === updatedInvitation.id);
            const isNew = !existing;
            const wasDraft = previousInvitation ? getInvitationLifecycle(previousInvitation) === "draft" : (existing ? getInvitationLifecycle(existing) === "draft" : false);
            const isNowDraft = getInvitationLifecycle(updatedInvitation) === "draft";

            let publishedDelta = 0;
            let draftsDelta = 0;

            if (isNew) {
                if (isNowDraft) draftsDelta = 1;
                else publishedDelta = 1;
            } else if (wasDraft && !isNowDraft) {
                draftsDelta = -1;
                publishedDelta = 1;
            } else if (!wasDraft && isNowDraft) {
                publishedDelta = -1;
                draftsDelta = 1;
            }

            const updatedList = isNew
                ? [updatedInvitation, ...current.invitations]
                : current.invitations.map((item) => (item.id === updatedInvitation.id ? updatedInvitation : item));

            return {
                ...current,
                invitations: updatedList,
                published: Math.max(0, current.published + publishedDelta),
                drafts: Math.max(0, current.drafts + draftsDelta),
            };
        }, { revalidate: false });
    }

    notifyProfileDataChanged(
        updatedInvitation
            ? { invitation: updatedInvitation, previous: previousInvitation }
            : deletedInvitation
            ? { deletedInvitation }
            : undefined
    );
}
