"use client";

import { RefObject, useEffect, useMemo, useState, type CSSProperties } from "react";

type ElementSnapshot = {
    label: string;
    top: number;
    bottom: number;
    height: number;
    offsetTop: number | null;
    marginTop: string;
    paddingTop: string;
    transform: string;
    translate: string;
    position: string;
    topStyle: string;
    overflow: string;
    overflowY: string;
    heightStyle: string;
    minHeight: string;
    animationName: string;
    animationPlayState: string;
    alignItems: string;
    justifyContent: string;
    placeContent: string;
};

type Snapshot = {
    id: number;
    stage: string;
    time: string;
    view: string;
    scrollY: number;
    htmlTop: number;
    bodyTop: number;
    inviteRootTop: number | null;
    thanksRoot: ElementSnapshot | null;
    contentWrapper: ElementSnapshot | null;
    firstHeading: ElementSnapshot | null;
    firstDecor: ElementSnapshot | null;
    headingAncestors: ElementSnapshot[];
    negativeChildren: ElementSnapshot[];
    inviteScreenMounted: boolean;
};

type DebugApi = {
    record: (stage: string) => void;
    setThanksRoot: (element: HTMLElement | null, stage?: string) => void;
};

type Props = {
    enabled: boolean;
    invitationRootRef: RefObject<HTMLElement | null>;
    currentView: string;
};

declare global {
    interface Window {
        __viliqueScrollDebug?: DebugApi;
    }
}

const MAX_SNAPSHOTS = 40;

