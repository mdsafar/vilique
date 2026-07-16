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

const swrConfig = {
    fetcher,
    suspense: true,
    dedupingInterval: 10_000,
    keepPreviousData: true,
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
};

export function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <SWRConfig value={swrConfig}>
            <NavigationStateProvider>{children}</NavigationStateProvider>
        </SWRConfig>
    );
}
