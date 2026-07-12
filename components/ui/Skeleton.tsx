import type { CSSProperties } from "react";

type SkeletonProps = {
    className?: string;
    style?: CSSProperties;
    rounded?: "sm" | "md" | "lg" | "xl" | "full";
};

const roundedClass = {
    sm: "skeletonRoundedSm",
    md: "skeletonRoundedMd",
    lg: "skeletonRoundedLg",
    xl: "skeletonRoundedXl",
    full: "skeletonRoundedFull",
};

export function Skeleton({ className = "", style, rounded = "md" }: SkeletonProps) {
    return (
        <span
            aria-hidden="true"
            className={`skeletonBase ${roundedClass[rounded]} ${className}`}
            style={style}
        />
    );
}

export function TextSkeleton({
    width = "100%",
    height = 14,
    className = "",
}: {
    width?: CSSProperties["width"];
    height?: CSSProperties["height"];
    className?: string;
}) {
    return <Skeleton className={className} style={{ width, height }} rounded="sm" />;
}

export function ButtonSkeleton({
    width = 112,
    height = 44,
    className = "",
}: {
    width?: CSSProperties["width"];
    height?: CSSProperties["height"];
    className?: string;
}) {
    return <Skeleton className={className} style={{ width, height }} rounded="lg" />;
}
