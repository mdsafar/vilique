import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config/site";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: ["/", "/pricing", "/about", "/contact", "/terms", "/privacy", "/refund-policy"],
                disallow: ["/i/", "/invite/", "/builder", "/profile", "/invitations", "/api/"],
            },
        ],
        sitemap: `${siteConfig.url}/sitemap.xml`,
        host: siteConfig.url,
    };
}
