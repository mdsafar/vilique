"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Mail } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type NavUser = Pick<User, "id" | "email" | "user_metadata">;

type Props = {
    initialUser: NavUser | null;
};

export default function BottomNav({ initialUser }: Props) {
    const pathname = usePathname();
    const [user, setUser] = useState<NavUser | null>(initialUser);
    const [authChecked, setAuthChecked] = useState(Boolean(initialUser));

    useEffect(() => {
        let active = true;
        const supabase = createClient();

        supabase.auth
            .getUser()
            .then(({ data }) => {
                if (!active) return;
                setUser(data.user);
                setAuthChecked(true);
            })
            .catch(() => {
                if (!active) return;
                setUser(null);
                setAuthChecked(true);
            });

        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setAuthChecked(true);
        });

        return () => {
            active = false;
            listener.subscription.unsubscribe();
        };
    }, []);

    const hiddenRoutes = ["/builder", "/invite", "/templates/", "/signup", "/dashboard/payment-history"];
    const protectedNavRoutes = ["/invitations", "/profile", "/dashboard"];
    const isProtectedNavRoute = protectedNavRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
    const profileName = getProfileName(user);
    const profileImage = getProfileImage(user);
    const profileInitials = getInitials(profileName || user?.email || "User");
    const navItems = useMemo(() => {
        const baseItems = [
            { href: "/templates", label: "Templates", icon: LayoutGrid, active: pathname === "/" || pathname.startsWith("/templates") },
            {
                href: "/invitations",
                label: "Invitations",
                icon: Mail,
                active: pathname.startsWith("/invitations") || pathname.startsWith("/dashboard"),
            },
        ];

        if (!authChecked || !user) {
            return baseItems;
        }

        return [
            ...baseItems,
            {
                href: "/profile",
                label: profileName || "Profile",
                active: pathname.startsWith("/profile"),
                avatar: true,
            },
        ];
    }, [authChecked, pathname, profileName, user]);

    const shouldHide = hiddenRoutes.some((route) => pathname.startsWith(route)) ||
        (isProtectedNavRoute && (!authChecked || !user)) ||
        /^\/invitations\/[^/]+\/analytics(?:\/)?$/.test(pathname);

    if (shouldHide) return null;

    return (
        <nav className={`bottomNav ${navItems.length === 2 ? "bottomNavTwoItems" : ""}`} aria-label="Primary navigation">
            {navItems.map((item) => {
                const Icon = "icon" in item ? item.icon : null;

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={[
                            item.active ? "active" : "",
                            item.href === "/profile" ? "bottomNavProfileLink" : "",
                        ].filter(Boolean).join(" ") || undefined}
                        aria-current={item.active ? "page" : undefined}
                        aria-label={item.href === "/profile" ? "Profile" : item.label}
                    >
                        {item.href === "/profile" ? (
                            <span className="bottomNavAvatar" aria-hidden="true">
                                {profileImage ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={profileImage} alt="" />
                                ) : (
                                    <b>{profileInitials}</b>
                                )}
                            </span>
                        ) : Icon ? (
                            <>
                                <Icon size={21} aria-hidden="true" />
                                <span>{item.label}</span>
                            </>
                        ) : null}
                    </Link>
                );
            })}
        </nav>
    );
}

function getProfileName(user: NavUser | null) {
    const metadata = user?.user_metadata;
    return stringValue(metadata?.full_name) ||
        stringValue(metadata?.name) ||
        stringValue(metadata?.display_name) ||
        user?.email?.split("@")[0] ||
        "";
}

function getProfileImage(user: NavUser | null) {
    const metadata = user?.user_metadata;
    return stringValue(metadata?.avatar_url) ||
        stringValue(metadata?.picture) ||
        "";
}

function getInitials(value: string) {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function stringValue(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}
