"use client";

import React from "react";
import { SWRConfig } from "swr";
import { NavigationStateProvider } from "./NavigationStateProvider";

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        const error = new Error("An error occurred while fetching the data.") as Error & { status?: number; info?: unknown };
        error.status = res.status;
        error.info = await res.json().catch(() => ({}));
        throw error;
    }
    return res.json();
};

export function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <SWRConfig
            value={{
                fetcher,
                suspense: true,
                revalidateOnFocus: false, // Avoid refreshing data when switching browser tabs unless needed
                shouldRetryOnError: false, // Handle errors gracefully
            }}
        >
            <NavigationStateProvider>{children}</NavigationStateProvider>
        </SWRConfig>
    );
}
