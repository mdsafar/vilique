import { NextResponse } from "next/server";
import { mapInvitationRow, toInvitationUpdate } from "@/features/invitations/mappers";
import { invitationUpdateSchema } from "@/features/invitations/validation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assessChangeRisk } from "@/features/invitations/abuse";
import { Database, Json } from "@/types/database";

type Context = {
    params: Promise<{ id: string }>;
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

    const parsed = invitationUpdateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // 1. Fetch current invitation to check snapshot & published status
    const { data: invite, error: fetchError } = await supabase
        .from("invitations")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (fetchError || !invite) {
        return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    // 2. Perform abuse prevention checks if invitation was already published
    const eventSnapshot = invite.event_snapshot || invite.identity_snapshot;
    if (invite.first_published_at && eventSnapshot) {
        const proposedValues = {
            category: parsed.data.category !== undefined ? parsed.data.category : invite.category,
            primaryName: parsed.data.primaryName !== undefined ? parsed.data.primaryName : invite.primary_name,
            secondaryName: parsed.data.secondaryName !== undefined ? parsed.data.secondaryName : invite.secondary_name,
            eventDate: parsed.data.eventDate !== undefined ? parsed.data.eventDate : invite.event_date,
            venueName: parsed.data.venueName !== undefined ? parsed.data.venueName : invite.venue_name,
            venueAddress: parsed.data.venueAddress !== undefined ? parsed.data.venueAddress : invite.venue_address,
            message: parsed.data.message !== undefined ? parsed.data.message : invite.message,
            templateId: invite.template_id || "", // read from existing database template_id
        };

        const risk = assessChangeRisk(eventSnapshot as Parameters<typeof assessChangeRisk>[0], proposedValues);

        // Record the attempt in audit logs using admin key bypass to permit insert
        const supabaseAdmin = createAdminClient();
        await supabaseAdmin.from("invitation_change_audit").insert({
            invitation_id: id,
            user_id: user.id,
            change_type: "update",
            risk_level: risk.riskLevel,
            previous_values: {
                category: invite.category,
                primaryName: invite.primary_name,
                secondaryName: invite.secondary_name,
                eventDate: invite.event_date,
                templateId: invite.template_id,
            },
            proposed_values: proposedValues,
            decision: risk.decision,
            reason: `${risk.reason}${risk.signals.length ? ` Signals: ${risk.signals.join(" ")}` : ""}`,
        });
        await supabaseAdmin.from("invitation_change_log").insert({
            invitation_id: id,
            user_id: user.id,
            before: {
                category: invite.category,
                primaryName: invite.primary_name,
                secondaryName: invite.secondary_name,
                eventDate: invite.event_date,
                venueName: invite.venue_name,
                venueAddress: invite.venue_address,
                message: invite.message,
                templateId: invite.template_id,
            } as Json,
            after: proposedValues as Json,
            risk: risk.riskLevel,
            score: risk.score,
            decision: risk.decision,
            reason: `${risk.reason}${risk.signals.length ? ` Signals: ${risk.signals.join(" ")}` : ""}`,
        });

        if (risk.decision === "blocked") {
            return NextResponse.json({
                code: "NEW_EVENT_DETECTED",
                error: risk.reason,
                riskLevel: risk.riskLevel,
                score: risk.score,
                signals: risk.signals,
            }, { status: 409 });
        }

        const updatePayload = stripUndefined(toInvitationUpdate(parsed.data));
        updatePayload.change_risk_status = risk.riskLevel;
        updatePayload.event_change_score = risk.score;

        let { data, error } = await supabase
            .from("invitations")
            .update(updatePayload)
            .eq("id", id)
            .eq("user_id", user.id)
            .select("id, slug, status, updated_at, change_risk_status, event_change_score")
            .single();

        if (isSchemaCacheColumnError(error)) {
            const retryPayload = { ...updatePayload };
            delete retryPayload.event_change_score;
            const retry = await supabase
                .from("invitations")
                .update(retryPayload)
                .eq("id", id)
                .eq("user_id", user.id)
                .select("id, slug, status, updated_at, change_risk_status")
                .single();
            data = retry.data ? { ...retry.data, event_change_score: risk.score } : null;
            error = retry.error;
        }

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({
            ...data,
            riskLevel: risk.riskLevel,
            warning: risk.decision === "warned" ? risk.reason : undefined,
            signals: risk.signals,
        });
    }

    const { data, error } = await supabase
        .from("invitations")
        .update(stripUndefined(toInvitationUpdate(parsed.data)))
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id, slug, status, updated_at")
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
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

    return NextResponse.json(mapInvitationRow(data));
}

export async function DELETE(_request: Request, { params }: Context) {
    const { id } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: invite, error: inviteError } = await supabase
        .from("invitations")
        .select("id, status, payment_status, first_published_at")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (inviteError || !invite) {
        return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: paidPayment } = await supabaseAdmin
        .from("payments")
        .select("id")
        .eq("invitation_id", id)
        .eq("user_id", user.id)
        .eq("status", "paid")
        .maybeSingle();

    if (paidPayment || invite.payment_status === "paid" || invite.first_published_at) {
        return NextResponse.json({
            code: "PAID_INVITATION_PROTECTED",
            error: "This invitation has a payment attached and cannot be deleted. You can archive or edit it instead.",
        }, { status: 409 });
    }

    const { error } = await supabase
        .from("invitations")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
}

function isSchemaCacheColumnError(error: { code?: string; message?: string } | null) {
    return error?.code === "PGRST204" || !!error?.message?.includes("schema cache");
}

function stripUndefined(value: Database["public"]["Tables"]["invitations"]["Update"]) {
    return Object.fromEntries(
        Object.entries(value).filter((entry) => entry[1] !== undefined)
    ) as Database["public"]["Tables"]["invitations"]["Update"];
}
