"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    isLoading?: boolean;
    loadingLabel?: string;
    icon?: ReactNode;
};

export default function LoadingButton({
    children,
    isLoading = false,
    loadingLabel = "Loading...",
    icon,
    disabled,
    className = "",
    ...props
}: LoadingButtonProps) {
    return (
        <button
            {...props}
            className={`loadingButton ${className}`}
            disabled={disabled || isLoading}
            aria-busy={isLoading}
        >
            {isLoading ? <Loader2 className="spinner" size={16} aria-hidden="true" /> : icon}
            <span>{isLoading ? loadingLabel : children}</span>
        </button>
    );
}
