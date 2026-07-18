import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { razorpay } from "@/lib/razorpay";
import { finalizePaidInvitationPublish } from "@/features/invitations/publish";
import { looseSupabase } from "@/lib/supabase/loose";
import { reconcileProviderRefund } from "@/lib/payments/refunds";
import { logEvent, reportError } from "@/lib/observability";

type ReconciliationPayment = {
    id: string;
    user_id: string;
    invitation_id: string | null;
    template_id: string | null;
    provider_order_id: string | null;
    provider_payment_id: string | null;
    provider_refund_id?: string | null;
    refund_state?: string | null;
    refund_attempt_count?: number | null;
    status: string;
    next_reconciliation_at?: string | null;
    next_refund_reconciliation_at?: string | null;
    amount_paise: number;
    currency: string;
    publish_attempt_count?: number;
};

export async function POST(request: Request) {
    const runId = crypto.randomUUID();
    const expectedSecret = process.env.PAYMENT_RECONCILIATION_SECRET || process.env.CRON_SECRET;
    const providedSecret = request.headers.get("x-cron-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (!expectedSecret || providedSecret !== expectedSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const looseAdmin = looseSupabase(supabase);
    const { data: candidates, error } = await looseAdmin
        .from("payments")
        .select("*")
        .in("status", ["captured", "publish_pending", "recovery_pending", "manual_review", "refund_pending"])
        .neq("refund_state", "processed")
        .order("updated_at", { ascending: true })
        .limit(25);

    if (error) {
        console.error("Payment reconciliation candidate query failed:", error);
        reportError(error, "payment.reconciliation_candidate_query_failed");
        return NextResponse.json({ error: "Could not load reconciliation candidates" }, { status: 500 });
    }

    const results = [];

    for (const payment of (candidates as ReconciliationPayment[] | null) || []) {
        try {
            if (payment.refund_state === "pending" || payment.status === "refund_pending") {
                if (payment.next_refund_reconciliation_at && payment.next_refund_reconciliation_at > new Date().toISOString()) {
                    results.push({ paymentId: payment.id, status: "skipped", reason: "refund_not_due" });
                    continue;
                }
                if (!payment.provider_payment_id || !payment.provider_refund_id) {
                    results.push({ paymentId: payment.id, status: "skipped", reason: "missing_refund_identifiers" });
                    continue;
                }

                const providerRefund = await reconcileProviderRefund({
                    paymentId: payment.id,
                    providerPaymentId: payment.provider_payment_id,
                    providerRefundId: payment.provider_refund_id,
                });
                results.push({ paymentId: payment.id, status: providerRefund.status || "pending", kind: "refund" });
                continue;
            }

            if (payment.next_reconciliation_at && payment.next_reconciliation_at > new Date().toISOString()) {
                results.push({ paymentId: payment.id, status: "skipped", reason: "publish_not_due" });
                continue;
            }

            if (!payment.provider_payment_id) {
                results.push({ paymentId: payment.id, status: "skipped", reason: "missing_provider_payment_id" });
                continue;
            }

            const providerPayment = await razorpay.payments.fetch(payment.provider_payment_id);
            if (
                providerPayment.order_id !== payment.provider_order_id ||
                providerPayment.amount !== payment.amount_paise ||
                providerPayment.currency !== payment.currency
            ) {
                await looseAdmin
                    .from("payments")
                    .update({
                        status: "manual_review",
                        recovery_state: "manual_review",
                        last_error: "Provider mismatch during reconciliation",
                        last_reconciliation_at: new Date().toISOString(),
                    })
                    .eq("id", payment.id);
                results.push({ paymentId: payment.id, status: "manual_review" });
                continue;
            }

            const finalization = await finalizePaidInvitationPublish({
                payment,
                providerPaymentId: payment.provider_payment_id,
                providerStatus: providerPayment.status,
                providerPayload: providerPayment,
                actorType: "cron",
                correlationId: `reconcile:${payment.id}:${Date.now()}`,
            });

            results.push({ paymentId: payment.id, status: finalization.status });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Unknown reconciliation error";
            reportError(err, "payment.reconciliation_failed", { runId, paymentId: payment.id });
            const isRefund = payment.refund_state === "pending" || payment.status === "refund_pending";
            const attemptCount = isRefund ? (payment.refund_attempt_count || 0) : (payment.publish_attempt_count || 0);
            await looseAdmin
                .from("payments")
                .update({
                    status: isRefund ? (attemptCount >= 5 ? "manual_review" : "refund_pending") : (attemptCount >= 5 ? "manual_review" : "recovery_pending"),
                    recovery_state: attemptCount >= 5 ? "manual_review" : "pending",
                    refund_state: isRefund ? (attemptCount >= 5 ? "failed" : "pending") : payment.refund_state,
                    refund_attempt_count: isRefund ? attemptCount + 1 : payment.refund_attempt_count,
                    last_error: message,
                    last_reconciliation_at: new Date().toISOString(),
                    next_reconciliation_at: isRefund ? payment.next_reconciliation_at : new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                    next_refund_reconciliation_at: isRefund ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : payment.next_refund_reconciliation_at,
                })
                .eq("id", payment.id);
            results.push({ paymentId: payment.id, status: "failed", message });
        }
    }

    logEvent("info", "payment.reconciliation_completed", { runId, processed: results.length });
    return NextResponse.json({ ok: true, processed: results.length, results });
}
