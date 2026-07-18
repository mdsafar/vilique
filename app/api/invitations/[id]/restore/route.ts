import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { restorePublishedInvitationFromOffline } from "@/features/invitations/publish";

type Context = {
    params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: Context) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await restorePublishedInvitationFromOffline({
            userId: user.id,
            invitationId: id,
        });

        return NextResponse.json({
            id: result.id,
            slug: result.slug,
            status: result.status,
            lifecycle_status: result.lifecycleStatus,
            event_status: result.eventStatus,
            payment_status: result.paymentStatus,
            published_at: result.publishedAt,
            publicUrl: result.publicUrl,
            restored: result.restored,
        });
    } catch (err: unknown) {
        console.error("Error restoring invitation:", err);
        if (err instanceof Error && err.message === "Invitation is completed and locked.") {
            return NextResponse.json({
                code: "INVITATION_COMPLETED_LOCKED",
                error: "This invitation is completed and can no longer be restored.",
            }, { status: 409 });
        }
        return NextResponse.json(getSafeRestoreError(err), { status: 400 });
    }
}

function getSafeRestoreError(err: unknown) {
    if (!(err instanceof Error)) return { code: "RESTORE_FAILED", error: "Failed to restore invitation" };

    const allowedMessages = [
        "Invitation not found",
        "Unauthorized: You do not own this invitation",
        "Cannot restore an archived invitation",
        "Payment required: Please complete payment before publishing",
        "Payment entitlement could not be verified",
        "Invitation is completed and locked.",
    ];

    return {
        code: err.message === "Payment required: Please complete payment before publishing"
            ? "PAYMENT_REQUIRED"
            : "RESTORE_FAILED",
        error: allowedMessages.includes(err.message) ? err.message : "Failed to restore invitation",
    };
}
