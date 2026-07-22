import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isInvitationCompleted } from "@/lib/lifecycle";
import { reportError } from "@/lib/observability";

type Context = {
    params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: Context) {
    const { id } = await params;
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: invite, error: inviteError } = await supabase
            .from("invitations")
            .select("id, status, event_date, event_time, event_timezone, lifecycle_status, event_status, first_published_at, published_at")
            .eq("id", id)
            .eq("user_id", user.id)
            .single();

        if (inviteError || !invite) {
            return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
        }

        if (isInvitationCompleted({
            eventDate: invite.event_date,
            eventTime: invite.event_time,
            eventTimezone: invite.event_timezone,
            status: invite.status,
            lifecycleStatus: invite.lifecycle_status,
            eventStatus: invite.event_status,
            first_published_at: invite.first_published_at,
            published_at: invite.published_at,
        })) {
            return NextResponse.json({
                code: "INVITATION_COMPLETED_LOCKED",
                error: "This invitation is completed and can no longer be taken offline.",
            }, { status: 409 });
        }

        const { data, error } = await supabase
            .from("invitations")
            .update({
                status: "draft",
                lifecycle_status: "unpublished",
                event_status: "unpublished",
                first_published_at: invite.first_published_at || invite.published_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", id)
            .eq("user_id", user.id)
            .select("id, slug, status, lifecycle_status, event_status")
            .single();

        if (error || !data) {
            console.error("Error unpublishing invitation:", error);
            reportError(error || new Error("Failed to unpublish invitation"), "invitation.unpublish_failed", { invitationId: id });
            return NextResponse.json({ error: "Unable to take invitation offline." }, { status: 400 });
        }

        return NextResponse.json(data);
    } catch (err: unknown) {
        console.error("Unexpected error unpublishing invitation:", err);
        reportError(err, "invitation.unpublish_unexpected", { invitationId: id });
        return NextResponse.json({ error: "Unable to take invitation offline." }, { status: 500 });
    }
}
