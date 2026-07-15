import { createAdminClient } from "@/lib/supabase/admin";
import { looseSupabase } from "@/lib/supabase/loose";
import { razorpay } from "@/lib/razorpay";
import { getRefundEligibility } from "@/lib/payments/refundPolicy";
import { Json } from "@/types/database";
import { logEvent, reportError } from "@/lib/observability";

type RefundClaimResult = {
    status: "processing" | "pending" | "processed" | "failed" | "manual_review";
    claimed: boolean;
    payment_id: string;
    refund_request_id: string;
    provider_payment_id?: string | null;
    provider_refund_id?: string | null;
    amount_paise: number;
    currency: string;
};

type RazorpayRefund = {
    id: string;
    payment_id?: string;
    amount?: number;
    currency?: string;
    status?: string;
    created_at?: number;
};

type RazorpayPaymentsWithRefund = {
    refund: (paymentId: string, params: {
        amount: number;
        speed?: "normal" | "optimum";
        notes?: Record<string, string>;
        receipt?: string;
    }) => Promise<RazorpayRefund>;
    fetchRefund: (paymentId: string, refundId: string) => Promise<RazorpayRefund>;
};

type RazorpayRefundsResource = {
    fetch: (refundId: string, params?: { payment_id?: string }) => Promise<RazorpayRefund>;
};

export type InitiateRefundInput = {
    paymentId: string;
    actorId?: string | null;
    actorType: "admin" | "system" | "cron";
    publicReason?: string;
    manualApproval?: boolean;
};

