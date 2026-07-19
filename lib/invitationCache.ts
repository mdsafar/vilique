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

const PENDING_ITEM_MUTATION_TTL_MS = 5000;

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
        (item) => item.id !== mutation.id && now - item.timestamp < PENDING_ITEM_MUTATION_TTL_MS
    );
    pendingItemMutationsStore.push({ ...mutation, timestamp: now });
}

export function getPendingItemMutations() {
    const now = Date.now();
    pendingItemMutationsStore = pendingItemMutationsStore.filter(
        (item) => now - item.timestamp < PENDING_ITEM_MUTATION_TTL_MS
    );
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

export function removeInvitationFromPages(
    pages: InvitationsPageResponse[] | undefined,
    invitation: InvitationData
) {
    if (!pages || !Array.isArray(pages)) return pages;
    const bucket = getInvitationFilterBucket(invitation);
    const nextCounts = pages[0]?.counts
        ? adjustInvitationCounts(pages[0].counts, bucket, null)
        : undefined;

    return pages.map((page) => ({
        ...page,
        items: Array.isArray(page?.items) ? page.items.filter((item) => item.id !== invitation.id) : [],
        totalCount: Math.max(0, page.totalCount - 1),
        counts: nextCounts || page.counts,
        stats: omitInvitationStat(page.stats, invitation.id),
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
        if (sortKey === "newest") {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortKey === "oldest") {
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortKey === "event_soonest") {
            const dateA = a.eventDate ? new Date(a.eventDate).getTime() : Infinity;
            const dateB = b.eventDate ? new Date(b.eventDate).getTime() : Infinity;
            return dateA - dateB;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    };
}

export function updateInvitationInPages(
    pages: InvitationsPageResponse[] | undefined,
    updatedInvitation: InvitationData,
    _previousInvitation?: InvitationData | null,
    activeFilter: string = "all",
    sortKey: string = "updated_desc"
): InvitationsPageResponse[] | undefined {
    if (!pages || !Array.isArray(pages) || pages.length === 0) return pages;

    const shouldKeepInCurrentFilter = isInvitationVisibleInFilter(updatedInvitation, activeFilter);
    const existingServerItem = pages.flatMap((page) => page.items || []).find((item) => item.id === updatedInvitation.id);
    const prevItem = _previousInvitation || existingServerItem;
    const prevBucket = prevItem ? getInvitationFilterBucket(prevItem) : null;
    const nextBucket = getInvitationFilterBucket(updatedInvitation);
    const nextCounts = pages[0]?.counts
        ? adjustInvitationCounts(pages[0].counts, prevBucket, nextBucket)
        : undefined;

    const existsInPages = pages.some((page) => Array.isArray(page?.items) && page.items.some((item) => item.id === updatedInvitation.id));

    if (existsInPages) {
        return pages.map((page) => {
            if (!Array.isArray(page?.items)) return page;
            const hasItem = page.items.some((item) => item.id === updatedInvitation.id);
            if (!hasItem) {
                return {
                    ...page,
                    counts: nextCounts || page.counts,
                };
            }

            let updatedItems: InvitationData[];
            if (!shouldKeepInCurrentFilter) {
                updatedItems = page.items.filter((item) => item.id !== updatedInvitation.id);
            } else {
                // REPLACE IN PLACE at exact same position!
                updatedItems = page.items.map((item) =>
                    item.id === updatedInvitation.id ? { ...item, ...updatedInvitation } : item
                );
            }

            return {
                ...page,
                items: updatedItems,
                totalCount: Math.max(0, page.totalCount + (shouldKeepInCurrentFilter ? 0 : -1)),
                counts: nextCounts || page.counts,
            };
        });
    }

    if (!shouldKeepInCurrentFilter) {
        return pages.map((page) => ({
            ...page,
            counts: nextCounts || page.counts,
        }));
    }

    const currentTotalItems = pages.reduce((sum, page) => sum + (Array.isArray(page?.items) ? page.items.length : 0), 0);
    const targetCount = nextCounts?.[activeFilter] ?? pages[0]?.counts?.[activeFilter];

    if (activeFilter !== "all" && targetCount !== undefined && currentTotalItems >= targetCount) {
        return pages.map((page) => ({
            ...page,
            counts: nextCounts || page.counts,
        }));
    }

    const compare = getSortCompareFn(sortKey);
    let inserted = false;

    const newPages = pages.map((page, index) => {
        if (!Array.isArray(page?.items)) return page;
        const filtered = page.items.filter((item) => item.id !== updatedInvitation.id);

        if (!inserted) {
            const insertIdx = filtered.findIndex((item) => compare(updatedInvitation, item) <= 0);
            if (insertIdx !== -1) {
                inserted = true;
                const nextItems = [...filtered.slice(0, insertIdx), updatedInvitation, ...filtered.slice(insertIdx)];
                return {
                    ...page,
                    items: nextItems,
                    totalCount: page.totalCount + 1,
                    counts: nextCounts || page.counts,
                };
            } else if (index === pages.length - 1) {
                inserted = true;
                return {
                    ...page,
                    items: [...filtered, updatedInvitation],
                    totalCount: page.totalCount + 1,
                    counts: nextCounts || page.counts,
                };
            }
        }

        return {
            ...page,
            items: filtered,
            counts: nextCounts || page.counts,
        };
    });

    if (!inserted && newPages.length > 0) {
        const firstPage = newPages[0];
        const filtered = (firstPage.items || []).filter((item) => item.id !== updatedInvitation.id);
        newPages[0] = {
            ...firstPage,
            items: [updatedInvitation, ...filtered],
            totalCount: firstPage.totalCount + 1,
            counts: nextCounts || firstPage.counts,
        };
    }

    return newPages;
}

export function applyInvitationMutationsToPages(
    pages: InvitationsPageResponse[] | undefined,
    mutations: PendingMutation[],
    activeFilter: string
): InvitationsPageResponse[] | undefined {
    if (!pages || !Array.isArray(pages)) return pages;

    let resultPages = pages;

    if (mutations && mutations.length > 0) {
        const hasPages = Array.isArray(pages) && pages.length > 0;

        if (!hasPages) {
            const syntheticMap = new Map<string, InvitationData>();
            for (const m of mutations) {
                if (m.deletedInvitation) {
                    syntheticMap.delete(m.deletedInvitation.id);
                } else if (m.invitation) {
                    if (isInvitationVisibleInFilter(m.invitation, activeFilter)) {
                        syntheticMap.set(m.invitation.id, m.invitation);
                    } else {
                        syntheticMap.delete(m.invitation.id);
                    }
                }
            }

            const syntheticItems = Array.from(syntheticMap.values());
            if (syntheticItems.length === 0) return pages;

            return [{
                items: syntheticItems,
                nextCursor: null,
                hasMore: false,
                totalCount: syntheticItems.length,
                counts: {
                    all: syntheticItems.length,
                    upcoming: syntheticItems.filter((i) => getInvitationFilterBucket(i) === "upcoming").length,
                    completed: syntheticItems.filter((i) => getInvitationFilterBucket(i) === "completed").length,
                    draft: syntheticItems.filter((i) => getInvitationFilterBucket(i) === "draft").length,
                    offline: syntheticItems.filter((i) => getInvitationFilterBucket(i) === "offline").length,
                },
                stats: {},
            }];
        }

        resultPages = mutations.reduce<InvitationsPageResponse[] | undefined>((currentPages, mutation) => {
            if (!currentPages) return currentPages;

            if (mutation.invitation) {
                return updateInvitationInPages(currentPages, mutation.invitation, mutation.previous, activeFilter);
            }

            if (mutation.deletedInvitation) {
                return removeInvitationFromPages(currentPages, mutation.deletedInvitation);
            }

            return currentPages;
        }, pages) || pages;
    }

    return resultPages.map((page) => {
        if (!Array.isArray(page?.items)) return page;
        let itemsChanged = false;
        const updatedItems = page.items.map((item) => {
            const latest = latestInvitationByIdStore.get(item.id);
            if (latest && latest !== item) {
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

export function mutateInvitationState(
    globalMutate: GlobalMutateFn,
    updatedInvitation?: InvitationData,
    previousInvitation?: InvitationData | null,
    deletedInvitation?: InvitationData,
    force: boolean = false
) {
    const timestamp = Date.now();
    if (updatedInvitation) {
        recordPendingItemMutation({ id: updatedInvitation.id, invitation: updatedInvitation, previous: previousInvitation }, force);
    } else if (deletedInvitation) {
        recordPendingItemMutation({ id: deletedInvitation.id, deletedInvitation }, force);
        latestInvitationByIdStore.delete(deletedInvitation.id);
    }

    if (process.env.NODE_ENV !== "production") {
        console.log(`[InvitationsCache] mutateInvitationState dispatched at ${timestamp}`, {
            id: updatedInvitation?.id || deletedInvitation?.id,
            status: updatedInvitation?.status,
        });
    }

    void globalMutate(
        (key) => typeof key === "string" && key.includes("/api/invitations") && !key.includes("/api/invitations/"),
        (currentPages: InvitationsPageResponse[] | undefined, key?: string) => {
            if (!currentPages || !Array.isArray(currentPages)) return currentPages;
            const filter = typeof key === "string" ? getFilterFromSWRKey(key) : "all";
            const sort = typeof key === "string" ? getSortFromSWRKey(key) : "updated_desc";
            if (updatedInvitation) {
                return updateInvitationInPages(currentPages, updatedInvitation, previousInvitation, filter, sort);
            }
            if (deletedInvitation) {
                return removeInvitationFromPages(currentPages, deletedInvitation);
            }
            return currentPages;
        },
        { revalidate: false }
    );

    if (updatedInvitation) {
        void globalMutate(`/api/invitations/${updatedInvitation.id}`, updatedInvitation, { revalidate: false });
    }

    if (updatedInvitation) {
        void globalMutate("/api/profile/dashboard", (current?: DashboardData) => {
            if (!current) return current;
            const existing = current.invitations.find((item) => item.id === updatedInvitation.id);
            const isNew = !existing;
            const wasDraft = previousInvitation ? previousInvitation.status === "draft" : existing?.status === "draft";
            const isNowDraft = updatedInvitation.status === "draft";

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
