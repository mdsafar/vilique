"use client";

import { RefObject, useEffect, useMemo, useState, type CSSProperties } from "react";

export type ScrollDebugStage =
    | "Before tapping Accept"
    | "Immediately when Accept is tapped"
    | "When the sparkle animation completes"
    | "Before Thanks content mounts"
    | "Immediately after Thanks content mounts"
    | "After the first scroll-reset call"
    | "One animation frame later"
    | "Two animation frames later"
    | "250ms later"
    | "1000ms later";

type ScrollDebugSnapshot = {
    id: number;
    stage: string;
    source: string;
    timestamp: string;
    timeMs: number;
    view: string;
    windowScrollY: number | null;
    pageYOffset: number | null;
    scrollingElementScrollTop: number | null;
    scrollingElementLabel: string;
    documentElementScrollTop: number | null;
    bodyScrollTop: number | null;
    invitationRootScrollTop: number | null;
    activeElement: string;
    ancestors: Array<{
        label: string;
        scrollTop: number;
        scrollHeight: number;
        clientHeight: number;
        overflowY: string;
    }>;
};

type ScrollDebugApi = {
    record: (stage: string, source?: string) => void;
    setView: (view: string, source?: string) => void;
};

type Props = {
    enabled: boolean;
    invitationRootRef: RefObject<HTMLElement | null>;
    currentView: string;
};

declare global {
    interface Window {
        __viliqueScrollDebug?: ScrollDebugApi;
        _logState?: (label: string) => void;
    }
}

const MAX_SNAPSHOTS = 80;

export default function ScrollDebugPanel({ enabled, invitationRootRef, currentView }: Props) {
    const [snapshots, setSnapshots] = useState<ScrollDebugSnapshot[]>([]);

    useEffect(() => {
        if (enabled) {
            window.__viliqueScrollDebug?.record(`RSVP view changed: ${currentView}`, "PublicInviteExperience");
        }
    }, [currentView, enabled]);

    useEffect(() => {
        if (!enabled) return;

        let snapshotId = 0;
        let currentDebugView = currentView;
        const originals = installScrollInstrumentation((stage, source) => {
            record(stage, source);
        });

        function record(stage: string, source = "debug") {
            const snapshot = createSnapshot(
                ++snapshotId,
                stage,
                source,
                currentDebugView,
                invitationRootRef.current
            );
            setSnapshots((items) => [snapshot, ...items].slice(0, MAX_SNAPSHOTS));
        }

        window.__viliqueScrollDebug = {
            record,
            setView: (nextView, source = "debug") => {
                currentDebugView = nextView;
                record(`RSVP view changed: ${nextView}`, source);
            },
        };
        window._logState = (label: string) => record(label, "legacy _logState");

        record("Debug panel mounted", "ScrollDebugPanel");
        const onScroll = () => record("scroll event", "window");
        const onFocusIn = () => record("focusin", "document");
        const onFocusOut = () => record("focusout", "document");
        window.addEventListener("scroll", onScroll, { passive: true });
        document.addEventListener("focusin", onFocusIn);
        document.addEventListener("focusout", onFocusOut);

        return () => {
            window.removeEventListener("scroll", onScroll);
            document.removeEventListener("focusin", onFocusIn);
            document.removeEventListener("focusout", onFocusOut);
            restoreScrollInstrumentation(originals);
            if (window.__viliqueScrollDebug?.record === record) {
                delete window.__viliqueScrollDebug;
            }
            if (window._logState) {
                delete window._logState;
            }
        };
    }, [currentView, enabled, invitationRootRef]);

    const latest = snapshots[0];
    const stageRows = useMemo(
        () => snapshots.filter((item) => item.stage !== "scroll event").slice(0, 28),
        [snapshots]
    );

    if (!enabled) return null;

    return (
        <aside style={panelStyle} aria-label="Scroll diagnostics">
            <div style={headerStyle}>Scroll Debug</div>
            <div style={gridStyle}>
                <DebugValue label="view" value={currentView} />
                <DebugValue label="time" value={latest?.timestamp || "-"} />
                <DebugValue label="source" value={latest?.source || "-"} />
                <DebugValue label="stage" value={latest?.stage || "-"} />
                <DebugValue label="window.scrollY" value={formatNumber(latest?.windowScrollY)} />
                <DebugValue label="window.pageYOffset" value={formatNumber(latest?.pageYOffset)} />
                <DebugValue label="scrollingElement" value={`${latest?.scrollingElementLabel || "-"} ${formatNumber(latest?.scrollingElementScrollTop)}`} />
                <DebugValue label="html.scrollTop" value={formatNumber(latest?.documentElementScrollTop)} />
                <DebugValue label="body.scrollTop" value={formatNumber(latest?.bodyScrollTop)} />
                <DebugValue label="invite root scrollTop" value={formatNumber(latest?.invitationRootScrollTop)} />
                <DebugValue label="activeElement" value={latest?.activeElement || "-"} />
            </div>
            <div style={sectionTitleStyle}>Scrollable Ancestors</div>
            <pre style={preStyle}>
                {(latest?.ancestors.length ? latest.ancestors : []).map((item) =>
                    `${item.label} top=${item.scrollTop} h=${item.scrollHeight}/${item.clientHeight} overflowY=${item.overflowY}`
                ).join("\n") || "-"}
            </pre>
            <div style={sectionTitleStyle}>Timeline</div>
            <pre style={preStyle}>
                {stageRows.map((item) =>
                    `#${item.id} ${item.timestamp} ${item.stage} [${item.source}] y=${formatNumber(item.windowScrollY)} se=${formatNumber(item.scrollingElementScrollTop)} html=${formatNumber(item.documentElementScrollTop)} body=${formatNumber(item.bodyScrollTop)} root=${formatNumber(item.invitationRootScrollTop)} active=${item.activeElement}`
                ).join("\n")}
            </pre>
        </aside>
    );
}

