import { NextResponse } from "next/server";
import { mapInvitationRow, toInvitationUpdate } from "@/features/invitations/mappers";
import { invitationUpdateSchema } from "@/features/invitations/validation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assessChangeRisk } from "@/features/invitations/abuse";
import { Database } from "@/types/database";

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
    if (invite.first_published_at && invite.identity_snapshot) {
        const proposedValues = {
            category: parsed.data.category !== undefined ? parsed.data.category : invite.category,
            primaryName: parsed.data.primaryName !== undefined ? parsed.data.primaryName : invite.primary_name,
            secondaryName: parsed.data.secondaryName !== undefined ? parsed.data.secondaryName : invite.secondary_name,
            eventDate: parsed.data.eventDate !== undefined ? parsed.data.eventDate : invite.event_date,
            templateId: invite.template_id || "", // read from existing database template_id
        };

        const risk = assessChangeRisk(invite.identity_snapshot as any, proposedValues);

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
            reason: risk.reason,
        });

        if (risk.decision === "blocked") {
            return NextResponse.json({
                code: "MAJOR_CHANGE_DETECTED",
                error: risk.reason
            }, { status: 409 });
        }
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

function stripUndefined(value: Database["public"]["Tables"]["invitations"]["Update"]) {
    return Object.fromEntries(
        Object.entries(value).filter((entry) => entry[1] !== undefined)
    ) as Database["public"]["Tables"]["invitations"]["Update"];
}
