import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/observability";
import { createPublicServerClient } from "@/lib/supabase/public-server";
import type { TemplateRatingSummary } from "@/lib/templateRatingFormat";

export type TemplateRatingState = TemplateRatingSummary & {
    userRating: number | null;
    eligibleToRate: boolean;
};

export async function getTemplateRatingSummaryMap(templateKeys: string[]) {
    if (!templateKeys.length) return new Map<string, TemplateRatingSummary>();

    const supabase = createPublicServerClient();
    const { data, error } = await supabase.rpc("get_template_rating_summaries", {
        p_template_keys: templateKeys,
    });

    if (error || !data) {
        return new Map<string, TemplateRatingSummary>();
    }

    return new Map(data.map((row) => [
        row.template_key,
        {
            average: typeof row.average_rating === "number" ? row.average_rating : null,
            count: Number(row.rating_count || 0),
        },
    ]));
}

export async function getTemplateRatingState(templateKeyOrId: string, userId?: string | null): Promise<TemplateRatingState | null> {
    const supabase = createAdminClient();
    const template = await resolveTemplate(templateKeyOrId);

    if (!template) return null;

    const [ratingsResult, userRatingResult, eligibleToRate] = await Promise.all([
        supabase
            .from("template_ratings")
            .select("rating")
            .eq("template_id", template.id)
            .eq("is_hidden", false),
        userId
            ? supabase
                .from("template_ratings")
                .select("rating")
                .eq("template_id", template.id)
                .eq("user_id", userId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        userId
            ? canUserRateTemplate(template.id, userId)
            : Promise.resolve(false),
    ]);

    if (ratingsResult.error) {
        throw ratingsResult.error;
    }

    const ratings = ratingsResult.data || [];
    const count = ratings.length;
    const average = count
        ? Math.round((ratings.reduce((sum, row) => sum + row.rating, 0) / count) * 10) / 10
        : null;

    return {
        average,
        count,
        userRating: userRatingResult.data?.rating ?? null,
        eligibleToRate,
    };
}

export async function canUserRateTemplate(templateId: string, userId: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("invitations")
        .select("id")
        .eq("template_id", templateId)
        .eq("user_id", userId)
        .or("first_published_at.not.is.null,published_at.not.is.null")
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("Failed to check template rating eligibility:", error);
        reportError(error, "template_ratings.eligibility_check_failed", { templateId, userId });
        return false;
    }

    return Boolean(data);
}

export async function resolveTemplate(templateKeyOrId: string) {
    const supabase = createAdminClient();

    const { data: byKey } = await supabase
        .from("invitation_templates")
        .select("id, template_key, is_active")
        .eq("template_key", templateKeyOrId)
        .eq("is_active", true)
        .maybeSingle();

    if (byKey) return byKey;

    if (!isUuid(templateKeyOrId)) return null;

    const { data: byId } = await supabase
        .from("invitation_templates")
        .select("id, template_key, is_active")
        .eq("id", templateKeyOrId)
        .eq("is_active", true)
        .maybeSingle();

    return byId || null;
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
