"use client";

import React, { createContext, useContext, useState, useEffect, useSyncExternalStore } from "react";

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
};

const NavigationStateContext = createContext<NavigationState | undefined>(undefined);

export function NavigationStateProvider({ children }: { children: React.ReactNode }) {
    const templatesSearchFromUrl = useUrlQueryValue("/templates", "search");
    const templatesFilterFromUrl = useUrlQueryValue("/templates", "category");
    const invitationsSearchFromUrl = useUrlQueryValue("/invitations", "search");
    const invitationsFilterFromUrl = useUrlQueryValue("/invitations", "status");
    const [templatesSearchState, setTemplatesSearchState] = useState("");
    const [templatesFilterState, setTemplatesFilterState] = useState("all");
    const [invitationsSearchState, setInvitationsSearchState] = useState("");
    const [invitationsFilterState, setInvitationsFilterState] = useState("all");
    const [templatesSearchTouched, setTemplatesSearchTouched] = useState(false);
    const [templatesFilterTouched, setTemplatesFilterTouched] = useState(false);
    const [invitationsSearchTouched, setInvitationsSearchTouched] = useState(false);
    const [invitationsFilterTouched, setInvitationsFilterTouched] = useState(false);
    const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
    const templatesSearch = templatesSearchTouched ? templatesSearchState : templatesSearchFromUrl ?? templatesSearchState;
    const templatesFilter = templatesFilterTouched ? templatesFilterState : templatesFilterFromUrl ?? templatesFilterState;
    const invitationsSearch = invitationsSearchTouched ? invitationsSearchState : invitationsSearchFromUrl ?? invitationsSearchState;
    const invitationsFilter = invitationsFilterTouched ? invitationsFilterState : invitationsFilterFromUrl ?? invitationsFilterState;

    const setTemplatesSearch = (value: string) => {
        setTemplatesSearchTouched(true);
        setTemplatesSearchState(value);
    };

    const setTemplatesFilter = (value: string) => {
        setTemplatesFilterTouched(true);
        setTemplatesFilterState(value);
    };

    const setInvitationsSearch = (value: string) => {
        setInvitationsSearchTouched(true);
        setInvitationsSearchState(value);
    };

    const setInvitationsFilter = (value: string) => {
        setInvitationsFilterTouched(true);
        setInvitationsFilterState(value);
    };

    const setScrollPosition = (path: string, y: number) => {
        setScrollPositions((prev) => ({ ...prev, [path]: y }));
    };

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
    }, [pageKey, scrollPositions]);

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
