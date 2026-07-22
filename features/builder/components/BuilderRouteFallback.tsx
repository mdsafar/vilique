"use client";

import { useState } from "react";
import BuilderLoadingState from "@/features/builder/components/BuilderLoadingState";

type BuilderRouteFallbackProps = {
    storageKey: string;
    maxAgeMs: number;
};

function hasValidSession(storageKey: string, maxAgeMs: number): boolean {
    if (typeof window === "undefined") return false;
    try {
        const raw = sessionStorage.getItem(storageKey);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as { source?: unknown; createdAt?: unknown };
        const createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : 0;
        return parsed.source === "builder-session" && createdAt > 0 && Date.now() - createdAt <= maxAgeMs;
    } catch {
        return false;
    }
}

export default function BuilderRouteFallback({
    storageKey,
    maxAgeMs,
}: BuilderRouteFallbackProps) {
    const [isValidSession] = useState(() => hasValidSession(storageKey, maxAgeMs));

    if (isValidSession) {
        return <main className="builderShell" aria-busy="true" />;
    }

    return <BuilderLoadingState />;
}