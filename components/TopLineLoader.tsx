"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type LineLoaderContextType = {
    startLineLoader: () => void;
    finishLineLoader: () => void;
    isLoading: boolean;
};

const LineLoaderContext = createContext<LineLoaderContextType>({
    startLineLoader: () => {},
    finishLineLoader: () => {},
    isLoading: false,
});

export function useLineLoader() {
    return useContext(LineLoaderContext);
}

function LineLoaderRouteObserver({ onRouteChange }: { onRouteChange: () => void }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isMounted = useRef(false);

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }
        onRouteChange();
    }, [pathname, searchParams, onRouteChange]);

    return null;
}

export function LineLoaderProvider({ children }: { children: React.ReactNode }) {
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const startLineLoader = useCallback(() => {
        if (finishTimerRef.current) {
            clearTimeout(finishTimerRef.current);
            finishTimerRef.current = null;
        }
        setIsLoading(true);
        setProgress((prev) => (prev > 0 && prev < 90 ? prev : 18));
    }, []);

    const finishLineLoader = useCallback(() => {
        if (finishTimerRef.current) {
            clearTimeout(finishTimerRef.current);
        }
        setProgress(100);
        finishTimerRef.current = setTimeout(() => {
            setIsLoading(false);
            setProgress(0);
            finishTimerRef.current = null;
        }, 320);
    }, []);

    // Animate progress incrementally while loading
    useEffect(() => {
        if (!isLoading) return;

        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 92) return prev;
                const diff = (100 - prev) * 0.16;
                return Math.min(92, prev + diff);
            });
        }, 120);

        return () => clearInterval(interval);
    }, [isLoading]);

    return (
        <LineLoaderContext.Provider value={{ startLineLoader, finishLineLoader, isLoading }}>
            <Suspense fallback={null}>
                <LineLoaderRouteObserver onRouteChange={finishLineLoader} />
            </Suspense>

            {isLoading && (
                <div
                    className="topLineLoaderWrapper"
                    aria-hidden="true"
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "3px",
                        zIndex: 999999,
                        pointerEvents: "none",
                        overflow: "hidden",
                        background: "rgba(140, 76, 243, 0.12)",
                    }}
                >
                    <div
                        className="topLineLoaderBar"
                        style={{
                            height: "100%",
                            width: `${progress}%`,
                            background: "linear-gradient(90deg, #8c4cf3 0%, #d946ef 50%, #c46fb4 100%)",
                            boxShadow: "0 0 10px rgba(140, 76, 243, 0.8), 0 0 5px rgba(217, 70, 239, 0.6)",
                            transition: progress === 100 ? "width 0.15s ease-out, opacity 0.25s ease-out" : "width 0.22s ease-out",
                            borderRadius: "0 2px 2px 0",
                        }}
                    />
                </div>
            )}
            {children}
        </LineLoaderContext.Provider>
    );
}
