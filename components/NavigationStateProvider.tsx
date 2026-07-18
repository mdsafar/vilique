"use client";

import React, { createContext, useContext, useState, useEffect, useSyncExternalStore, useCallback } from "react";

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

const NavigationStateContext = createContext<NavigationState | undefined>(undefined);

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
    const templatesSearchFromUrl = useUrlQueryValue("/", "search");
    const templatesFilterFromUrl = useUrlQueryValue("/", "category");
    const invitationsSearchFromUrl = useUrlQueryValue("/invitations", "search");
    const invitationsFilterFromUrl = useUrlQueryValue("/invitations", "status");
    const resetFromUrl = useUrlQueryValue("/invitations", "reset");
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
        setListSizes((prev) => ({ ...prev, invitations: 1 }));
    }, [activeInvitationsSearchFromUrl]);

    const setInvitationsFilter = useCallback((value: string) => {
        setInvitationsFilterState({ value, touched: true, source: activeInvitationsFilterFromUrl });
        setListSizes((prev) => ({ ...prev, invitations: 1 }));
    }, [activeInvitationsFilterFromUrl]);

    const setScrollPosition = useCallback((path: string, y: number) => {
        setScrollPositions((prev) => ({ ...prev, [path]: y }));
    }, []);

    const setListSize = useCallback((listKey: string, size: number) => {
        setListSizes((prev) => ({ ...prev, [listKey]: size }));
    }, []);

    return (
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
    );
}

function useUrlQueryValue(pathname: string, key: string) {
    return useSyncExternalStore(
        subscribeToLocationChanges,
        () => getUrlQueryValue(pathname, key),
        () => null
    );
}

function subscribeToLocationChanges(onStoreChange: () => void) {
    window.addEventListener("popstate", onStoreChange);
    return () => window.removeEventListener("popstate", onStoreChange);
}

function getUrlQueryValue(pathname: string, key: string) {
    if (typeof window === "undefined" || window.location.pathname !== pathname) return null;
    return new URLSearchParams(window.location.search).get(key);
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
