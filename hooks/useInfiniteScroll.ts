"use client";

import { RefObject, useEffect, useRef } from "react";

type InfiniteScrollOptions = {
    disabled?: boolean;
    root?: Element | null;
    rootMargin?: string;
    onLoadMore: () => void;
};

export function useInfiniteScroll<T extends Element>({
    disabled = false,
    root = null,
    rootMargin = "420px 0px",
    onLoadMore,
}: InfiniteScrollOptions): RefObject<T | null> {
    const sentinelRef = useRef<T | null>(null);
    const onLoadMoreRef = useRef(onLoadMore);

    useEffect(() => {
        onLoadMoreRef.current = onLoadMore;
    }, [onLoadMore]);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || disabled) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    onLoadMoreRef.current();
                }
            },
            { root, rootMargin, threshold: 0.01 }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [disabled, root, rootMargin]);

    return sentinelRef;
}
