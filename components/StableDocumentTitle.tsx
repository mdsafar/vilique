"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const titleByPath = [
    { test: (path: string) => path === "/", title: "Templates | Vilique" },
    { test: (path: string) => path.startsWith("/invitations") || path.startsWith("/dashboard"), title: "Invitations | Vilique" },
    { test: (path: string) => path.startsWith("/profile"), title: "Profile | Vilique" },
    { test: (path: string) => path.startsWith("/builder/preview"), title: "Preview | Vilique" },
    { test: (path: string) => path.startsWith("/builder"), title: "Builder | Vilique" },
    { test: (path: string) => path.startsWith("/templates/") && path.endsWith("/preview"), title: "Template Preview | Vilique" },
    { test: (path: string) => path.startsWith("/templates/"), title: "Template | Vilique" },
    { test: (path: string) => path.startsWith("/templates"), title: "Templates | Vilique" },
    { test: (path: string) => path.startsWith("/i/") || path.startsWith("/invite/"), title: "Invitation | Vilique" },
    { test: (path: string) => path.startsWith("/signup"), title: "Sign in | Vilique" },
];

function getStableTitle(pathname: string) {
    return titleByPath.find((item) => item.test(pathname))?.title || "Vilique";
}

export default function StableDocumentTitle() {
    const pathname = usePathname();

    useEffect(() => {
        const stableTitle = getStableTitle(pathname);
        const currentTitleLooksLikeUrl = document.title.startsWith("http://") ||
            document.title.startsWith("https://") ||
            document.title.includes("localhost:");

        if (currentTitleLooksLikeUrl || !document.title || document.title === stableTitle) {
            document.title = stableTitle;
        } else {
            const frame = window.requestAnimationFrame(() => {
                if (!document.title || document.title.includes("localhost:")) {
                    document.title = stableTitle;
                }
            });
            const timeout = window.setTimeout(() => {
                const titleLooksLikeUrl = document.title.startsWith("http://") ||
                    document.title.startsWith("https://") ||
                    document.title.includes("localhost:");

                if (!document.title || titleLooksLikeUrl) {
                    document.title = stableTitle;
                }
            }, 90);

            return () => {
                window.cancelAnimationFrame(frame);
                window.clearTimeout(timeout);
            };
        }
    }, [pathname]);

    return null;
}
