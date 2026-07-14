"use client";

import Link from "next/link";
import { AlertTriangle, FileQuestion, SearchX, Sparkles } from "lucide-react";

type ListStateVariant = "empty" | "filtered" | "error" | "notFound";

type ListStateProps = {
    title: string;
    description: string;
    actionLabel?: string;
    href?: string;
    onAction?: () => void;
    secondaryActionLabel?: string;
    secondaryHref?: string;
    secondaryOnAction?: () => void;
    details?: string[];
    variant?: ListStateVariant;
    className?: string;
};

const iconByVariant = {
    empty: Sparkles,
    filtered: SearchX,
    error: AlertTriangle,
    notFound: FileQuestion,
};

export default function ListState({
    title,
    description,
    actionLabel,
    href,
    onAction,
    secondaryActionLabel,
    secondaryHref,
    secondaryOnAction,
    details = [],
    variant = "empty",
    className = "",
}: ListStateProps) {
    const Icon = iconByVariant[variant];
    const primaryAction = actionLabel && (href || onAction) ? (
        href ? (
            <Link className="listStateAction" href={href}>
                {actionLabel}
            </Link>
        ) : (
            <button className="listStateAction" type="button" onClick={onAction}>
                {actionLabel}
            </button>
        )
    ) : null;
    const secondaryAction = secondaryActionLabel && (secondaryHref || secondaryOnAction) ? (
        secondaryHref ? (
            <Link className="listStateAction listStateAction--secondary" href={secondaryHref}>
                {secondaryActionLabel}
            </Link>
        ) : (
            <button className="listStateAction listStateAction--secondary" type="button" onClick={secondaryOnAction}>
                {secondaryActionLabel}
            </button>
        )
    ) : null;

    return (
        <section className={`listState listState--${variant} ${className}`.trim()}>
            <span className="listStateIcon" aria-hidden="true">
                <Icon size={30} />
            </span>
            <h2>{title}</h2>
            <p>{description}</p>
            {details.length ? (
                <div className="listStateDetails" aria-label="Active context">
                    {details.map((detail) => (
                        <span key={detail}>{detail}</span>
                    ))}
                </div>
            ) : null}
            {primaryAction || secondaryAction ? (
                <div className="listStateActions">
                    {primaryAction}
                    {secondaryAction}
                </div>
            ) : null}
        </section>
    );
}
