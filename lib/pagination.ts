/**
 * Deduplicates an array of items by a specific unique key.
 */
export function deduplicateItems<T>(items: T[], key: keyof T): T[] {
    const seen = new Set<unknown>();
    return items.filter((item) => {
        const val = item[key];
        if (seen.has(val)) return false;
        seen.add(val);
        return true;
    });
}

/**
 * Determines if SWR should stop requesting the next page.
 * Stops if the previous page reports `hasMore: false` or returns fewer than 10 items.
 */
export function shouldStopRequesting<T extends { items?: unknown[]; ratings?: unknown[] }>(
    previousPageData: T | null | undefined
): boolean {
    if (!previousPageData) return false;
    const list = previousPageData.items || previousPageData.ratings || [];
    const hasMore = (previousPageData as { hasMore?: boolean }).hasMore;
    return hasMore === false || list.length < 10;
}

/**
 * Validates scroll load conditions to prevent multiple duplicate requests.
 * Disables the scroll sentinel if there are no more pages, if we are loading,
 * or if SWR size is greater than the loaded pages count (request in flight).
 */
export function shouldDisableSentinel(options: {
    hasMore: boolean;
    isLoading: boolean;
    size: number;
    pageCount: number;
}): boolean {
    return !options.hasMore || options.isLoading || options.size > options.pageCount;
}
