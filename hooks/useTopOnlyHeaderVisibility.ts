"use client";

import {
    useCallback,
    useEffect,
    useRef,
} from "react";

export const HEADER_REVEAL_START = 120;
export const HEADER_REVEAL_COMPLETE = 40;
export const HEADER_REVEAL_SMOOTHING_MS = 70;

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
    const reducedMotionQueryRef =
        useRef<MediaQueryList | null>(null);
    const pendingScrollPositionRef = useRef(0);
    const renderedProgressRef = useRef<number | null>(null);
    const appliedProgressRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef(0);
    const animationFrameRef = useRef(0);
    const updateVisibilityRef =
        useRef<(timestamp: number) => void>(() => undefined);

    const updateVisibility = useCallback((timestamp: number) => {
        animationFrameRef.current = 0;

        const scrollPosition = Math.max(
            0,
            pendingScrollPositionRef.current,
        );
        const isMobile = mediaQueryRef.current?.matches ?? false;
        const targetProgress = isMobile
            ? getHeaderRevealProgress(scrollPosition)
            : 1;
        const currentProgress =
            renderedProgressRef.current ?? targetProgress;
        const prefersReducedMotion =
            reducedMotionQueryRef.current?.matches ?? false;
        const elapsed = lastFrameTimeRef.current
            ? Math.min(64, timestamp - lastFrameTimeRef.current)
            : 16.67;
        const smoothingFactor = prefersReducedMotion
            ? 1
            : 1 - Math.exp(
                -elapsed / HEADER_REVEAL_SMOOTHING_MS,
            );
        const interpolatedProgress =
            currentProgress
            + (targetProgress - currentProgress)
                * smoothingFactor;
        const progress =
            Math.abs(targetProgress - interpolatedProgress) < 0.001
                ? targetProgress
                : interpolatedProgress;

        renderedProgressRef.current = progress;
        lastFrameTimeRef.current = timestamp;

        const headerElement = headerElementRef.current;
        if (!headerElement) return;

        if (progress !== appliedProgressRef.current) {
            appliedProgressRef.current = progress;

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
                        * (
                            expandedLayoutPadding
                            - collapsedLayoutPadding
                        )
                }px`,
            );
            headerElement.dataset.headerRevealState =
                progress === 0
                    ? "hidden"
                    : progress === 1
                        ? "visible"
                        : "revealing";
        }

        if (progress !== targetProgress) {
            animationFrameRef.current =
                window.requestAnimationFrame(
                    updateVisibilityRef.current,
                );
        } else {
            lastFrameTimeRef.current = 0;
        }
    }, [
        collapsedTopPadding,
        collapsedLayoutPadding,
        expandedLayoutPadding,
        expandedTopPadding,
        searchSpacing,
        titleHeight,
        titleSpacing,
    ]);

    useEffect(() => {
        updateVisibilityRef.current = updateVisibility;
    }, [updateVisibility]);

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
            renderedProgressRef.current = null;
            appliedProgressRef.current = null;
            lastFrameTimeRef.current = 0;

            if (element) {
                layoutElementRef.current = layoutTargetSelector
                    ? element.closest<HTMLElement>(
                        layoutTargetSelector,
                    )
                    : null;
                if (!animationFrameRef.current) {
                    animationFrameRef.current =
                        window.requestAnimationFrame(
                            updateVisibility,
                        );
                }
            }
        },
        [layoutTargetSelector, updateVisibility],
    );

    useEffect(() => {
        const mobileQuery = window.matchMedia(mediaQuery);
        const reducedMotionQuery = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        );
        mediaQueryRef.current = mobileQuery;
        reducedMotionQueryRef.current = reducedMotionQuery;

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
        reducedMotionQuery.addEventListener(
            "change",
            handleMediaChange,
        );
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
            reducedMotionQuery.removeEventListener(
                "change",
                handleMediaChange,
            );
            mediaQueryRef.current = null;
            reducedMotionQueryRef.current = null;

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