export async function initiateUnrecoverablePublishRefund({
    paymentId,
    actorId = null,
    actorType,
    publicReason = "Refund issued because the paid invitation could not be published after recovery attempts.",
    manualApproval = false,
}: InitiateRefundInput) {
    const admin = createAdminClient();
    const claimEligibility = await loadRefundEligibility(admin, paymentId, manualApproval);
    if (!claimEligibility.eligible) {
        return {
            status: "not_eligible" as const,
            reason: claimEligibility.reason,
        };
    }

    const { data, error } = await looseSupabase(admin).rpc("claim_unrecoverable_publish_refund", {
        p_payment_id: paymentId,
        p_requested_by: actorId,
        p_requested_source: actorType,
        p_public_reason: publicReason,
        p_manual_approval: manualApproval,
    });

    if (error) {
        throw new Error(error.message || "Could not claim refund request");
    }

    const claim = data as RefundClaimResult;
    if (!claim.claimed) {
        return {
            status: claim.status,
            idempotent: true,
            refundRequestId: claim.refund_request_id,
            providerRefundId: claim.provider_refund_id || null,
        };
    }

    try {
        if (!claim.provider_payment_id) {
            throw new Error("Missing provider payment id for refund");
        }

        const refund = await (razorpay.payments as unknown as RazorpayPaymentsWithRefund).refund(claim.provider_payment_id, {
            amount: claim.amount_paise,
            speed: "normal",
            receipt: `refund_${claim.payment_id.slice(0, 18)}`,
            notes: {
                payment_id: claim.payment_id,
                refund_request_id: claim.refund_request_id,
                reason: "failed_publication_unrecoverable",
            },
        });

        if (refund.payment_id && refund.payment_id !== claim.provider_payment_id) {
            throw new Error("Provider refund payment mismatch");
        }
        if (typeof refund.amount === "number" && refund.amount !== claim.amount_paise) {
            throw new Error("Provider refund amount mismatch");
        }

        const { error: markError } = await looseSupabase(admin).rpc("mark_refund_provider_created", {
            p_refund_request_id: claim.refund_request_id,
            p_provider_refund_id: refund.id,
            p_provider_payload: refund as unknown as Json,
            p_provider_status: refund.status || "pending",
        });

        if (markError) {
            throw new Error(markError.message || "Could not persist provider refund");
        }

        logEvent("info", "refund.initiated", {
            paymentId,
            refundRequestId: claim.refund_request_id,
            providerRefundId: refund.id,
            providerStatus: refund.status || "pending",
        });

        return {
            status: refund.status === "processed" ? "processed" as const : "pending" as const,
            idempotent: false,
            refundRequestId: claim.refund_request_id,
            providerRefundId: refund.id,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Refund provider call failed";
        reportError(error, "refund.initiation_failed", { paymentId, refundRequestId: claim.refund_request_id });
        await looseSupabase(admin).rpc("mark_refund_provider_failed", {
            p_refund_request_id: claim.refund_request_id,
            p_error: message,
        });
        throw error;
    }
}

export async function reconcileProviderRefund(input: {
    paymentId: string;
    providerPaymentId: string;
    providerRefundId: string;
    refundRequestId?: string | null;
}) {
    const admin = createAdminClient();
    const refund = await fetchProviderRefund(input.providerPaymentId, input.providerRefundId);

    if (refund.payment_id && refund.payment_id !== input.providerPaymentId) {
        throw new Error("Provider refund payment mismatch");
    }

    const refundRequestId = input.refundRequestId || await findRefundRequestId(admin, input.paymentId);
    if (!refundRequestId) {
        throw new Error("Refund request not found");
    }

    const { error } = await looseSupabase(admin).rpc("mark_refund_provider_created", {
        p_refund_request_id: refundRequestId,
        p_provider_refund_id: refund.id,
        p_provider_payload: refund as unknown as Json,
        p_provider_status: refund.status || "pending",
    });

    if (error) {
        throw new Error(error.message || "Could not reconcile provider refund");
    }

    return refund;
}

async function fetchProviderRefund(providerPaymentId: string, providerRefundId: string) {
    const payments = razorpay.payments as unknown as RazorpayPaymentsWithRefund;
    if (typeof payments.fetchRefund === "function") {
        return payments.fetchRefund(providerPaymentId, providerRefundId);
    }
    return (razorpay.refunds as unknown as RazorpayRefundsResource).fetch(providerRefundId, { payment_id: providerPaymentId });
}

async function findRefundRequestId(admin: unknown, paymentId: string) {
    const { data, error } = await looseSupabase(admin)
        .from("payment_refund_requests")
        .select("id")
        .eq("payment_id", paymentId)
        .maybeSingle();

    if (error || !data || typeof data !== "object" || !("id" in data)) {
        return null;
    }
    return String(data.id);
}

async function loadRefundEligibility(admin: unknown, paymentId: string, manualApproval: boolean) {
    const { data, error } = await looseSupabase(admin)
        .from("payments")
        .select(`
            id,
            status,
            payment_state,
            publish_state,
            recovery_state,
            refund_state,
            provider_payment_id,
            provider_refund_id,
            invitation_id,
            invitations (
                status,
                published_at,
                first_published_at
            )
        `)
        .eq("id", paymentId)
        .maybeSingle();

    if (error || !data) {
        return { eligible: false, reason: "PAYMENT_NOT_FOUND" };
    }

    const payment = data as {
        status?: string;
        payment_state?: string | null;
        publish_state?: string | null;
        recovery_state?: string | null;
        refund_state?: string | null;
        provider_payment_id?: string | null;
        provider_refund_id?: string | null;
        invitations?: { status?: string | null; published_at?: string | null; first_published_at?: string | null } | { status?: string | null; published_at?: string | null; first_published_at?: string | null }[] | null;
    };
    const invitation = Array.isArray(payment.invitations) ? payment.invitations[0] : payment.invitations;
    const decision = getRefundEligibility({
        paymentCaptured: payment.payment_state === "captured" && Boolean(payment.provider_payment_id),
        invitationPublished: payment.publish_state === "published" || invitation?.status === "published",
        publicUrlWasAccessible: Boolean(invitation?.published_at || invitation?.first_published_at),
        failureCausedByVilique: payment.status === "manual_review" || payment.status === "recovery_pending",
        recoveryAttemptsExhausted: payment.recovery_state === "unrecoverable" || payment.recovery_state === "manual_review",
        unrecoverable: payment.recovery_state === "unrecoverable",
        alreadyRefunded: payment.refund_state === "processed" || Boolean(payment.provider_refund_id),
        manualApproval,
    });

    return decision;
}
