"use client";

import { ReactNode, useEffect, useState } from "react";

type DelayedRouteSkeletonProps = {
    children: ReactNode;
    delayMs?: number;
};

export default function DelayedRouteSkeleton({
    children,
    delayMs = 220,
}: DelayedRouteSkeletonProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setVisible(true);
        }, delayMs);

        return () => window.clearTimeout(timeout);
    }, [delayMs]);

    if (!visible) return null;

    return children;
}
