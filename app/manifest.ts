import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config/site";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: siteConfig.name,
        short_name: siteConfig.shortName,
        description: siteConfig.packageDescription,
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#fff8f3",
        theme_color: "#b99aad",
        categories: ["productivity", "lifestyle", "events"],
        icons: [
            {
                src: "/favicon.ico",
                sizes: "any",
                type: "image/x-icon",
            },
            {
                src: "/icon-192x192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/icon-512x512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
            {
                src: "/apple-touch-icon.png",
                sizes: "180x180",
                type: "image/png",
            },
        ],
        shortcuts: [
            {
                name: "Vilique Templates",
                short_name: "Templates",
                description: "Browse invitation website templates.",
                url: "/",
            },
            {
                name: "Vilique Dashboard",
                short_name: "Dashboard",
                description: "Manage your invitation websites.",
                url: "/profile",
            },
        ],
    };
}
