import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();
    return ["", "/pricing", "/about", "/contact", "/terms", "/privacy", "/refund-policy"].map((path) => ({
        url: `${siteConfig.url}${path}`,
        lastModified: now,
        changeFrequency: path === "" ? "weekly" : "monthly",
        priority: path === "" ? 1 : 0.6,
    }));
}
