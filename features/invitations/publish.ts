import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicInvitationUrl } from "@/lib/config/site";
import { isInvitationCompleted } from "@/lib/lifecycle";
import {
    buildInvitationSlug,
    getInvitationReadableName,
    isSlugAvailable,
    slugifyInvitationText,
} from "@/features/invitations/slug";
import { assessChangeRisk, EventIdentitySnapshot, generateEventFingerprint } from "@/features/invitations/abuse";
import { looseSupabase } from "@/lib/supabase/loose";

type PublishedInvitationRow = {
    id: string;
    slug: string;
    status: string;
    published_at: string | null;
};

type RestoreInvitationRow = {
    id: string;
    user_id: string;
    slug: string;
    status: string;
    lifecycle_status: string | null;
    event_status: string | null;
    event_date: string | null;
    event_time: string | null;
    event_timezone: string | null;
    first_published_at: string | null;
    published_at: string | null;
    first_payment_id: string | null;
    payment_status: string | null;
    template_id: string | null;
    invitation_templates?: { is_free?: boolean | null } | null;
};

export type PublishEntitlementPayment = {
    id: string;
    user_id: string;
    invitation_id: string | null;
    template_id: string | null;
    status: string | null;
    payment_state?: string | null;
    publish_state?: string | null;
    recovery_state?: string | null;
    refund_state?: string | null;
    paid_at?: string | null;
    provider_payment_id?: string | null;
};

export type OfflineRestoreInvitationState = Pick<
    RestoreInvitationRow,
    "event_date" |
    "event_time" |
    "event_timezone" |
    "status" |
    "lifecycle_status" |
    "event_status" |
    "first_published_at" |
    "published_at"
>;

type FinalizePaidInvitationPublishInput = {
    payment: {
        id: string;
        user_id: string;
        invitation_id: string | null;
        template_id: string | null;
        provider_order_id: string | null;
        amount_paise: number;
        currency: string;
        metadata?: unknown;
    };
    providerPaymentId: string;
    providerStatus: string;
    providerPayload: unknown;
    actorType: "user" | "webhook" | "cron" | "system";
    correlationId?: string | null;
    customSlug?: string;
};

type FinalizePaidInvitationPublishResult = {
    status: "published" | "recovery_pending";
    slug?: string;
    publishedAt?: string | null;
    publicUrl?: string;
    message?: string;
    error?: string;
};

