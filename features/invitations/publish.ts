import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicInvitationUrl } from "@/lib/config/site";
import { isSlugAvailable } from "@/features/invitations/slug";
import { generateEventFingerprint } from "@/features/invitations/abuse";

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

    // 3. Confirm payment eligibility
    if (!isFree) {
        // Query payments table to confirm if a paid record exists for this invitation
        const { data: payment, error: paymentError } = await supabase
            .from("payments")
            .select("id, status")
            .eq("invitation_id", invitationId)
            .eq("status", "paid")
            .maybeSingle();

        if (paymentError || !payment) {
            throw new Error("Payment required: Please complete payment before publishing");
        }
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
    const originalTemplateId = invite.original_template_id || template?.id || invite.template_id;

    // Generate fingerprint and snapshot
    const identityFingerprint = invite.identity_fingerprint || generateEventFingerprint({
        category: originalCategory,
        primaryName: originalPrimaryName,
        secondaryName: originalSecondaryName,
        eventDate: originalEventDate || "",
        userId,
        templateId: originalTemplateId || "",
    });

    const identitySnapshot = invite.identity_snapshot || {
        original_category: originalCategory,
        original_primary_name: originalPrimaryName,
        original_secondary_name: originalSecondaryName,
        original_event_date: originalEventDate,
        original_template_id: originalTemplateId,
        first_published_at: firstPublishedAt,
    };

    // 5. Update invitation status
    const { data: updatedInvite, error: updateError } = await supabase
        .from("invitations")
        .update({
            slug: finalSlug,
            status: "published",
            lifecycle_status: "published",
            published_at: invite.published_at || new Date().toISOString(),
            first_published_at: firstPublishedAt,
            payment_status: isFree ? "unpaid" : "paid",
            original_category: originalCategory,
            original_primary_name: originalPrimaryName,
            original_secondary_name: originalSecondaryName,
            original_event_date: originalEventDate,
            original_template_id: originalTemplateId,
            identity_snapshot: identitySnapshot,
            identity_fingerprint: identityFingerprint,
            updated_at: new Date().toISOString(),
        })
        .eq("id", invitationId)
        .select("id, slug, status, published_at")
        .single();

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
