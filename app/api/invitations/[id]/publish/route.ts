import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publishInvitationAfterPayment } from "@/features/invitations/publish";

type Context = {
    params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Context) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get input (custom slug if provided)
        const body = await request.json().catch(() => ({})) as { slug?: string };
        const customSlug = body.slug?.toLowerCase().trim() || "";

        const result = await publishInvitationAfterPayment({
            userId: user.id,
            invitationId: id,
            customSlug,
        });

        return NextResponse.json({
            id,
            slug: result.slug,
            status: result.status,
            published_at: result.publishedAt,
            publicUrl: result.publicUrl,
        });
    } catch (err: unknown) {
        console.error("Error publishing invitation:", err);
        if (err instanceof Error && err.message === "Invitation is completed and locked.") {
            return NextResponse.json({
                code: "INVITATION_COMPLETED_LOCKED",
                error: "This invitation is completed and can no longer be published.",
            }, { status: 409 });
        }
        return NextResponse.json(getSafePublishError(err), { status: 400 });
    }
}

function getSafePublishError(err: unknown) {
    if (!(err instanceof Error)) return { code: "PUBLISH_FAILED", error: "Failed to publish invitation" };

    if (err.message === "SLUG_GENERATION_FAILED") {
        return {
            code: "SLUG_GENERATION_FAILED",
            error: "We could not create a unique public link. Please try again.",
        };
    }

    const allowedMessages = [
        "Invitation not found",
        "Unauthorized: You do not own this invitation",
        "Cannot publish an archived invitation",
        "Title is required to publish",
        "Host/Couple name is required to publish",
        "Event date is required to publish",
        "Event time is required to publish",
        "Venue name is required to publish",
        "Primary phone is required to publish",
        "Primary phone must be 10 digits",
        "Secondary phone is required to publish",
        "Secondary phone must be 10 digits",
        "Invitation message is required to publish",
        "Template entitlement could not be verified",
        "Payment required: Please complete payment before publishing",
        "Payment entitlement mismatch. Please complete payment for this invitation.",
        "Invalid slug format",
        "The customized link is already taken",
        "This looks like a different event. Your purchase covers one published event. Create a new invitation for this event.",
        "Invitation is completed and locked.",
    ];

    return {
        code: err.message === "The customized link is already taken" ? "CUSTOM_SLUG_TAKEN" : "PUBLISH_FAILED",
        error: allowedMessages.includes(err.message) ? err.message : "Failed to publish invitation",
    };
}