function DebugValue({ label, value }: { label: string; value: string }) {
    return (
        <>
            <span style={labelStyle}>{label}</span>
            <span style={valueStyle}>{value}</span>
        </>
    );
}

function createSnapshot(
    id: number,
    stage: string,
    source: string,
    view: string,
    invitationRoot: HTMLElement | null
): ScrollDebugSnapshot {
    const scrollingElement = document.scrollingElement;
    const now = new Date();

    return {
        id,
        stage,
        source,
        timestamp: now.toLocaleTimeString("en-US", { hour12: false }) + `.${String(now.getMilliseconds()).padStart(3, "0")}`,
        timeMs: performance.now(),
        view,
        windowScrollY: readNumber(() => window.scrollY),
        pageYOffset: readNumber(() => window.pageYOffset),
        scrollingElementScrollTop: readNumber(() => scrollingElement?.scrollTop),
        scrollingElementLabel: scrollingElement ? describeElement(scrollingElement) : "null",
        documentElementScrollTop: readNumber(() => document.documentElement.scrollTop),
        bodyScrollTop: readNumber(() => document.body.scrollTop),
        invitationRootScrollTop: readNumber(() => invitationRoot?.scrollTop),
        activeElement: describeElement(document.activeElement),
        ancestors: getScrollableAncestors(invitationRoot),
    };
}

function getScrollableAncestors(root: HTMLElement | null) {
    const ancestors: ScrollDebugSnapshot["ancestors"] = [];
    let current: HTMLElement | null = root;
    while (current) {
        const style = window.getComputedStyle(current);
        if (
            current.scrollHeight > current.clientHeight ||
            current.scrollTop !== 0 ||
            /(auto|scroll|overlay|hidden)/.test(style.overflowY)
        ) {
            ancestors.push({
                label: describeElement(current),
                scrollTop: current.scrollTop,
                scrollHeight: current.scrollHeight,
                clientHeight: current.clientHeight,
                overflowY: style.overflowY,
            });
        }
        current = current.parentElement;
    }
    return ancestors;
}

function installScrollInstrumentation(record: (stage: string, source: string) => void) {
    const originals = {
        windowScrollTo: window.scrollTo,
        elementScrollTo: Element.prototype.scrollTo,
        scrollIntoView: Element.prototype.scrollIntoView,
        focus: HTMLElement.prototype.focus,
        blur: HTMLElement.prototype.blur,
        elementScrollTop: Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop"),
        htmlElementScrollTop: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTop"),
    };

    const debugWindowScrollTo = function debugWindowScrollTo(this: Window, ...args: unknown[]) {
        record(`window.scrollTo(${summarizeArgs(args)}) before`, "instrumentation");
        const result = (originals.windowScrollTo as (...scrollArgs: unknown[]) => void).apply(this, args);
        record(`window.scrollTo(${summarizeArgs(args)}) after`, "instrumentation");
        return result;
    } as typeof window.scrollTo;
    window.scrollTo = debugWindowScrollTo;
    const debugElementScrollTo = function debugElementScrollTo(this: Element, ...args: unknown[]) {
        record(`${describeElement(this)}.scrollTo(${summarizeArgs(args)}) before`, "instrumentation");
        const result = (originals.elementScrollTo as (...scrollArgs: unknown[]) => void).apply(this, args);
        record(`${describeElement(this)}.scrollTo(${summarizeArgs(args)}) after`, "instrumentation");
        return result;
    } as Element["scrollTo"];
    Element.prototype.scrollTo = debugElementScrollTo;
    Element.prototype.scrollIntoView = function debugScrollIntoView(...args: Parameters<Element["scrollIntoView"]>) {
        record(`${describeElement(this)}.scrollIntoView(${summarizeArgs(args)}) before`, "instrumentation");
        const result = originals.scrollIntoView.apply(this, args);
        record(`${describeElement(this)}.scrollIntoView(${summarizeArgs(args)}) after`, "instrumentation");
        return result;
    };
    HTMLElement.prototype.focus = function debugFocus(...args: Parameters<HTMLElement["focus"]>) {
        record(`${describeElement(this)}.focus(${summarizeArgs(args)}) before`, "instrumentation");
        const result = originals.focus.apply(this, args);
        record(`${describeElement(this)}.focus(${summarizeArgs(args)}) after`, "instrumentation");
        return result;
    };
    HTMLElement.prototype.blur = function debugBlur(...args: Parameters<HTMLElement["blur"]>) {
        record(`${describeElement(this)}.blur(${summarizeArgs(args)}) before`, "instrumentation");
        const result = originals.blur.apply(this, args);
        record(`${describeElement(this)}.blur(${summarizeArgs(args)}) after`, "instrumentation");
        return result;
    };

    patchScrollTopSetter(Element.prototype, originals.elementScrollTop, record);
    patchScrollTopSetter(HTMLElement.prototype, originals.htmlElementScrollTop, record);

    if ("scrollRestoration" in window.history) {
        record(`history.scrollRestoration=${window.history.scrollRestoration}`, "instrumentation");
    }

    return originals;
}

