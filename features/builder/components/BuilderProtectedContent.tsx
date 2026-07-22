"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";

type BuilderProtectedContentProps = {
    children: ReactNode;
};

export default function BuilderProtectedContent({
    children,
}: BuilderProtectedContentProps) {
    const searchParams = useSearchParams();

    const query = searchParams.toString();

    const currentBuilderPath = `/builder${query ? `?${query}` : ""
        }`;

    return (
        <ProtectedRoute
            next={currentBuilderPath}
            className="builderShell"
        >
            {children}
        </ProtectedRoute>
    );
}