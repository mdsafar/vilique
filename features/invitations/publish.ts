import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicInvitationUrl } from "@/lib/config/site";
import { isSlugAvailable } from "@/features/invitations/slug";
import { assessChangeRisk, EventIdentitySnapshot, generateEventFingerprint } from "@/features/invitations/abuse";

export async function publishInvitationAfterPayment({
    userId,
    invitationId,
    customSlug,
}: {
    userId: string;
    invitationId: string;
    customSlug?: string;
}) {
    const supabase = createAdminClient();

    // 1. Fetch invitation and associated template
    const { data: invite, error: inviteError } = await supabase
        .from("invitations")
        .select("*, invitation_templates(*)")
        .eq("id", invitationId)
        .single();

    if (inviteError || !invite) {
        throw new Error("Invitation not found");
    }

    if (invite.user_id !== userId) {
        throw new Error("Unauthorized: You do not own this invitation");
    }

    if (invite.status === "archived" || invite.lifecycle_status === "archived") {
        throw new Error("Cannot publish an archived invitation");
    }

    // 2. Validate mandatory fields
    if (!invite.title?.trim()) {
        throw new Error("Title is required to publish");
    }
    if (!invite.primary_name?.trim()) {
        throw new Error("Host/Couple name is required to publish");
    }
    if (!invite.event_date) {
        throw new Error("Event date is required to publish");
    }
    if (!invite.venue_name?.trim()) {
        throw new Error("Venue name is required to publish");
    }
    if (!invite.message?.trim()) {
        throw new Error("Invitation message is required to publish");
    }

    const template = invite.invitation_templates;
    const isFree = template ? template.is_free : false;
    const templateId = invite.template_id || template?.id || null;
    let firstPaymentId = invite.first_payment_id || null;

    // 3. Confirm payment eligibility
    if (!isFree) {
        if (!templateId) {
            throw new Error("Template entitlement could not be verified");
        }

        // Query payments table to confirm if a paid record exists for this invitation
        const { data: payment, error: paymentError } = await supabase
            .from("payments")
            .select("id, user_id, invitation_id, template_id, status")
            .eq("invitation_id", invitationId)
            .eq("user_id", userId)
            .eq("template_id", templateId)
            .eq("status", "paid")
            .maybeSingle();

        if (paymentError || !payment) {
            throw new Error("Payment required: Please complete payment before publishing");
        }

        if (payment.invitation_id !== invitationId || payment.user_id !== userId || payment.template_id !== templateId) {
            throw new Error("Payment entitlement mismatch. Please complete payment for this invitation.");
        }

        firstPaymentId = firstPaymentId || payment.id;
    }

    // 4. Handle slug validation & preservation
    let finalSlug = invite.slug;
    const cleanSlug = customSlug?.toLowerCase().trim();
    if (cleanSlug && cleanSlug !== invite.slug) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug) || cleanSlug.length < 3 || cleanSlug.length > 80) {
            throw new Error("Invalid slug format");
        }

        const isAvailable = await isSlugAvailable(cleanSlug, invitationId);
        if (!isAvailable) {
            throw new Error("The customized link is already taken");
        }
        finalSlug = cleanSlug;
    }

    const firstPublishedAt = invite.first_published_at || new Date().toISOString();
    const originalCategory = invite.original_category || invite.category;
    const originalPrimaryName = invite.original_primary_name || invite.primary_name;
    const originalSecondaryName = invite.original_secondary_name || invite.secondary_name;
    const originalEventDate = invite.original_event_date || invite.event_date;
    const originalTemplateId = invite.original_template_id || templateId;
    const nextPublishVersion = (invite.publish_version || 0) + 1;
    const firstPublishVersion = invite.first_publish_version || nextPublishVersion;

    // Generate fingerprint and snapshot
    const identityFingerprint = invite.identity_fingerprint || generateEventFingerprint({
        category: originalCategory,
        primaryName: originalPrimaryName,
        secondaryName: originalSecondaryName,
        eventDate: originalEventDate || "",
        userId,
        templateId: originalTemplateId || "",
    });

    const storedSnapshot = (invite.identity_snapshot || invite.event_snapshot) as EventIdentitySnapshot | null;
    const identitySnapshot: EventIdentitySnapshot = storedSnapshot || {
        original_category: originalCategory,
        original_primary_name: originalPrimaryName,
        original_secondary_name: originalSecondaryName,
        original_event_date: originalEventDate,
        original_template_id: originalTemplateId || "",
        original_venue_name: invite.venue_name,
        original_venue_address: invite.venue_address,
        original_message: invite.message,
        first_published_at: firstPublishedAt,
        first_payment_id: firstPaymentId,
        first_publish_version: firstPublishVersion,
        owner_id: userId,
    };

    const risk = assessChangeRisk(identitySnapshot, {
        category: invite.category,
        primaryName: invite.primary_name,
        secondaryName: invite.secondary_name,
        eventDate: invite.event_date,
        venueName: invite.venue_name,
        venueAddress: invite.venue_address,
        message: invite.message,
        templateId,
    });

    if (invite.first_published_at && risk.decision === "blocked") {
        throw new Error(risk.reason);
    }

    // 5. Update invitation status. Retry without the newest entitlement columns
    // when PostgREST schema cache has not seen the migration yet.
    const publishUpdate = {
        slug: finalSlug,
        status: "published" as const,
        lifecycle_status: "published" as const,
        event_status: "published" as const,
        published_at: invite.published_at || new Date().toISOString(),
        first_published_at: firstPublishedAt,
        first_payment_id: firstPaymentId,
        publish_version: nextPublishVersion,
        first_publish_version: firstPublishVersion,
        payment_status: isFree ? "unpaid" as const : "paid" as const,
        original_category: originalCategory,
        original_primary_name: originalPrimaryName,
        original_secondary_name: originalSecondaryName,
        original_event_date: originalEventDate,
        original_template_id: originalTemplateId,
        event_snapshot: identitySnapshot,
        identity_snapshot: identitySnapshot,
        identity_fingerprint: identityFingerprint,
        event_change_score: risk.score,
        change_risk_status: risk.riskLevel,
        updated_at: new Date().toISOString(),
    };

    let { data: updatedInvite, error: updateError } = await supabase
        .from("invitations")
        .update(publishUpdate)
        .eq("id", invitationId)
        .select("id, slug, status, published_at")
        .single();

    if (isSchemaCacheColumnError(updateError)) {
        const retry = await supabase
            .from("invitations")
            .update(stripNewEntitlementColumns(publishUpdate))
            .eq("id", invitationId)
            .select("id, slug, status, published_at")
            .single();
        updatedInvite = retry.data;
        updateError = retry.error;
    }

    if (updateError || !updatedInvite) {
        throw new Error(updateError?.message || "Failed to publish invitation");
    }

    return {
        slug: updatedInvite.slug,
        status: updatedInvite.status,
        publishedAt: updatedInvite.published_at,
        publicUrl: getPublicInvitationUrl(updatedInvite.slug),
    };
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