function patchScrollTopSetter(
    target: Element | HTMLElement,
    descriptor: PropertyDescriptor | undefined,
    record: (stage: string, source: string) => void
) {
    if (!descriptor?.get || !descriptor?.set || !descriptor.configurable) return;
    Object.defineProperty(target, "scrollTop", {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
            return descriptor.get?.call(this);
        },
        set(value) {
            record(`${describeElement(this as Element)}.scrollTop=${String(value)} before`, "instrumentation");
            descriptor.set?.call(this, value);
            record(`${describeElement(this as Element)}.scrollTop=${String(value)} after`, "instrumentation");
        },
    });
}

function restoreScrollInstrumentation(originals: ReturnType<typeof installScrollInstrumentation>) {
    window.scrollTo = originals.windowScrollTo;
    Element.prototype.scrollTo = originals.elementScrollTo;
    Element.prototype.scrollIntoView = originals.scrollIntoView;
    HTMLElement.prototype.focus = originals.focus;
    HTMLElement.prototype.blur = originals.blur;
    restoreDescriptor(Element.prototype, "scrollTop", originals.elementScrollTop);
    restoreDescriptor(HTMLElement.prototype, "scrollTop", originals.htmlElementScrollTop);
}

function restoreDescriptor(target: Element | HTMLElement, key: string, descriptor: PropertyDescriptor | undefined) {
    if (descriptor) {
        Object.defineProperty(target, key, descriptor);
    }
}

function describeElement(element: Element | null | undefined) {
    if (!element) return "null";
    const id = element.id ? `#${element.id}` : "";
    const classes = element instanceof HTMLElement && element.className
        ? `.${String(element.className).trim().split(/\s+/).slice(0, 3).join(".")}`
        : "";
    return `${element.tagName.toLowerCase()}${id}${classes}`;
}

function summarizeArgs(args: unknown[]) {
    return args.map((arg) => {
        if (typeof arg === "number" || typeof arg === "string" || typeof arg === "boolean") return String(arg);
        if (arg && typeof arg === "object") {
            try {
                return JSON.stringify(arg);
            } catch {
                return "[object]";
            }
        }
        return String(arg);
    }).join(", ");
}

function readNumber(read: () => number | undefined) {
    const value = read();
    return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function formatNumber(value: number | null | undefined) {
    return typeof value === "number" ? String(value) : "-";
}

const panelStyle = {
    position: "fixed",
    inset: "8px 8px auto 8px",
    zIndex: 2147483647,
    maxHeight: "58vh",
    overflow: "auto",
    WebkitOverflowScrolling: "touch",
    padding: "10px",
    border: "2px solid #111827",
    borderRadius: "6px",
    background: "rgba(255, 255, 255, 0.96)",
    color: "#111827",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "11px",
    lineHeight: 1.35,
    boxShadow: "0 8px 26px rgba(0, 0, 0, 0.22)",
} satisfies CSSProperties;

const headerStyle = {
    fontWeight: 800,
    fontSize: "13px",
    marginBottom: "6px",
} satisfies CSSProperties;

const gridStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(120px, 44%) 1fr",
    gap: "2px 8px",
} satisfies CSSProperties;

const labelStyle = {
    color: "#4b5563",
    overflowWrap: "anywhere",
} satisfies CSSProperties;

const valueStyle = {
    fontWeight: 700,
    overflowWrap: "anywhere",
} satisfies CSSProperties;

const sectionTitleStyle = {
    marginTop: "8px",
    marginBottom: "2px",
    fontWeight: 800,
} satisfies CSSProperties;

const preStyle = {
    margin: 0,
    maxHeight: "120px",
    overflow: "auto",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
} satisfies CSSProperties;