export async function finalizePaidInvitationPublish({
    payment,
    providerPaymentId,
    providerStatus,
    providerPayload,
    actorType,
    correlationId,
    customSlug,
}: FinalizePaidInvitationPublishInput): Promise<FinalizePaidInvitationPublishResult> {
    if (!payment.invitation_id || !payment.template_id || !payment.provider_order_id) {
        throw new Error("Payment attempt is missing required reconciliation identifiers");
    }

    const supabase = createAdminClient();
    const publishPatch = await buildPublishPatch({
        supabase,
        userId: payment.user_id,
        invitationId: payment.invitation_id,
        paymentId: payment.id,
        customSlug,
    });

    const { data, error } = await looseSupabase(supabase).rpc("finalize_paid_invitation_publish", {
        p_payment_id: payment.id,
        p_user_id: payment.user_id,
        p_invitation_id: payment.invitation_id,
        p_template_id: payment.template_id,
        p_provider_order_id: payment.provider_order_id,
        p_provider_payment_id: providerPaymentId,
        p_amount_paise: payment.amount_paise,
        p_currency: payment.currency,
        p_provider_status: providerStatus,
        p_provider_payload: providerPayload,
        p_publish_patch: publishPatch,
        p_actor_type: actorType,
        p_correlation_id: correlationId || null,
    });

    if (error) {
        throw new Error(error.message || "Payment finalization failed");
    }

    const result = (data || {}) as {
        status?: string;
        slug?: string;
        published_at?: string | null;
        message?: string;
        error?: string;
    };

    if (result.status === "published" && result.slug) {
        return {
            status: "published",
            slug: result.slug,
            publishedAt: result.published_at || null,
            publicUrl: getPublicInvitationUrl(result.slug),
        };
    }

    return {
        status: "recovery_pending",
        message: result.message || "Your payment was successful, but publishing is still being completed. Please do not pay again.",
        error: result.error,
    };
}

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
        throw new Error("Invitation is completed and locked.");
    }

    if (invite.status === "published" && invite.first_published_at) {
        return {
            slug: invite.slug,
            status: invite.status,
            publishedAt: invite.published_at,
            publicUrl: getPublicInvitationUrl(invite.slug),
        };
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
    if (!invite.event_time?.trim()) {
        throw new Error("Event time is required to publish");
    }
    if (!invite.venue_name?.trim()) {
        throw new Error("Venue name is required to publish");
    }
    if (!invite.phone?.trim()) {
        throw new Error("Primary phone is required to publish");
    }
    if (invite.phone.length !== 10) {
        throw new Error("Primary phone must be 10 digits");
    }
    if (!invite.secondary_phone?.trim()) {
        throw new Error("Secondary phone is required to publish");
    }
    if (invite.secondary_phone.length !== 10) {
        throw new Error("Secondary phone must be 10 digits");
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
            .in("status", ["paid", "published"])
            .maybeSingle();

        if (paymentError || !payment) {
            throw new Error("Payment required: Please complete payment before publishing");
        }

        if (payment.invitation_id !== invitationId || payment.user_id !== userId || payment.template_id !== templateId) {
            throw new Error("Payment entitlement mismatch. Please complete payment for this invitation.");
        }

        firstPaymentId = firstPaymentId || payment.id;
    }

    const hasPublishedIdentity = Boolean(invite.first_published_at);
    const readableSlugOverride = getReadableSlugOverride(customSlug, invite.slug);
    let finalSlug = hasPublishedIdentity
        ? invite.slug
        : buildInvitationSlug(readableSlugOverride || getInvitationReadableName(invite), invitationId);

    if (!hasPublishedIdentity) {
        const isAvailable = await isSlugAvailable(finalSlug, invitationId);
        if (!isAvailable) {
            finalSlug = buildInvitationSlug(readableSlugOverride || getInvitationReadableName(invite), invitationId, 80, 12);
            const fallbackAvailable = await isSlugAvailable(finalSlug, invitationId);
            if (!fallbackAvailable) {
                throw new Error("SLUG_GENERATION_FAILED");
            }
        }
    }

    const firstPublishedAt = invite.first_published_at || new Date().toISOString();
    const originalCategory = hasPublishedIdentity ? invite.original_category || invite.category : invite.category;
    const originalPrimaryName = hasPublishedIdentity ? invite.original_primary_name || invite.primary_name : invite.primary_name;
    const originalSecondaryName = hasPublishedIdentity ? invite.original_secondary_name || invite.secondary_name : invite.secondary_name;
    const originalEventDate = hasPublishedIdentity ? invite.original_event_date || invite.event_date : invite.event_date;
    const originalTemplateId = hasPublishedIdentity ? invite.original_template_id || templateId : templateId;
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

    const storedSnapshot = hasPublishedIdentity ? (invite.identity_snapshot || invite.event_snapshot) as EventIdentitySnapshot | null : null;
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

    let updatedInvite = null as PublishedInvitationRow | null;
    let updateError = null as { code?: string; message?: string } | null;

    const retrySuffixLengths = hasPublishedIdentity ? [8] : [8, 12, 16, 32];
    for (const suffixLength of retrySuffixLengths) {
        if (!hasPublishedIdentity && suffixLength !== 8) {
            finalSlug = buildInvitationSlug(readableSlugOverride || getInvitationReadableName(invite), invitationId, 80, suffixLength);
            publishUpdate.slug = finalSlug;
        }

        const updateResult = await supabase.rpc("publish_invitation_with_identity_check", {
            p_invitation_id: invitationId,
            p_user_id: userId,
            p_patch: publishUpdate,
        });
        updatedInvite = updateResult.data as PublishedInvitationRow | null;
        updateError = updateResult.error;

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

        if (!isUniqueSlugViolation(updateError)) {
            break;
        }
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

export async function restorePublishedInvitationFromOffline({
    userId,
    invitationId,
}: {
    userId: string;
    invitationId: string;
}) {
    const supabase = createAdminClient();

    const { data: invite, error: inviteError } = await supabase
        .from("invitations")
        .select("id, user_id, slug, status, lifecycle_status, event_status, event_date, event_time, event_timezone, first_published_at, published_at, first_payment_id, payment_status, template_id, invitation_templates(is_free)")
        .eq("id", invitationId)
        .eq("user_id", userId)
        .single();

    if (inviteError || !invite) {
        throw new Error("Invitation not found");
    }

    const invitation = invite as RestoreInvitationRow;
    if (invitation.user_id !== userId) {
        throw new Error("Unauthorized: You do not own this invitation");
    }

    if (invitation.status === "archived" || invitation.lifecycle_status === "archived") {
        throw new Error("Cannot restore an archived invitation");
    }

    const isFreeTemplate = Boolean(invitation.invitation_templates?.is_free);
    const entitlement = isFreeTemplate
        ? null
        : await getSuccessfulPublishEntitlement({
            supabase,
            userId,
            invitationId,
            templateId: invitation.template_id,
            firstPaymentId: invitation.first_payment_id,
        });
    const restoreBlocker = getOfflineRestoreBlocker(invitation, { isFreeTemplate, entitlement });
    if (restoreBlocker) throw new Error(restoreBlocker);

    if (
        invitation.status === "published" &&
        invitation.lifecycle_status === "published" &&
        invitation.event_status === "published"
    ) {
        return {
            id: invitation.id,
            slug: invitation.slug,
            status: invitation.status,
            lifecycleStatus: invitation.lifecycle_status,
            eventStatus: invitation.event_status,
            paymentStatus: invitation.payment_status,
            publishedAt: invitation.published_at,
            publicUrl: getPublicInvitationUrl(invitation.slug),
            restored: false,
        };
    }

    const restoredPaymentStatus: "unpaid" | "paid" | "refunded" = isFreeTemplate
        ? invitation.payment_status === "paid" || invitation.payment_status === "refunded"
            ? invitation.payment_status
            : "unpaid"
        : "paid";
    const restorePatch = {
        status: "published" as const,
        lifecycle_status: "published" as const,
        event_status: "published" as const,
        payment_status: restoredPaymentStatus,
        updated_at: new Date().toISOString(),
    };

    const { data: updatedInvite, error: updateError } = await supabase
        .from("invitations")
        .update(restorePatch)
        .eq("id", invitationId)
        .eq("user_id", userId)
        .select("id, slug, status, lifecycle_status, event_status, payment_status, published_at")
        .single();

    if (updateError || !updatedInvite) {
        throw new Error(updateError?.message || "Failed to restore invitation");
    }

    return {
        id: updatedInvite.id,
        slug: updatedInvite.slug,
        status: updatedInvite.status,
        lifecycleStatus: updatedInvite.lifecycle_status,
        eventStatus: updatedInvite.event_status,
        paymentStatus: updatedInvite.payment_status,
        publishedAt: updatedInvite.published_at,
        publicUrl: getPublicInvitationUrl(updatedInvite.slug),
        restored: true,
    };
}

export function isSuccessfulPublishEntitlement(payment: PublishEntitlementPayment | null | undefined) {
    if (!payment) return false;
    if (payment.refund_state === "pending" || payment.refund_state === "processed") return false;
    if (payment.status === "refund_pending" || payment.status === "refunded" || payment.status === "partially_refunded") return false;

    return payment.status === "paid" ||
        payment.status === "published" ||
        (payment.payment_state === "captured" && payment.publish_state === "published");
}

export function getOfflineRestoreBlocker(
    invitation: OfflineRestoreInvitationState,
    options: {
        isFreeTemplate: boolean;
        entitlement?: PublishEntitlementPayment | null;
        now?: Date;
    }
) {
    if (isInvitationCompleted({
        eventDate: invitation.event_date,
        eventTime: invitation.event_time,
        eventTimezone: invitation.event_timezone,
        status: invitation.status,
        lifecycleStatus: invitation.lifecycle_status,
        eventStatus: invitation.event_status,
        first_published_at: invitation.first_published_at,
        published_at: invitation.published_at,
    }, options.now)) {
        return "Invitation is completed and locked.";
    }

    if (!hasFinalizedPublishState(invitation)) {
        return "Payment required: Please complete payment before publishing";
    }

    if (!options.isFreeTemplate && !isSuccessfulPublishEntitlement(options.entitlement)) {
        return "Payment required: Please complete payment before publishing";
    }

    return null;
}

function hasFinalizedPublishState(invitation: Pick<RestoreInvitationRow, "first_published_at" | "published_at">) {
    return Boolean(invitation.first_published_at || invitation.published_at);
}

async function getSuccessfulPublishEntitlement({
    supabase,
    userId,
    invitationId,
    templateId,
    firstPaymentId,
}: {
    supabase: ReturnType<typeof createAdminClient>;
    userId: string;
    invitationId: string;
    templateId: string | null;
    firstPaymentId: string | null;
}) {
    let paymentQuery = supabase
        .from("payments")
        .select("id, user_id, invitation_id, template_id, status, payment_state, publish_state, recovery_state, refund_state, paid_at, provider_payment_id")
        .eq("invitation_id", invitationId)
        .eq("user_id", userId);

    if (templateId) {
        paymentQuery = paymentQuery.eq("template_id", templateId);
    }

    const { data: payments, error } = await paymentQuery;
    if (error) {
        throw new Error(error.message || "Payment entitlement could not be verified");
    }

    const candidates = ((payments || []) as PublishEntitlementPayment[])
        .filter((payment) => !firstPaymentId || payment.id === firstPaymentId || payment.invitation_id === invitationId);

    return candidates.find(isSuccessfulPublishEntitlement) || null;
}

async function buildPublishPatch({
    supabase,
    userId,
    invitationId,
    paymentId,
    customSlug,
}: {
    supabase: ReturnType<typeof createAdminClient>;
    userId: string;
    invitationId: string;
    paymentId: string;
    customSlug?: string;
}) {
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
        throw new Error("Invitation is completed and locked.");
    }

    if (invite.status === "published" && invite.first_published_at) {
        return {
            slug: invite.slug,
            status: "published",
            lifecycle_status: "published",
            event_status: "published",
            published_at: invite.published_at || new Date().toISOString(),
            first_published_at: invite.first_published_at,
            first_payment_id: invite.first_payment_id || paymentId,
            publish_version: invite.publish_version || 1,
            first_publish_version: invite.first_publish_version || 1,
            payment_status: "paid",
            updated_at: new Date().toISOString(),
        };
    }

    if (!invite.title?.trim()) throw new Error("Title is required to publish");
    if (!invite.primary_name?.trim()) throw new Error("Host/Couple name is required to publish");
    if (!invite.event_date) throw new Error("Event date is required to publish");
    if (!invite.event_time?.trim()) throw new Error("Event time is required to publish");
    if (!invite.venue_name?.trim()) throw new Error("Venue name is required to publish");
    if (!invite.phone?.trim()) throw new Error("Primary phone is required to publish");
    if (invite.phone.length !== 10) throw new Error("Primary phone must be 10 digits");
    if (!invite.secondary_phone?.trim()) throw new Error("Secondary phone is required to publish");
    if (invite.secondary_phone.length !== 10) throw new Error("Secondary phone must be 10 digits");
    if (!invite.message?.trim()) throw new Error("Invitation message is required to publish");

    const template = invite.invitation_templates;
    const templateId = invite.template_id || template?.id || null;
    if (!templateId) {
        throw new Error("Template entitlement could not be verified");
    }

    const hasPublishedIdentity = Boolean(invite.first_published_at);
    const readableSlugOverride = getReadableSlugOverride(customSlug, invite.slug);
    let finalSlug = hasPublishedIdentity
        ? invite.slug
        : buildInvitationSlug(readableSlugOverride || getInvitationReadableName(invite), invitationId);

    if (!hasPublishedIdentity) {
        const isAvailable = await isSlugAvailable(finalSlug, invitationId);
        if (!isAvailable) {
            finalSlug = buildInvitationSlug(readableSlugOverride || getInvitationReadableName(invite), invitationId, 80, 12);
            const fallbackAvailable = await isSlugAvailable(finalSlug, invitationId);
            if (!fallbackAvailable) {
                throw new Error("SLUG_GENERATION_FAILED");
            }
        }
    }

    const firstPublishedAt = invite.first_published_at || new Date().toISOString();
    const originalCategory = hasPublishedIdentity ? invite.original_category || invite.category : invite.category;
    const originalPrimaryName = hasPublishedIdentity ? invite.original_primary_name || invite.primary_name : invite.primary_name;
    const originalSecondaryName = hasPublishedIdentity ? invite.original_secondary_name || invite.secondary_name : invite.secondary_name;
    const originalEventDate = hasPublishedIdentity ? invite.original_event_date || invite.event_date : invite.event_date;
    const originalTemplateId = hasPublishedIdentity ? invite.original_template_id || templateId : templateId;
    const nextPublishVersion = (invite.publish_version || 0) + 1;
    const firstPublishVersion = invite.first_publish_version || nextPublishVersion;
    const identityFingerprint = invite.identity_fingerprint || generateEventFingerprint({
        category: originalCategory,
        primaryName: originalPrimaryName,
        secondaryName: originalSecondaryName,
        eventDate: originalEventDate || "",
        userId,
        templateId: originalTemplateId || "",
    });

    const storedSnapshot = hasPublishedIdentity ? (invite.identity_snapshot || invite.event_snapshot) as EventIdentitySnapshot | null : null;
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
        first_payment_id: paymentId,
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

    return {
        slug: finalSlug,
        status: "published",
        lifecycle_status: "published",
        event_status: "published",
        published_at: invite.published_at || new Date().toISOString(),
        first_published_at: firstPublishedAt,
        first_payment_id: invite.first_payment_id || paymentId,
        publish_version: nextPublishVersion,
        first_publish_version: firstPublishVersion,
        payment_status: "paid",
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
}

function isSchemaCacheColumnError(error: { code?: string; message?: string } | null) {
    return error?.code === "PGRST204" || !!error?.message?.includes("schema cache");
}

function isUniqueSlugViolation(error: { code?: string; message?: string } | null) {
    return error?.code === "23505" && (error.message || "").toLowerCase().includes("slug");
}

function getReadableSlugOverride(customSlug: string | undefined, existingSlug: string | null | undefined) {
    const cleanSlug = customSlug?.toLowerCase().trim();
    if (!cleanSlug || cleanSlug === existingSlug) return "";

    const readableSlug = slugifyInvitationText(cleanSlug);
    if (!readableSlug) {
        throw new Error("Invalid slug format");
    }
    return readableSlug;
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
