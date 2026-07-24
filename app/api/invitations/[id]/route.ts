import { NextResponse } from "next/server";
import { mapInvitationRow } from "@/features/invitations/mappers";
import { invitationUpdateSchema, validateInvitationFields } from "@/features/invitations/validation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isInvitationCompleted } from "@/lib/lifecycle";
import { Json } from "@/types/database";
import { reportError } from "@/lib/observability";
import { parseBuilderLockHeaders } from "@/features/builder/lib/builderLock";
import { looseSupabase } from "@/lib/supabase/loose";

type Context = {
    params: Promise<{ id: string }>;
};

type IdentityCheckedUpdateResult = {
    blocked?: boolean;
    locked?: boolean;
    validationError?: boolean;
    code?: string;
    reason?: string;
    error?: string;
    fields?: Record<string, string>;
    id?: string;
    slug?: string;
    status?: string;
    updated_at?: string;
    change_risk_status?: string;
    event_change_score?: number;
    riskLevel?: string | null;
    score?: number;
    warning?: string | null;
    conflict?: boolean;
    revision?: number;
};

export async function PATCH(request: Request, { params }: Context) {
    const { id } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lock = parseBuilderLockHeaders(request);
    if (!lock) {
        return NextResponse.json({ code: "LOCK_NOT_OWNED", error: "A valid editor lock is required." }, { status: 409 });
    }

    const parsed = invitationUpdateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: currentInvite, error: currentInviteError } = await supabaseAdmin
        .from("invitations")
        .select("id, user_id, status, title, primary_name, secondary_name, event_date, event_time, venue_name, venue_address, map_link, phone, secondary_phone, message, music_url, event_timezone, lifecycle_status, event_status, first_published_at, published_at")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (currentInviteError || !currentInvite) {
        return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    if (isCompletedInvitationRow(currentInvite)) {
        return completedLockedResponse();
    }

    const mergedForValidation = {
        title: parsed.data.title ?? currentInvite.title,
        primaryName: parsed.data.primaryName ?? currentInvite.primary_name,
        secondaryName: parsed.data.secondaryName ?? currentInvite.secondary_name,
        eventDate: parsed.data.eventDate ?? currentInvite.event_date,
        eventTime: parsed.data.eventTime ?? currentInvite.event_time,
        venueName: parsed.data.venueName ?? currentInvite.venue_name,
        venueAddress: parsed.data.venueAddress ?? currentInvite.venue_address,
        mapLink: parsed.data.mapLink ?? currentInvite.map_link,
        phone: parsed.data.phone ?? currentInvite.phone,
        secondaryPhone: parsed.data.secondaryPhone ?? currentInvite.secondary_phone,
        message: parsed.data.message ?? currentInvite.message,
        musicUrl: parsed.data.musicUrl ?? currentInvite.music_url,
    };
    const validationErrors = validateInvitationFields(mergedForValidation);
    if (Object.keys(validationErrors).length > 0) {
        return NextResponse.json({
            code: "REQUIRED_FIELDS_MISSING",
            error: "Please fix the highlighted fields before continuing.",
            fields: validationErrors,
        }, { status: 400 });
    }


    const { data, error } = await looseSupabase(supabaseAdmin).rpc("update_invitation_with_editor_lock", {
        p_invitation_id: id,
        p_patch: stripUndefined(parsed.data) as Json,
        p_user_id: user.id,
        p_editor_session_id: lock.editorSessionId,
        p_lock_generation: lock.lockGeneration,
        p_expected_revision: lock.revision,
    });

    if (error) {
        if (error.code === "P0002") {
            return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
        }
        console.error("Failed to update invitation with identity check:", error);
        
        const combined = `${error.code || ""} ${error.message || ""}`.toLowerCase();
        const isExpected = (error.code === "23505" && combined.includes("slug")) ||
            (error.code === "P0001" && (combined.includes("protected event identity") || combined.includes("server validation"))) ||
            (error.code === "P0001" && combined.includes("completed invitations cannot be edited"));
            
        if (!isExpected) {
            reportError(new Error(error.message || JSON.stringify(error)), "invitation.update_db_failed", { invitationId: id, userId: user.id });
        }
        
        return getSafeUpdateErrorResponse(error);
    }

    const result = data as IdentityCheckedUpdateResult | null;
    if (!result) {
        return NextResponse.json({ error: "Unable to save invitation changes." }, { status: 400 });
    }

    if (result.conflict) {
        return NextResponse.json({
            code: result.code || "LOCK_NOT_OWNED",
            error: "This editor no longer owns the latest invitation version.",
            revision: result.revision,
        }, { status: 409 });
    }

    if (result.validationError) {
        return NextResponse.json({
            code: result.code || "REQUIRED_FIELDS_MISSING",
            error: result.error || "Complete the required fields before updating.",
            fields: result.fields || {},
        }, { status: 400 });
    }

    if (result.locked || result.code === "INVITATION_COMPLETED_LOCKED") {
        return completedLockedResponse();
    }

    if (result.blocked) {
        return NextResponse.json({
            code: result.code || "EVENT_IDENTITY_CHANGED",
            error: result.reason || "This looks like a different event. Your purchase covers one published event.",
            riskLevel: result.riskLevel || "high",
            score: result.score,
        }, { status: 409 });
    }

    return NextResponse.json(result);
}