export default function ScrollDebugPanel({ enabled, invitationRootRef, currentView }: Props) {
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

    useEffect(() => {
        if (!enabled) return;

        let id = 0;
        let thanksRoot: HTMLElement | null = null;

        function capture(stage: string) {
            const snapshot = createSnapshot(++id, stage, currentView, invitationRootRef.current, thanksRoot);
            setSnapshots((items) => [snapshot, ...items].slice(0, MAX_SNAPSHOTS));
        }

        window.__viliqueScrollDebug = {
            record: capture,
            setThanksRoot: (element, stage = "Thanks root changed") => {
                thanksRoot = element;
                capture(stage);
            },
        };

        capture("Debug panel mounted");

        return () => {
            if (window.__viliqueScrollDebug?.record === capture) {
                delete window.__viliqueScrollDebug;
            }
        };
    }, [currentView, enabled, invitationRootRef]);

    useEffect(() => {
        if (enabled) {
            window.__viliqueScrollDebug?.record(`View changed: ${currentView}`);
        }
    }, [currentView, enabled]);

    const latest = snapshots[0];
    const rows = useMemo(() => snapshots.slice(0, 18), [snapshots]);

    if (!enabled) return null;

    return (
        <aside style={panelStyle} aria-label="Scroll diagnostics">
            <div style={headerStyle}>Scroll Debug</div>
            <div style={gridStyle}>
                <DebugValue label="view" value={currentView} />
                <DebugValue label="stage" value={latest?.stage || "-"} />
                <DebugValue label="time" value={latest?.time || "-"} />
                <DebugValue label="scrollY/html/body" value={`${latest?.scrollY ?? "-"} / ${latest?.htmlTop ?? "-"} / ${latest?.bodyTop ?? "-"}`} />
                <DebugValue label="invite root top" value={formatNumber(latest?.inviteRootTop)} />
                <DebugValue label="thanks root top" value={formatNumber(latest?.thanksRoot?.top)} />
                <DebugValue label="heading top" value={formatNumber(latest?.firstHeading?.top)} />
                <DebugValue label="invite mounted" value={String(latest?.inviteScreenMounted ?? false)} />
            </div>
            <DebugBlock title="Thanks Root" value={formatElement(latest?.thanksRoot)} />
            <DebugBlock title="Content Wrapper" value={formatElement(latest?.contentWrapper)} />
            <DebugBlock title="First Heading" value={formatElement(latest?.firstHeading)} />
            <DebugBlock title="First Decor" value={formatElement(latest?.firstDecor)} />
            <DebugBlock
                title="Heading Ancestors"
                value={latest?.headingAncestors.map(formatElement).join("\n") || "-"}
            />
            <DebugBlock
                title="Negative Children"
                value={latest?.negativeChildren.map(formatElement).join("\n") || "-"}
            />
            <DebugBlock
                title="Timeline"
                value={rows.map((item) =>
                    `#${item.id} ${item.time} ${item.stage} root=${formatNumber(item.thanksRoot?.top)} heading=${formatNumber(item.firstHeading?.top)}`
                ).join("\n")}
            />
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

function DebugBlock({ title, value }: { title: string; value: string }) {
    return (
        <>
            <div style={sectionTitleStyle}>{title}</div>
            <pre style={preStyle}>{value}</pre>
        </>
    );
}

function createSnapshot(
    id: number,
    stage: string,
    view: string,
    invitationRoot: HTMLElement | null,
    trackedThanksRoot: HTMLElement | null
): Snapshot {
    const thanksRoot = trackedThanksRoot && document.documentElement.contains(trackedThanksRoot)
        ? trackedThanksRoot
        : document.querySelector<HTMLElement>(".thanksCard");
    const firstHeading = thanksRoot?.querySelector<HTMLElement>(".thanksTitle") || null;
    const contentWrapper = thanksRoot?.querySelector<HTMLElement>(".thanksBox") || null;
    const firstDecor = thanksRoot?.querySelector<HTMLElement>(".floral, .cornerHeart, .goldLine") || null;

    return {
        id,
        stage,
        time: formatTime(),
        view,
        scrollY: Math.round(window.scrollY),
        htmlTop: Math.round(document.documentElement.scrollTop),
        bodyTop: Math.round(document.body.scrollTop),
        inviteRootTop: readTop(invitationRoot),
        thanksRoot: readElement(thanksRoot),
        contentWrapper: readElement(contentWrapper),
        firstHeading: readElement(firstHeading),
        firstDecor: readElement(firstDecor),
        headingAncestors: getAncestorsBetween(firstHeading, thanksRoot).map(readElement).filter(Boolean) as ElementSnapshot[],
        negativeChildren: getNegativeChildren(thanksRoot),
        inviteScreenMounted: Boolean(document.querySelector(".inviteScreen")),
    };
}

function getAncestorsBetween(child: HTMLElement | null, root: HTMLElement | null) {
    const ancestors: HTMLElement[] = [];
    let current = child?.parentElement || null;
    while (current && current !== root) {
        ancestors.push(current);
        current = current.parentElement;
    }
    if (root) ancestors.push(root);
    return ancestors;
}

function getNegativeChildren(root: HTMLElement | null) {
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>("*"))
        .map(readElement)
        .filter((item): item is ElementSnapshot => Boolean(item))
        .filter((item) => item.marginTop.startsWith("-") || /matrix|translate/.test(item.transform) && item.transform.includes("-"));
}

function readElement(element: HTMLElement | null | undefined): ElementSnapshot | null {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
        label: describeElement(element),
        top: round(rect.top),
        bottom: round(rect.bottom),
        height: round(rect.height),
        offsetTop: Number.isFinite(element.offsetTop) ? element.offsetTop : null,
        marginTop: style.marginTop,
        paddingTop: style.paddingTop,
        transform: style.transform,
        translate: style.translate,
        position: style.position,
        topStyle: style.top,
        overflow: style.overflow,
        overflowY: style.overflowY,
        heightStyle: style.height,
        minHeight: style.minHeight,
        animationName: style.animationName,
        animationPlayState: style.animationPlayState,
        alignItems: style.alignItems,
        justifyContent: style.justifyContent,
        placeContent: style.placeContent,
    };
}

function readTop(element: HTMLElement | null) {
    return element ? round(element.getBoundingClientRect().top) : null;
}

function describeElement(element: HTMLElement) {
    const classes = element.className ? `.${String(element.className).trim().split(/\s+/).slice(0, 3).join(".")}` : "";
    return `${element.tagName.toLowerCase()}${classes}`;
}

function formatElement(item: ElementSnapshot | null | undefined) {
    if (!item) return "-";
    return `${item.label} top=${item.top} bottom=${item.bottom} h=${item.height} offsetTop=${formatNumber(item.offsetTop)} marginTop=${item.marginTop} paddingTop=${item.paddingTop} transform=${item.transform} translate=${item.translate} position=${item.position} topStyle=${item.topStyle} overflow=${item.overflow} overflowY=${item.overflowY} height=${item.heightStyle} minHeight=${item.minHeight} animation=${item.animationName}/${item.animationPlayState} align=${item.alignItems} justify=${item.justifyContent} place=${item.placeContent}`;
}

function formatNumber(value: number | null | undefined) {
    return typeof value === "number" ? String(value) : "-";
}

function formatTime() {
    const now = new Date();
    return now.toLocaleTimeString("en-US", { hour12: false }) + `.${String(now.getMilliseconds()).padStart(3, "0")}`;
}

function round(value: number) {
    return Math.round(value * 10) / 10;
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
