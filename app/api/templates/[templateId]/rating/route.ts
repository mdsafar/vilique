import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canUserRateTemplate, getTemplateRatingState, resolveTemplate } from "@/lib/templateRatings";
import { reportError } from "@/lib/observability";

type Context = {
    params: Promise<{ templateId: string }>;
};

const ratingSchema = z.object({
    rating: z.number().int().min(1).max(5),
});

export async function GET(_request: Request, { params }: Context) {
    const { templateId } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const state = await getTemplateRatingState(templateId, user?.id);

    if (!state) {
        return ratingError("TEMPLATE_NOT_FOUND", "Template not found.", 404);
    }

    return NextResponse.json(state);
}

export async function POST(request: Request, context: Context) {
    return saveRating(request, context);
}

export async function PUT(request: Request, context: Context) {
    return saveRating(request, context);
}

export async function DELETE(_request: Request, { params }: Context) {
    const { templateId } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return ratingError("AUTH_REQUIRED", "Sign in to rate templates.", 401);
    }

    const template = await resolveTemplate(templateId);
    if (!template) {
        return ratingError("TEMPLATE_NOT_FOUND", "Template not found.", 404);
    }

    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin
        .from("template_ratings")
        .delete()
        .eq("template_id", template.id)
        .eq("user_id", user.id);

    if (error) {
        console.error("Template rating delete failed:", error);
        reportError(error, "template_ratings.delete_failed", { templateId, userId: user.id });
        return ratingError("RATING_SAVE_FAILED", "Unable to remove rating.", 400);
    }

    const state = await getTemplateRatingState(template.template_key, user.id);
    return NextResponse.json(state);
}

async function saveRating(request: Request, { params }: Context) {
    const { templateId } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return ratingError("AUTH_REQUIRED", "Sign in to rate templates.", 401);
    }

    const parsed = ratingSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
        return ratingError("INVALID_RATING", "Choose a rating from 1 to 5 stars.", 400);
    }

    const template = await resolveTemplate(templateId);
    if (!template) {
        return ratingError("TEMPLATE_NOT_FOUND", "Template not found.", 404);
    }

    const eligible = await canUserRateTemplate(template.id, user.id);

    if (!eligible) {
        return ratingError("NOT_ELIGIBLE_TO_RATE", "Publish an invitation with this template before rating it.", 403);
    }

    const supabaseAdmin = createAdminClient();
    const { data: existingRating, error: lookupError } = await supabaseAdmin
        .from("template_ratings")
        .select("id")
        .eq("template_id", template.id)
        .eq("user_id", user.id)
        .maybeSingle();

    if (lookupError) {
        console.error("Template rating lookup failed:", lookupError);
        reportError(lookupError, "template_ratings.lookup_failed", { templateId, userId: user.id });
        return ratingError("RATING_SAVE_FAILED", getRatingSaveMessage(lookupError), 400);
    }

    const saveQuery = existingRating
        ? supabaseAdmin
            .from("template_ratings")
            .update({
                rating: parsed.data.rating,
                is_hidden: false,
                moderation_reason: null,
                moderated_at: null,
                moderated_by: null,
            })
            .eq("id", existingRating.id)
        : supabaseAdmin
            .from("template_ratings")
            .insert({
                template_id: template.id,
                user_id: user.id,
                rating: parsed.data.rating,
            });

    const { error } = await saveQuery
        .select("id")
        .single();

    if (error) {
        console.error("Template rating save failed:", error);
        if (error.code !== "23505") {
            reportError(error, "template_ratings.save_failed", { templateId, userId: user.id });
        }
        return ratingError("RATING_SAVE_FAILED", getRatingSaveMessage(error), 400);
    }

    const state = await getTemplateRatingState(template.template_key, user.id);
    return NextResponse.json(state);
}

function getRatingSaveMessage(error: { code?: string; message?: string }) {
    if (error.code === "42P01" || error.message?.includes("template_ratings")) {
        return "Template ratings are not set up yet.";
    }

    if (error.code === "23505") {
        return "This rating was already saved. Try again.";
    }

    return "Unable to save rating.";
}

function ratingError(code: string, error: string, status: number) {
    return NextResponse.json({ code, error }, { status });
}
