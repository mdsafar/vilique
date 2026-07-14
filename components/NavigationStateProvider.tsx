"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

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
    const [templatesSearch, setTemplatesSearch] = useState(() => getInitialQueryValue("/templates", "search", ""));
    const [templatesFilter, setTemplatesFilter] = useState(() => getInitialQueryValue("/templates", "category", "all"));
    const [invitationsSearch, setInvitationsSearch] = useState(() => getInitialQueryValue("/invitations", "search", ""));
    const [invitationsFilter, setInvitationsFilter] = useState(() => getInitialQueryValue("/invitations", "status", "all"));
    const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});

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

function getInitialQueryValue(pathname: string, key: string, fallback: string) {
    if (typeof window === "undefined" || window.location.pathname !== pathname) return fallback;
    return new URLSearchParams(window.location.search).get(key) || fallback;
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
