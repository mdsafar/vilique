import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability";

type TemplateRatingItem = {
    templateId: string;
    templateKey: string;
    templateName: string;
    category: string;
    accentColor: string | null;
    previewImageUrl: string | null;
    userRating: number | null;
    averageRating: number | null;
    ratingCount: number;
    purchaseCount: number;
    invitationCount: number;
    firstPurchaseAt: string | null;
    firstUsedAt: string | null;
    lastUpdatedAt: string | null;
};

type InvitationTemplateJoin = {
    id?: string | null;
    template_key?: string | null;
    name?: string | null;
    category?: string | null;
    accent_color?: string | null;
    preview_image_url?: string | null;
};

type EligibleInvitationRow = {
    template_id: string | null;
    created_at: string | null;
    updated_at: string | null;
    first_published_at: string | null;
    published_at: string | null;
    invitation_templates?: InvitationTemplateJoin | InvitationTemplateJoin[] | null;
};

type PaidPaymentRow = {
    template_id: string | null;
    created_at: string | null;
    paid_at: string | null;
    invitation_templates?: InvitationTemplateJoin | InvitationTemplateJoin[] | null;
};

const USED_TEMPLATE_LIMIT_DEFAULT = 10;
const USED_TEMPLATE_LIMIT_MAX = 24;
const usedTemplateSorts = ["recently_used", "most_used", "highest_rated", "unrated_first"] as const;
type UsedTemplateSort = typeof usedTemplateSorts[number];

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabaseAdmin = createAdminClient();
        const search = (url.searchParams.get("search") || "").trim().toLowerCase();
        const ratingFilter = url.searchParams.get("rating") || "all";
        const sort = parseUsedTemplateSort(url.searchParams.get("sort"));
        const offset = Math.max(Number(url.searchParams.get("cursor") || 0) || 0, 0);
        const limit = parseLimit(url.searchParams.get("limit"), USED_TEMPLATE_LIMIT_DEFAULT, USED_TEMPLATE_LIMIT_MAX);
        const [invitationsResult, paymentsResult] = await Promise.all([
            supabaseAdmin
                .from("invitations")
                .select(`
                    template_id,
                    created_at,
                    updated_at,
                    first_published_at,
                    published_at,
                    invitation_templates (
                        id,
                        template_key,
                        name,
                        category,
                        accent_color,
                        preview_image_url
                    )
                `)
                .eq("user_id", user.id)
                .not("template_id", "is", null)
                .or("first_published_at.not.is.null,published_at.not.is.null"),
            supabaseAdmin
                .from("payments")
                .select(`
                    template_id,
                    created_at,
                    paid_at,
                    invitation_templates (
                        id,
                        template_key,
                        name,
                        category,
                        accent_color,
                        preview_image_url
                    )
                `)
                .eq("user_id", user.id)
                .eq("status", "paid")
                .not("template_id", "is", null),
        ]);

        if (invitationsResult.error || paymentsResult.error) {
            console.error("Failed to load used template sources:", invitationsResult.error || paymentsResult.error);
            reportError(invitationsResult.error || paymentsResult.error, "profile.template_ratings_sources_failed", { userId: user.id });
            return NextResponse.json({ error: "Failed to load template ratings." }, { status: 500 });
        }

        const grouped = new Map<string, TemplateRatingItem>();

        for (const row of (paymentsResult.data || []) as PaidPaymentRow[]) {
            if (!row.template_id) continue;
            const template = getTemplateJoin(row.invitation_templates);
            if (!template?.template_key) continue;
            const item = getOrCreateTemplateItem(grouped, row.template_id, template);
            const purchasedAt = row.paid_at || row.created_at || null;
            item.purchaseCount += 1;
            item.firstPurchaseAt = getEarlierDate(item.firstPurchaseAt, purchasedAt);
            item.lastUpdatedAt = getLaterDate(item.lastUpdatedAt, purchasedAt);
        }

        for (const row of (invitationsResult.data || []) as EligibleInvitationRow[]) {
            if (!row.template_id) continue;

            const template = getTemplateJoin(row.invitation_templates);
            if (!template?.template_key) continue;

            const item = getOrCreateTemplateItem(grouped, row.template_id, template);
            const createdAt = row.created_at || null;
            const updatedAt = row.updated_at || null;

            item.invitationCount += 1;
            item.firstUsedAt = getEarlierDate(item.firstUsedAt, createdAt);
            item.lastUpdatedAt = getLaterDate(item.lastUpdatedAt, updatedAt);
        }

        const templateIds = Array.from(grouped.keys());

        if (!templateIds.length) {
            return NextResponse.json(emptyRatingsResponse());
        }

        const [userRatingsResult, communityRatingsResult] = await Promise.all([
            supabaseAdmin
                .from("template_ratings")
                .select("template_id, rating")
                .eq("user_id", user.id)
                .in("template_id", templateIds),
            supabaseAdmin
                .from("template_ratings")
                .select("template_id, rating")
                .eq("is_hidden", false)
                .in("template_id", templateIds),
        ]);

        if (isMissingRatingsTable(userRatingsResult.error) || isMissingRatingsTable(communityRatingsResult.error)) {
            return NextResponse.json(toRatingsResponse(Array.from(grouped.values()), { search, ratingFilter, sort, offset, limit }));
        }

        if (userRatingsResult.error || communityRatingsResult.error) {
            console.error("Failed to load template rating rows:", userRatingsResult.error || communityRatingsResult.error);
            reportError(userRatingsResult.error || communityRatingsResult.error, "profile.template_ratings_rows_failed", { userId: user.id });
            return NextResponse.json({ error: "Failed to load template ratings." }, { status: 500 });
        }

        for (const row of userRatingsResult.data || []) {
            const item = grouped.get(row.template_id);
            if (item) item.userRating = row.rating;
        }

        const communityByTemplate = new Map<string, number[]>();
        for (const row of communityRatingsResult.data || []) {
            const ratings = communityByTemplate.get(row.template_id) || [];
            ratings.push(row.rating);
            communityByTemplate.set(row.template_id, ratings);
        }

        for (const [templateId, ratings] of communityByTemplate) {
            const item = grouped.get(templateId);
            if (!item) continue;

            item.ratingCount = ratings.length;
            item.averageRating = ratings.length
                ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
                : null;
        }

        return NextResponse.json(toRatingsResponse(Array.from(grouped.values()), { search, ratingFilter, sort, offset, limit }));
    } catch (error) {
        console.error("Failed to load profile template ratings:", error);
        reportError(error, "profile.template_ratings_failed");
        return NextResponse.json({ error: "Failed to load template ratings." }, { status: 500 });
    }
}