export async function GET(_request: Request, { params }: Context) {
    const { id } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
        .from("invitations")
        .select("*, invitation_templates(template_key)")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (error || !data) {
        return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    if (isCompletedInvitationRow(data)) {
        return completedLockedResponse();
    }

    return NextResponse.json(mapInvitationRow(data), {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
}

export async function DELETE(request: Request, { params }: Context) {
    const { id } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: invite, error: inviteError } = await supabaseAdmin
        .from("invitations")
        .select("id, status, lifecycle_status, event_status, payment_status, first_published_at, published_at")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

    if (inviteError) {
        return NextResponse.json({ error: "Could not inspect the temporary draft." }, { status: 500 });
    }

    // A stale browser marker is already cleared when its row no longer exists.
    // Return the same success shape so repeated discard calls are harmless.
    if (!invite) {
        return NextResponse.json({ success: true, disposition: "already_cleared" });
    }

    const { data: paidPayment, error: paidPaymentError } = await supabaseAdmin
        .from("payments")
        .select("id")
        .eq("invitation_id", id)
        .eq("user_id", user.id)
        .or(
            "status.in.(paid,captured,authorized,reconciling,publish_pending,published,recovery_pending,manual_review),payment_state.eq.captured",
        )
        .limit(1)
        .maybeSingle();

    if (paidPaymentError) {
        return NextResponse.json({ error: "Could not inspect the temporary draft." }, { status: 500 });
    }

    if (
        paidPayment
        || invite.status !== "draft"
        || (invite.lifecycle_status && invite.lifecycle_status !== "draft")
        || (invite.event_status && invite.event_status !== "draft")
        || invite.payment_status !== "unpaid"
        || invite.first_published_at
        || invite.published_at
    ) {
        return NextResponse.json({ success: true, disposition: "finalized" });
    }

    const lock = parseBuilderLockHeaders(request);
    if (!lock) {
        // If no lock header is passed (e.g., when discarding from the recovery modal on initial load),
        // we can safely delete the temporary draft directly since the user owns the draft.
        const { error: deleteError } = await supabaseAdmin
            .from("invitations")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (deleteError) {
            return NextResponse.json({ error: "Could not discard the temporary draft." }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            disposition: "deleted",
        });
    }

    const { data, error } = await looseSupabase(supabaseAdmin).rpc("discard_temporary_invitation_draft", {
        p_invitation_id: id,
        p_user_id: user.id,
        p_editor_session_id: lock.editorSessionId,
        p_lock_generation: lock.lockGeneration,
        p_expected_revision: lock.revision,
    });
    if (error) {
        if (error.code === "PGRST202") {
            const { error: deleteError } = await supabaseAdmin
                .from("invitations")
                .delete()
                .eq("id", id)
                .eq("user_id", user.id);
            if (deleteError) {
                reportError(new Error(deleteError.message), "invitation.temporary_draft_discard_fallback_failed", {
                    invitationId: id,
                    userId: user.id,
                });
                return NextResponse.json({ error: "Could not discard the temporary draft." }, { status: 500 });
            }
            return NextResponse.json({
                success: true,
                disposition: "deleted",
            });
        }
        reportError(new Error(error.message || JSON.stringify(error)), "invitation.temporary_draft_discard_failed", {
            invitationId: id,
            userId: user.id,
        });
        return NextResponse.json({ error: "Could not discard the temporary draft." }, { status: 500 });
    }

    const result = (data || {}) as {
        success?: boolean;
        disposition?: string;
        conflict?: boolean;
        code?: string;
    };

    if (result.conflict) {
        return NextResponse.json({
            code: result.code || "LOCK_NOT_OWNED",
            error: "Editing ownership changed. Reload the latest version.",
        }, { status: 409 });
    }

    return NextResponse.json({
        success: true,
        disposition: result.disposition || "deleted",
    });
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
    return Object.fromEntries(
        Object.entries(value).filter((entry) => entry[1] !== undefined)
    ) as T;
}

function isCompletedInvitationRow(invitation: {
    status?: string | null;
    event_date: string | null;
    event_time: string | null;
    event_timezone: string | null;
    lifecycle_status?: string | null;
    event_status?: string | null;
    first_published_at?: string | null;
    published_at?: string | null;
}) {
    return isInvitationCompleted({
        eventDate: invitation.event_date,
        eventTime: invitation.event_time,
        eventTimezone: invitation.event_timezone,
        status: invitation.status,
        lifecycleStatus: invitation.lifecycle_status,
        eventStatus: invitation.event_status,
        first_published_at: invitation.first_published_at,
        published_at: invitation.published_at,
    });
}

function completedLockedResponse() {
    return NextResponse.json({
        code: "INVITATION_COMPLETED_LOCKED",
        error: "This invitation is completed and can no longer be edited.",
    }, { status: 409 });
}

function getSafeUpdateErrorResponse(error: { code?: string; message?: string; details?: string | null }) {
    const message = error.message || "";
    const details = error.details || "";
    const combined = `${message} ${details}`.toLowerCase();

    if (error.code === "23505" || combined.includes("invitations_slug_key")) {
        return NextResponse.json({
            code: "SLUG_ALREADY_EXISTS",
            error: "This invitation link is already taken. Please choose another title.",
        }, { status: 409 });
    }

    if (
        error.code === "PGRST202" ||
        error.code === "42883" ||
        combined.includes("update_invitation_with_identity_check") ||
        combined.includes("could not find the function")
    ) {
        return NextResponse.json({
            code: "SERVER_UPDATE_PROTECTION_NOT_READY",
            error: "Unable to save invitation changes.",
        }, { status: 503 });
    }

    if (
        error.code === "P0001" &&
        combined.includes("published invitations require")
    ) {
        return NextResponse.json({
            code: "REQUIRED_FIELDS_MISSING",
            error: "Complete the required fields before updating.",
            fields: {
                title: "Enter a title before updating.",
                primaryName: "Enter the primary name before updating.",
                eventDate: "Choose a valid event date.",
                eventTime: "Choose an event time.",
                venueName: "Enter the venue name before updating.",
                phone: "Primary phone number must be 10 digits.",
                secondaryPhone: "Secondary phone number must be 10 digits.",
                message: "Enter an invitation message before updating.",
            },
        }, { status: 400 });
    }

    if (
        error.code === "P0001" &&
        (combined.includes("protected event identity") || combined.includes("server validation"))
    ) {
        return NextResponse.json({
            code: "PROTECTED_EVENT_IDENTITY",
            error: "This invitation is protected after publishing. Please reload and try your edit again.",
        }, { status: 409 });
    }

    if (
        error.code === "P0001" &&
        combined.includes("completed invitations cannot be edited")
    ) {
        return completedLockedResponse();
    }

    return NextResponse.json({
        code: "INVITATION_SAVE_FAILED",
        error: "Unable to save invitation changes.",
    }, { status: 400 });
}
