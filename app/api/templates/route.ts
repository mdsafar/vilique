import { NextResponse } from "next/server";
import { getActiveTemplates } from "@/features/invitations/data";

const TEMPLATE_LIMIT_DEFAULT = 10;
const TEMPLATE_LIMIT_MAX = 36;
const templateSorts = ["popular", "highest_rated", "newest", "price_low", "price_high"] as const;
type TemplateSort = typeof templateSorts[number];

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const search = (url.searchParams.get("search") || "").trim().toLowerCase();
        const category = url.searchParams.get("category") || "all";
        const pricing = url.searchParams.get("pricing") || "all";
        const featured = url.searchParams.get("featured") === "true";
        const minRating = Number(url.searchParams.get("rating") || 0);
        const sort = parseTemplateSort(url.searchParams.get("sort"));
        const limit = parseLimit(url.searchParams.get("limit"), TEMPLATE_LIMIT_DEFAULT, TEMPLATE_LIMIT_MAX);
        const offset = Math.max(Number(url.searchParams.get("cursor") || 0) || 0, 0);
        const templates = await getActiveTemplates();

        const searched = templates.filter((template) => {
            const searchable = [
                template.name,
                template.category.replace("_", " "),
                template.description,
                template.mood,
                template.popularity,
                template.badge,
                ...template.features,
            ].join(" ").toLowerCase();
            return (!search || searchable.includes(search)) &&
                (category === "all" || template.category === category) &&
                (pricing === "all" || (pricing === "free" ? template.badge === "Free" : template.badge === "Premium")) &&
                (!featured || template.popularity === "Featured") &&
                (!minRating || (template.ratingAverage || 0) >= minRating);
        });
        const sorted = sortTemplates(searched, sort);
        const items = sorted.slice(offset, offset + limit);
        const nextOffset = offset + items.length;
        const hasMore = items.length === limit && nextOffset < sorted.length;

        return NextResponse.json({
            items,
            nextCursor: hasMore ? String(nextOffset) : null,
            hasMore,
            totalCount: sorted.length,
            counts: getCategoryCounts(templates, search),
        });
    } catch (error) {
        console.error("Failed to fetch active templates:", error);
        return NextResponse.json({ error: "Failed to fetch active templates" }, { status: 500 });
    }
}

function parseLimit(value: string | null, fallback: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(Math.floor(parsed), max);
}

function parseTemplateSort(value: string | null): TemplateSort {
    return templateSorts.includes(value as TemplateSort) ? value as TemplateSort : "popular";
}

function sortTemplates<T extends {
    popularity: string;
    ratingAverage?: number | null;
    ratingCount?: number;
    badge: string;
    name: string;
}>(items: T[], sort: TemplateSort) {
    const popularityRank = { Featured: 0, Popular: 1, Newest: 2 } as Record<string, number>;
    return [...items].sort((a, b) => {
        if (sort === "highest_rated") {
            return (b.ratingAverage || 0) - (a.ratingAverage || 0) || (b.ratingCount || 0) - (a.ratingCount || 0);
        }
        if (sort === "newest") return a.popularity === "Newest" ? -1 : b.popularity === "Newest" ? 1 : a.name.localeCompare(b.name);
        if (sort === "price_low") return Number(a.badge !== "Free") - Number(b.badge !== "Free") || a.name.localeCompare(b.name);
        if (sort === "price_high") return Number(b.badge !== "Free") - Number(a.badge !== "Free") || a.name.localeCompare(b.name);
        return (popularityRank[a.popularity] ?? 9) - (popularityRank[b.popularity] ?? 9) || a.name.localeCompare(b.name);
    });
}

function getCategoryCounts<T extends { category: string; name: string; description: string; mood: string; popularity: string; badge: string; features: string[] }>(
    templates: T[],
    search: string
) {
    const counts: Record<string, number> = { all: 0 };
    for (const template of templates) {
        const searchable = [
            template.name,
            template.category.replace("_", " "),
            template.description,
            template.mood,
            template.popularity,
            template.badge,
            ...template.features,
        ].join(" ").toLowerCase();
        if (search && !searchable.includes(search)) continue;
        counts.all += 1;
        counts[template.category] = (counts[template.category] || 0) + 1;
    }
    return counts;
}