function getTemplateJoin(value: InvitationTemplateJoin | InvitationTemplateJoin[] | null | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function getOrCreateTemplateItem(
    grouped: Map<string, TemplateRatingItem>,
    templateId: string,
    template: InvitationTemplateJoin
) {
    const existing = grouped.get(templateId);
    if (existing) return existing;

    const item = {
        templateId,
        templateKey: template.template_key || templateId,
        templateName: template.name || "Invitation Template",
        category: template.category || "custom",
        accentColor: template.accent_color || null,
        previewImageUrl: template.preview_image_url || null,
        userRating: null,
        averageRating: null,
        ratingCount: 0,
        purchaseCount: 0,
        invitationCount: 0,
        firstPurchaseAt: null,
        firstUsedAt: null,
        lastUpdatedAt: null,
    };
    grouped.set(templateId, item);
    return item;
}

function toRatingsResponse(
    ratings: TemplateRatingItem[],
    options: { search: string; ratingFilter: string; sort: UsedTemplateSort; offset: number; limit: number }
) {
    const filtered = ratings.filter((item) => {
        const searchable = [item.templateName, item.category, item.templateKey].join(" ").toLowerCase();
        const matchesRating = options.ratingFilter === "all" ||
            (options.ratingFilter === "unrated" ? !item.userRating : item.userRating === Number(options.ratingFilter));
        return (!options.search || searchable.includes(options.search)) && matchesRating;
    });
    const sorted = sortUsedTemplates(filtered, options.sort);
    const items = sorted.slice(options.offset, options.offset + options.limit);
    const nextOffset = options.offset + items.length;
    const hasMore = items.length === options.limit && nextOffset < sorted.length;

    return {
        ratings: items,
        items,
        nextCursor: hasMore ? String(nextOffset) : null,
        hasMore,
        totalCount: sorted.length,
        counts: {
            all: filtered.length,
            unrated: filtered.filter((item) => !item.userRating).length,
            rated: filtered.filter((item) => Boolean(item.userRating)).length,
        },
    };
}

function emptyRatingsResponse() {
    return {
        ratings: [] as TemplateRatingItem[],
        items: [] as TemplateRatingItem[],
        nextCursor: null,
        hasMore: false,
        totalCount: 0,
        counts: { all: 0, unrated: 0, rated: 0 },
    };
}

function sortUsedTemplates(ratings: TemplateRatingItem[], sort: UsedTemplateSort) {
    return [...ratings].sort((a, b) => {
        if (sort === "most_used") return b.invitationCount - a.invitationCount || b.purchaseCount - a.purchaseCount;
        if (sort === "highest_rated") return (b.averageRating || 0) - (a.averageRating || 0) || b.ratingCount - a.ratingCount;
        if (sort === "unrated_first") return Number(Boolean(a.userRating)) - Number(Boolean(b.userRating)) || compareLastUpdatedDesc(a, b);
        return compareLastUpdatedDesc(a, b);
    });
}

function compareLastUpdatedDesc(a: TemplateRatingItem, b: TemplateRatingItem) {
        const aTime = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0;
        const bTime = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0;
        return bTime - aTime;
}

function isMissingRatingsTable(error: { code?: string; message?: string } | null) {
    return Boolean(error && (error.code === "42P01" || error.message?.includes("template_ratings")));
}

function getEarlierDate(current: string | null, next: string | null) {
    if (!current) return next;
    if (!next) return current;
    return new Date(next).getTime() < new Date(current).getTime() ? next : current;
}

function getLaterDate(current: string | null, next: string | null) {
    if (!current) return next;
    if (!next) return current;
    return new Date(next).getTime() > new Date(current).getTime() ? next : current;
}

function parseUsedTemplateSort(value: string | null): UsedTemplateSort {
    return usedTemplateSorts.includes(value as UsedTemplateSort) ? value as UsedTemplateSort : "recently_used";
}

function parseLimit(value: string | null, fallback: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(Math.floor(parsed), max);
}
