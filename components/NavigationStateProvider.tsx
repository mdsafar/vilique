"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type NavigationState = {
    templatesSearch: string;
    setTemplatesSearch: (s: string) => void;
    templatesFilter: string;
    setTemplatesFilter: (s: string) => void;
    invitationsSearch: string;
    setInvitationsSearch: (s: string) => void;
    invitationsFilter: string;
    setInvitationsFilter: (s: string) => void;
    scrollPositions: Record<string, number>;
    setScrollPosition: (path: string, y: number) => void;
    listSizes: Record<string, number>;
    setListSize: (listKey: string, size: number) => void;
};

type QueryBackedState = {
    value: string;
    touched: boolean;
    source: string | null;
};

type UrlQueries = {
    templatesSearchFromUrl: string | null;
    templatesFilterFromUrl: string | null;
    invitationsSearchFromUrl: string | null;
    invitationsFilterFromUrl: string | null;
    resetFromUrl: string | null;
};

const NavigationStateContext = createContext<NavigationState | undefined>(undefined);
const UrlQuerySyncContext = createContext<((queries: UrlQueries) => void) | undefined>(undefined);

function createQueryBackedState(source: string | null, defaultValue: string): QueryBackedState {
    return {
        value: source ?? defaultValue,
        touched: false,
        source,
    };
}

function getQueryBackedValue(state: QueryBackedState, source: string | null, defaultValue: string) {
    if (state.source !== source) return source ?? defaultValue;
    return state.touched ? state.value : source ?? state.value;
}

export function NavigationStateProvider({ children }: { children: React.ReactNode }) {
    return (
        <NavigationStateProviderCore>
            <React.Suspense fallback={null}>
                <UrlQueryListener />
            </React.Suspense>
            {children}
        </NavigationStateProviderCore>
    );
}

function NavigationStateProviderCore({ children }: { children: React.ReactNode }) {
    const [urlQueries, setUrlQueries] = useState<UrlQueries>({
        templatesSearchFromUrl: null,
        templatesFilterFromUrl: null,
        invitationsSearchFromUrl: null,
        invitationsFilterFromUrl: null,
        resetFromUrl: null,
    });

    const syncUrlQueries = useCallback((queries: UrlQueries) => {
        setUrlQueries((prev) => {
            if (
                prev.templatesSearchFromUrl === queries.templatesSearchFromUrl &&
                prev.templatesFilterFromUrl === queries.templatesFilterFromUrl &&
                prev.invitationsSearchFromUrl === queries.invitationsSearchFromUrl &&
                prev.invitationsFilterFromUrl === queries.invitationsFilterFromUrl &&
                prev.resetFromUrl === queries.resetFromUrl
            ) {
                return prev;
            }
            return queries;
        });
    }, []);

    const {
        templatesSearchFromUrl,
        templatesFilterFromUrl,
        invitationsSearchFromUrl,
        invitationsFilterFromUrl,
        resetFromUrl,
    } = urlQueries;

    const isInvitationsReset = resetFromUrl === "1";
    const activeInvitationsSearchFromUrl = isInvitationsReset ? null : invitationsSearchFromUrl;
    const activeInvitationsFilterFromUrl = isInvitationsReset ? null : invitationsFilterFromUrl;

    const [templatesSearchState, setTemplatesSearchState] = useState(() => createQueryBackedState(templatesSearchFromUrl, ""));
    const [templatesFilterState, setTemplatesFilterState] = useState(() => createQueryBackedState(templatesFilterFromUrl, "all"));
    const [invitationsSearchState, setInvitationsSearchState] = useState(() => createQueryBackedState(activeInvitationsSearchFromUrl, ""));
    const [invitationsFilterState, setInvitationsFilterState] = useState(() => createQueryBackedState(activeInvitationsFilterFromUrl, "all"));
    const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
    const [listSizes, setListSizes] = useState<Record<string, number>>({});

    useEffect(() => {
        if (resetFromUrl === "1" && typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            params.delete("reset");
            const nextUrl = params.toString() ? `/invitations?${params.toString()}` : "/invitations";
            window.history.replaceState(null, "", nextUrl);
            window.dispatchEvent(new PopStateEvent("popstate"));
        }
    }, [resetFromUrl]);

    const templatesSearch = getQueryBackedValue(templatesSearchState, templatesSearchFromUrl, "");
    const templatesFilter = getQueryBackedValue(templatesFilterState, templatesFilterFromUrl, "all");
    const invitationsSearch = getQueryBackedValue(invitationsSearchState, activeInvitationsSearchFromUrl, "");
    const invitationsFilter = getQueryBackedValue(invitationsFilterState, activeInvitationsFilterFromUrl, "all");
    const effectiveListSizes = isInvitationsReset ? { ...listSizes, invitations: 1 } : listSizes;

    const setTemplatesSearch = useCallback((value: string) => {
        setTemplatesSearchState({ value, touched: true, source: templatesSearchFromUrl });
        setListSizes((prev) => ({ ...prev, templates: 1 }));
    }, [templatesSearchFromUrl]);

    const setTemplatesFilter = useCallback((value: string) => {
        setTemplatesFilterState({ value, touched: true, source: templatesFilterFromUrl });
        setListSizes((prev) => ({ ...prev, templates: 1 }));
    }, [templatesFilterFromUrl]);

    const setInvitationsSearch = useCallback((value: string) => {
        setInvitationsSearchState({ value, touched: true, source: activeInvitationsSearchFromUrl });
    }, [activeInvitationsSearchFromUrl]);

    const setInvitationsFilter = useCallback((value: string) => {
        setInvitationsFilterState({ value, touched: true, source: activeInvitationsFilterFromUrl });
    }, [activeInvitationsFilterFromUrl]);

    const setScrollPosition = useCallback((path: string, y: number) => {
        setScrollPositions((prev) => ({ ...prev, [path]: y }));
    }, []);

    const setListSize = useCallback((listKey: string, size: number) => {
        setListSizes((prev) => ({ ...prev, [listKey]: size }));
    }, []);

    return (
        <UrlQuerySyncContext.Provider value={syncUrlQueries}>
            <NavigationStateContext.Provider
                value={{
                    templatesSearch,
                    setTemplatesSearch,
                    templatesFilter,
                    setTemplatesFilter,
                    invitationsSearch,
                    setInvitationsSearch,
                    invitationsFilter,
                    setInvitationsFilter,
                    scrollPositions,
                    setScrollPosition,
                    listSizes: effectiveListSizes,
                    setListSize,
                }}
            >
                {children}
            </NavigationStateContext.Provider>
        </UrlQuerySyncContext.Provider>
    );
}

