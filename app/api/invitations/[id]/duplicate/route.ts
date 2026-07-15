import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildInvitationSlug, getInvitationReadableName } from "@/features/invitations/slug";

type Context = {
    params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Context) {
    const { id } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch source invitation
    const { data: invite, error: fetchError } = await supabase
        .from("invitations")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (fetchError || !invite) {
        return NextResponse.json({ error: "Source invitation not found." }, { status: 404 });
    }

    // 2. Generate unique clean slug from the new invitation id.
    const newInvitationId = crypto.randomUUID();
    const newSlug = buildInvitationSlug(`${getInvitationReadableName(invite)} copy`, newInvitationId);

    // 3. Construct clean copy resetting all payments & snapshot credentials
    const duplicatePayload = {
        id: newInvitationId,
        user_id: user.id,
        template_id: invite.template_id,
        slug: newSlug,
        category: invite.category,
        title: `${invite.title} (Copy)`,
        primary_name: invite.primary_name,
        secondary_name: invite.secondary_name,
        event_date: invite.event_date,
        event_time: invite.event_time,
        venue_name: invite.venue_name,
        venue_address: invite.venue_address,
        map_link: invite.map_link,
        phone: invite.phone,
        secondary_phone: invite.secondary_phone,
        whatsapp: invite.whatsapp,
        message: invite.message,
        music_url: invite.music_url,
        cover_image_url: invite.cover_image_url,
        gallery_urls: invite.gallery_urls,
        theme: invite.theme,
        sections: invite.sections,
        status: "draft" as const,
        lifecycle_status: "draft" as const,
        payment_status: "unpaid" as const,
        published_at: null,
        first_published_at: null,
        completed_at: null,
        archived_at: null,
        event_status: "draft" as const,
        event_snapshot: null,
        event_change_score: 0,
        first_payment_id: null,
        publish_version: 0,
        first_publish_version: null,
        original_category: null,
        original_primary_name: null,
        original_secondary_name: null,
        original_event_date: null,
        original_template_id: null,
        identity_snapshot: null,
        identity_fingerprint: null,
        change_risk_status: "low" as const,
    };

    let { data: newInvite, error: insertError } = await supabase
        .from("invitations")
        .insert(duplicatePayload)
        .select("id, slug")
        .single();

    if (isSchemaCacheColumnError(insertError)) {
        const retry = await supabase
            .from("invitations")
            .insert(stripNewEntitlementColumns(duplicatePayload))
            .select("id, slug")
            .single();
        newInvite = retry.data;
        insertError = retry.error;
    }

    if (insertError || !newInvite) {
        return NextResponse.json({ error: insertError?.message || "Failed to duplicate invitation" }, { status: 400 });
    }

    return NextResponse.json(newInvite, { status: 201 });
}

function isSchemaCacheColumnError(error: { code?: string; message?: string } | null) {
    return error?.code === "PGRST204" || !!error?.message?.includes("schema cache");
}

function stripNewEntitlementColumns<T extends Record<string, unknown>>(value: T) {
    const legacyValue = { ...value };
    delete legacyValue.event_status;
    delete legacyValue.event_snapshot;
    delete legacyValue.event_change_score;
    delete legacyValue.first_payment_id;
    delete legacyValue.publish_version;
    delete legacyValue.first_publish_version;
    return legacyValue;
}
