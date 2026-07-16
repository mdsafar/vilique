"use client";

import { CSSProperties, ReactNode, useLayoutEffect, useRef, useState } from "react";
import { InvitationCategory } from "@/types/invitation";
import { createDefaultInvitation } from "@/lib/defaultInvitation";
import PastelFloralWedding from "@/components/templates/PastelFloralWedding";

type Props = {
    template: {
        id: string;
        name: string;
        category: InvitationCategory;
        gradient: string;
        mood: string;
        previewSections: string[];
    };
    categoryLabel: string;
};

export default function TemplateDetailPreview({ template, categoryLabel }: Props) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [activePreview, setActivePreview] = useState(0);
    const [invitation] = useState(() => ({
        ...createDefaultInvitation(),
        templateId: template.id,
        title: template.name,
        eventDate: getNextYearDateInputValue(),
    }));

    if (template.id !== "pastel-floral-wedding") {
        return (
            <div
                className="templateDetailPreview"
                style={{ background: template.gradient }}
            >
                <div className="detailPhoneChrome">
                    <span />
                </div>
                <div className="templatePreviewGlass detailPreviewGlass">
                    <small>{categoryLabel}</small>
                    <span>{template.name}</span>
                    <p>{template.mood}</p>
                </div>
                <div className="detailPreviewStack" aria-hidden="true">
                    {template.previewSections.map((section) => (
                        <i key={section}>{section}</i>
                    ))}
                </div>
            </div>
        );
    }

    function handleTrackScroll() {
        const track = trackRef.current;
        if (!track) return;

        const phones = Array.from(track.querySelectorAll<HTMLElement>(".templatePreviewPhone"));
        const trackCenter = track.scrollLeft + track.clientWidth / 2;
        const nearestIndex = phones.reduce((nearest, phone, index) => {
            const phoneCenter = phone.offsetLeft + phone.offsetWidth / 2;
            const nearestPhone = phones[nearest];
            const nearestCenter = nearestPhone.offsetLeft + nearestPhone.offsetWidth / 2;

            return Math.abs(phoneCenter - trackCenter) < Math.abs(nearestCenter - trackCenter)
                ? index
                : nearest;
        }, 0);

        setActivePreview(nearestIndex);
    }

    function scrollToPreview(index: number) {
        const track = trackRef.current;
        const phone = track?.querySelectorAll<HTMLElement>(".templatePreviewPhone")[index];
        if (!phone) return;

        track.scrollTo({
            behavior: "smooth",
            left: phone.offsetLeft - (track.clientWidth - phone.offsetWidth) / 2,
        });
        setActivePreview(index);
    }

    return (
        <div
            className="templateDetailPreview templateLivePreview"
            style={{ background: template.gradient }}
        >
            <div
                className="templatePreviewTrack"
                onScroll={handleTrackScroll}
                ref={trackRef}
            >
                <TemplatePreviewState label={categoryLabel} state="Invite">
                    <PastelFloralWedding invitation={invitation} />
                </TemplatePreviewState>
                <TemplatePreviewState label={categoryLabel} state="Thanks">
                    <PastelFloralWedding invitation={invitation} accepted />
                </TemplatePreviewState>
            </div>
            <div className="templatePreviewDots" aria-label="Template preview screens">
                {["Invite", "Thanks"].map((label, index) => (
                    <button
                        aria-label={`Show ${label} preview`}
                        aria-pressed={activePreview === index}
                        className={activePreview === index ? "active" : ""}
                        key={label}
                        onClick={() => scrollToPreview(index)}
                        type="button"
                    >
                        <span />
                    </button>
                ))}
            </div>
        </div>
    );
}

function getNextYearDateInputValue() {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function TemplatePreviewState({
    children,
    label,
    state,
}: {
    children: ReactNode;
    label: string;
    state: "Invite" | "Thanks";
}) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [hasMoreToScroll, setHasMoreToScroll] = useState(false);
    const [previewSize, setPreviewSize] = useState({
        height: 748,
        scale: 1,
    });

    useLayoutEffect(() => {
        const viewportElement = viewportRef.current;
        const canvasElement = canvasRef.current;
        if (!viewportElement || !canvasElement) return;
        const viewportNode = viewportElement;
        const canvasNode = canvasElement;

        function syncPreviewSize() {
            const viewportWidth = viewportNode.clientWidth;
            const canvasWidth = 390;
            const scale = Math.min(1, viewportWidth / canvasWidth);
            const height = Math.ceil(canvasNode.scrollHeight * scale);

            setPreviewSize({ height, scale });
            syncScrollCue();
        }

        function syncScrollCue() {
            const scrollRemaining = viewportNode.scrollHeight - viewportNode.clientHeight - viewportNode.scrollTop;

            setHasMoreToScroll(scrollRemaining > 2);
        }

        syncPreviewSize();
        syncScrollCue();

        const resizeObserver = new ResizeObserver(syncPreviewSize);
        resizeObserver.observe(viewportNode);
        resizeObserver.observe(canvasNode);

        viewportNode.addEventListener("scroll", syncScrollCue);
        window.addEventListener("resize", syncPreviewSize);

        return () => {
            resizeObserver.disconnect();
            viewportNode.removeEventListener("scroll", syncScrollCue);
            window.removeEventListener("resize", syncPreviewSize);
        };
    }, []);

    return (
        <div className="templatePreviewColumn">
            <div className="templatePreviewPhoneHeader">
                {state === "Invite" ? "Invitation" : "Thank You"}
            </div>

            <article
                aria-label={label}
                className={`templatePreviewPhone${hasMoreToScroll ? " hasScrollCue" : ""}`}
            >
                <div
                    className="templatePreviewViewport"
                    ref={viewportRef}
                    style={{ "--template-scaled-height": `${previewSize.height}px` } as CSSProperties}
                >
                    <div
                        className="templatePreviewCanvas"
                        ref={canvasRef}
                        style={{ "--template-scale": String(previewSize.scale) } as CSSProperties}
                    >
                        {children}
                    </div>
                </div>
                <span className="templatePreviewScrollCue" aria-hidden="true" />
            </article>
        </div>
    );
}