function UrlQueryListener() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const syncUrlQueries = useContext(UrlQuerySyncContext);

    const templatesSearchFromUrl = pathname === "/" ? searchParams.get("search") : null;
    const templatesFilterFromUrl = pathname === "/" ? searchParams.get("category") : null;
    const invitationsSearchFromUrl = pathname === "/invitations" ? searchParams.get("search") : null;
    const invitationsFilterFromUrl = pathname === "/invitations" ? searchParams.get("status") : null;
    const resetFromUrl = pathname === "/invitations" ? searchParams.get("reset") : null;

    useEffect(() => {
        syncUrlQueries?.({
            templatesSearchFromUrl,
            templatesFilterFromUrl,
            invitationsSearchFromUrl,
            invitationsFilterFromUrl,
            resetFromUrl,
        });
    }, [templatesSearchFromUrl, templatesFilterFromUrl, invitationsSearchFromUrl, invitationsFilterFromUrl, resetFromUrl, syncUrlQueries]);

    return null;
}

export function useNavigationState() {
    const context = useContext(NavigationStateContext);
    if (!context) {
        throw new Error("useNavigationState must be used within NavigationStateProvider");
    }
    return context;
}

export function useScrollPreservation(pageKey: string) {
    const { scrollPositions, setScrollPosition } = useNavigationState();

    useEffect(() => {
        const savedY = scrollPositions[pageKey];
        if (savedY !== undefined) {
            // Restore scroll position after a slight delay for component mounting/rendering
            const timeout = setTimeout(() => {
                window.scrollTo({ top: savedY, behavior: "instant" as ScrollBehavior });
            }, 80);
            return () => clearTimeout(timeout);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageKey]);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        const handleScroll = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                setScrollPosition(pageKey, window.scrollY);
            }, 100); // Debounce scroll tracking to prevent excessive state updates
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", handleScroll);
            clearTimeout(timeoutId);
        };
    }, [pageKey, setScrollPosition]);
}
