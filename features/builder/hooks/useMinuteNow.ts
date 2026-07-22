"use client";

import { useEffect, useState } from "react";

export default function useMinuteNow(enabled: boolean) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        if (!enabled) return;

        const interval = window.setInterval(() => {
            setNow(new Date());
        }, 30_000);

        return () => {
            window.clearInterval(interval);
        };
    }, [enabled]);

    return now;
}