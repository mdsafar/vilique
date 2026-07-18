import type { NextConfig } from "next";

const TEMPLATE_CACHE_TTL_SECONDS = 300;

const nextConfig: NextConfig = {
    experimental: {
        staleTimes: {
            dynamic: TEMPLATE_CACHE_TTL_SECONDS,
            static: TEMPLATE_CACHE_TTL_SECONDS,
        },
    },
};

export default nextConfig;
