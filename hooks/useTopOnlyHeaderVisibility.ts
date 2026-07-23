"use client";

import {
    useCallback,
    useEffect,
    useRef,
} from "react";

export const HEADER_REVEAL_START = 120;
export const HEADER_REVEAL_COMPLETE = 40;

type TopOnlyHeaderVisibilityOptions = {
    mediaQuery: string;
    listenToWindow?: boolean;
    titleHeight: number;
    titleSpacing?: number;
    layoutTargetSelector?: string;
    expandedLayoutPadding?: number;
    collapsedLayoutPadding?: number;
    expandedTopPadding?: number;
    collapsedTopPadding?: number;
    searchSpacing?: number;
};

export function getHeaderRevealProgress(scrollPosition: number) {
    const clampedScrollPosition = Math.max(0, scrollPosition);
    const revealRange =
        HEADER_REVEAL_START - HEADER_REVEAL_COMPLETE;

    return Math.min(
        1,
        Math.max(
            0,
            (HEADER_REVEAL_START - clampedScrollPosition)
                / revealRange,
        ),
    );
}

export function useTopOnlyHeaderVisibility({
    mediaQuery,
    listenToWindow = false,
    titleHeight,
    titleSpacing = 0,
    layoutTargetSelector,
    expandedLayoutPadding = 0,
    collapsedLayoutPadding = expandedLayoutPadding,
    expandedTopPadding = 0,
    collapsedTopPadding = expandedTopPadding,
    searchSpacing = 0,
}: TopOnlyHeaderVisibilityOptions) {
    const headerElementRef = useRef<HTMLElement | null>(null);
    const layoutElementRef = useRef<HTMLElement | null>(null);
    const mediaQueryRef = useRef<MediaQueryList | null>(null);
    const pendingScrollPositionRef = useRef(0);
    const lastProgressRef = useRef<number | null>(null);
    const animationFrameRef = useRef(0);

    const updateVisibility = useCallback(() => {
        animationFrameRef.current = 0;

        const scrollPosition = Math.max(
            0,
            pendingScrollPositionRef.current,
        );
        const isMobile = mediaQueryRef.current?.matches ?? false;
        const progress = isMobile
            ? getHeaderRevealProgress(scrollPosition)
            : 1;

        if (progress === lastProgressRef.current) return;
        lastProgressRef.current = progress;

        const headerElement = headerElementRef.current;
        if (!headerElement) return;

        headerElement.style.setProperty(
            "--header-reveal-progress",
            progress.toFixed(4),
        );
        headerElement.style.setProperty(
            "--header-reveal-offset",
            `${(progress - 1) * 8}px`,
        );
        headerElement.style.setProperty(
            "--header-title-height",
            `${progress * titleHeight}px`,
        );
        headerElement.style.setProperty(
            "--header-title-spacing",
            `${progress * titleSpacing}px`,
        );
        headerElement.style.setProperty(
            "--header-top-padding",
            `${
                collapsedTopPadding
                + progress
                    * (expandedTopPadding - collapsedTopPadding)
            }px`,
        );
        headerElement.style.setProperty(
            "--header-search-spacing",
            `${progress * searchSpacing}px`,
        );
        layoutElementRef.current?.style.setProperty(
            "--header-layout-padding",
            `${
                collapsedLayoutPadding
                + progress
                    * (expandedLayoutPadding - collapsedLayoutPadding)
            }px`,
        );
        headerElement.dataset.headerRevealState =
            progress === 0
                ? "hidden"
                : progress === 1
                    ? "visible"
                    : "revealing";
    }, [
        collapsedTopPadding,
        collapsedLayoutPadding,
        expandedLayoutPadding,
        expandedTopPadding,
        searchSpacing,
        titleHeight,
        titleSpacing,
    ]);

    const scheduleVisibilityUpdate = useCallback(
        (scrollPosition: number) => {
            pendingScrollPositionRef.current = Math.max(
                0,
                scrollPosition,
            );

            if (animationFrameRef.current) return;
            animationFrameRef.current =
                window.requestAnimationFrame(updateVisibility);
        },
        [updateVisibility],
    );

    const headerRevealRef = useCallback(
        (element: HTMLElement | null) => {
            if (!element) {
                layoutElementRef.current?.style.removeProperty(
                    "--header-layout-padding",
                );
                layoutElementRef.current = null;
            }

            headerElementRef.current = element;
            lastProgressRef.current = null;

            if (element) {
                layoutElementRef.current = layoutTargetSelector
                    ? element.closest<HTMLElement>(
                        layoutTargetSelector,
                    )
                    : null;
                updateVisibility();
            }
        },
        [layoutTargetSelector, updateVisibility],
    );

    useEffect(() => {
        const mobileQuery = window.matchMedia(mediaQuery);
        mediaQueryRef.current = mobileQuery;

        const handleScroll = () => {
            scheduleVisibilityUpdate(window.scrollY);
        };

        const handleMediaChange = () => {
            scheduleVisibilityUpdate(
                listenToWindow
                    ? window.scrollY
                    : pendingScrollPositionRef.current,
            );
        };

        if (listenToWindow) {
            window.addEventListener("scroll", handleScroll, {
                passive: true,
            });
            pendingScrollPositionRef.current = Math.max(
                0,
                window.scrollY,
            );
        }

        mobileQuery.addEventListener("change", handleMediaChange);
        scheduleVisibilityUpdate(
            listenToWindow ? window.scrollY : 0,
        );

        return () => {
            if (listenToWindow) {
                window.removeEventListener("scroll", handleScroll);
            }
            mobileQuery.removeEventListener(
                "change",
                handleMediaChange,
            );
            mediaQueryRef.current = null;

            if (animationFrameRef.current) {
                window.cancelAnimationFrame(
                    animationFrameRef.current,
                );
                animationFrameRef.current = 0;
            }
        };
    }, [
        listenToWindow,
        mediaQuery,
        scheduleVisibilityUpdate,
    ]);

    return {
        headerRevealRef,
        scheduleVisibilityUpdate,
    };
}
