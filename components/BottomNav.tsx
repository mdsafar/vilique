"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, UserRound } from "lucide-react";

export default function BottomNav() {
    const pathname = usePathname();

    const hiddenRoutes = ["/builder", "/invite", "/templates/", "/login", "/signup", "/dashboard/payment-history"];
    const navItems = [
        { href: "/templates", label: "Templates", icon: LayoutGrid, active: pathname === "/" || pathname.startsWith("/templates") },
        {
            href: "/profile",
            label: "Profile",
            icon: UserRound,
            active: pathname.startsWith("/profile") || pathname.startsWith("/dashboard"),
        },
    ];

    const shouldHide = hiddenRoutes.some((route) => pathname.startsWith(route));

    if (shouldHide) return null;

    return (
        <nav className="bottomNav" aria-label="Primary navigation">
            {navItems.map((item) => {
                const Icon = item.icon;

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={item.active ? "active" : undefined}
                        aria-current={item.active ? "page" : undefined}
                    >
                        <Icon size={21} aria-hidden="true" />
                        <span>{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
