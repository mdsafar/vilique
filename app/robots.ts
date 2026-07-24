import type { MetadataRoute } from "next";

const BASE_URL = "https://www.vilique.in";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/api/",
                    "/auth/",
                    "/builder",
                    "/dashboard",
                    "/invitations",
                    "/invite/",
                    "/profile",
                    "/signup",
                    "/templates/*/preview",
                ],
            },
        ],
        sitemap: `${BASE_URL}/sitemap.xml`,
        host: BASE_URL,
    };
}
