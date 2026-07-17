import { NextResponse } from "next/server";
import { razorpay, verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";
import { looseSupabase } from "@/lib/supabase/loose";
import { finalizePaidInvitationPublish } from "@/features/invitations/publish";
import { Json } from "@/types/database";
import { logEvent, reportError } from "@/lib/observability";

type RazorpayEntity = {
    id?: string;
    order_id?: string;
    payment_id?: string;
    amount?: number;
    status?: string;
    reason?: string;
    failure_reason?: string;
    error_code?: string;
    error_description?: string;
    error_reason?: string;
    error_source?: string;
    error_step?: string;
};

type RazorpayWebhookPayload = {
    id?: string;
    event?: string;
    payload?: {
        order?: { entity?: RazorpayEntity };
        payment?: { entity?: RazorpayEntity };
        refund?: { entity?: RazorpayEntity };
    };
};

type RazorpayOrdersWithPayments = {
    fetchPayments: (orderId: string) => Promise<{ items?: RazorpayEntity[] }>;
};

type ClaimedWebhookEvent = {
    id: string;
    provider_event_id: string;
    event_type: string;
    processing_status: "pending" | "processing" | "processed" | "failed" | "ignored" | "manual_review";
    attempt_count: number;
    claimed: boolean;
};

type RefundRequestLookup = {
    id: string;
    payment_id: string;
    status?: string | null;
    provider_refund_id?: string | null;
};

const PROCESSABLE_EVENT_TYPES = new Set([
    "order.paid",
    "payment.captured",
    "payment.authorized",
    "payment.failed",
    "refund.created",
    "refund.processed",
    "refund.failed",
]);

export async function POST(request: Request) {
    try {
        const signature =
            request.headers.get("x-razorpay-signature")?.trim() ?? "";

        if (!signature) {
            return NextResponse.json(
                { error: "Missing signature" },
                { status: 400 }
            );
        }
        const rawBody = await request.text();

        const isValid = verifyRazorpayWebhookSignature(rawBody, signature);
        if (!isValid) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
        }

        // Parse the body
        const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;

        const eventId =
            request.headers.get("x-razorpay-event-id")?.trim() ?? "";

        const eventType = payload.event;

        console.log("Webhook Event Debug", {
            eventId,
            eventType,
        });

        if (!eventId || !eventType) {
            console.error("Webhook Error: Invalid payload layout", {
                eventId,
                eventType,
            });

            return NextResponse.json(
                { error: "Invalid payload layout" },
                { status: 400 }
            );
        }

        const supabaseAdmin = createAdminClient();

        const { data: claimedEventsData, error: claimError } = await looseSupabase(supabaseAdmin)
            .rpc("claim_razorpay_webhook_event", {
                p_provider_event_id: eventId,
                p_event_type: eventType,
                p_payload: payload as Json,
            });
        const claimedEvents = claimedEventsData as ClaimedWebhookEvent[] | null;

        if (claimError) {
            reportError(new Error(claimError.message), "webhook.claim_failed", {
                eventId,
                eventType,
                message: claimError.message,
                code: claimError.code,
                details: claimError.details,
                hint: claimError.hint,
            });
            return NextResponse.json({ error: "Database error claiming event" }, { status: 500 });
        }

        if (!claimedEvents?.length) {
            reportError(new Error("Webhook event claim returned no rows"), "webhook.claim_failed", { eventId, eventType });
            return NextResponse.json({ error: "Database error claiming event" }, { status: 500 });
        }

        const claimedEvent = claimedEvents[0] as ClaimedWebhookEvent;

        if (!claimedEvent.claimed) {
            if (claimedEvent.processing_status === "processed" || claimedEvent.processing_status === "ignored") {
                logEvent("info", "webhook.already_completed", {
                    provider: "razorpay",
                    eventId,
                    eventType,
                    status: claimedEvent.processing_status,
                });
                return NextResponse.json({ received: true, status: claimedEvent.processing_status });
            }

            logEvent("warn", "webhook.not_claimed", {
                provider: "razorpay",
                eventId,
                eventType,
                status: claimedEvent.processing_status,
            });
            return NextResponse.json({ error: "Event is already being processed" }, { status: 409 });
        }

        try {
            if (!PROCESSABLE_EVENT_TYPES.has(eventType)) {
                await supabaseAdmin
                    .from("webhook_events")
                    .update({
                        processing_status: "ignored",
                        processed_at: new Date().toISOString(),
                    })
                    .eq("id", claimedEvent.id);

                logEvent("info", "webhook.ignored", { provider: "razorpay", eventId, eventType });
                return NextResponse.json({ received: true, status: "ignored" });
            } else if (eventType === "order.paid" || eventType === "payment.captured" || eventType === "payment.authorized") {
                const entity = eventType === "order.paid" ? payload.payload?.order?.entity : payload.payload?.payment?.entity;
                if (!entity) throw new Error("Missing payment/order entity");
                const orderId = eventType === "order.paid" ? entity.id : entity.order_id;
                let paymentId = eventType === "order.paid" ? null : entity.id;

                if (orderId) {
                    // Fetch local payment record
                    const { data: localPayment } = await supabaseAdmin
                        .from("payments")
                        .select("*")
                        .eq("provider_order_id", orderId)
                        .maybeSingle();

                    if (localPayment) {
                        if ((localPayment.status as string) === "published") {
                            logEvent("info", "webhook.payment_already_published", { eventId, paymentId: localPayment.id });
                        } else {
                            if (!paymentId) {
                                const orderPayments = await (razorpay.orders as unknown as RazorpayOrdersWithPayments).fetchPayments(orderId);
                                paymentId = orderPayments?.items?.find((item: RazorpayEntity) =>
                                    item.id && item.order_id === orderId
                                )?.id || null;
                            }

                            if (!paymentId) {
                                throw new Error(`Could not determine Razorpay payment id for order ${orderId}`);
                            }

                            const providerPayment = await razorpay.payments.fetch(paymentId);
                            if (
                                providerPayment.order_id !== orderId ||
                                providerPayment.amount !== localPayment.amount_paise ||
                                providerPayment.currency !== localPayment.currency
                            ) {
                                throw new Error(`Provider payment mismatch for order ${orderId}`);
                            }

                            if (providerPayment.status !== "captured" && providerPayment.status !== "authorized") {
                                throw new Error(`Provider payment ${paymentId} is not captured or authorized`);
                            }

                            const finalization = await finalizePaidInvitationPublish({
                                payment: localPayment,
                                providerPaymentId: paymentId,
                                providerStatus: providerPayment.status,
                                providerPayload: {
                                    webhook: payload,
                                    payment: providerPayment,
                                },
                                actorType: "webhook",
                                correlationId: eventId,
                            });

                            logEvent("info", "webhook.payment_finalized", { eventId, paymentId: localPayment.id, status: finalization.status });
                        }
                    } else {
                        logEvent("warn", "webhook.unknown_order", { eventId, orderId });
                    }
                }
            } else if (eventType === "payment.failed") {
                const paymentEntity = payload.payload?.payment?.entity;
                if (!paymentEntity) throw new Error("Missing payment entity");
                const orderId = paymentEntity.order_id;
                const failureCode = paymentEntity.error_code || "UNKNOWN";
                const failureDesc = paymentEntity.error_description || "Payment failed";

                if (orderId) {
                    const { data: localPayment } = await supabaseAdmin
                        .from("payments")
                        .select("*")
                        .eq("provider_order_id", orderId)
                        .maybeSingle();

                    if (localPayment && localPayment.status !== "paid") {
                        await supabaseAdmin
                            .from("payments")
                            .update({
                                status: "failed",
                                provider_payment_id: paymentEntity.id,
                                failure_code: failureCode,
                                failure_description: failureDesc,
                                updated_at: new Date().toISOString(),
                                metadata: {
                                    ...((localPayment.metadata as Record<string, Json>) || {}),
                                    webhook_details: payload as Json,
                                },
                            })
                            .eq("id", localPayment.id);
                    }
                }
            } else if (eventType === "refund.created" || eventType === "refund.processed") {
                const refundEntity = payload.payload?.refund?.entity;
                if (!refundEntity) throw new Error("Missing refund entity");
                const paymentId = refundEntity.payment_id;
                const amountRefunded = refundEntity.amount || 0;

                if (paymentId) {
                    const { data: localPayment } = await supabaseAdmin
                        .from("payments")
                        .select("*")
                        .eq("provider_payment_id", paymentId)
                        .maybeSingle();

                    if (localPayment) {
                        if (amountRefunded > localPayment.amount_paise) {
                            throw new Error(`Provider refund amount exceeds payment amount for ${paymentId}`);
                        }
                        const isProcessedRefund = eventType === "refund.processed";
                        const newStatus = isProcessedRefund
                            ? (amountRefunded >= localPayment.amount_paise ? "refunded" : "partially_refunded")
                            : "refund_pending";
                        const now = new Date().toISOString();
                        await supabaseAdmin
                            .from("payments")
                            .update({
                                status: newStatus,
                                payment_state: newStatus === "refunded" ? "refunded" : localPayment.payment_state,
                                refund_state: isProcessedRefund ? "processed" : "pending",
                                provider_refund_id: refundEntity.id || localPayment.provider_refund_id,
                                refund_requested_at: localPayment.refund_requested_at || now,
                                refund_processed_at: isProcessedRefund ? now : localPayment.refund_processed_at,
                                refunded_at: isProcessedRefund ? now : localPayment.refunded_at,
                                updated_at: now,
                                metadata: {
                                    ...((localPayment.metadata as Record<string, Json>) || {}),
                                    refund_details: payload as Json,
                                },
                            })
                            .eq("id", localPayment.id);

                        const { data: refundRequest } = await looseSupabase(supabaseAdmin)
                            .from("payment_refund_requests")
                            .select("id")
                            .eq("payment_id", localPayment.id)
                            .maybeSingle();

                        if (refundRequest && typeof refundRequest === "object" && "id" in refundRequest && refundEntity.id) {
                            await looseSupabase(supabaseAdmin).rpc("mark_refund_provider_created", {
                                p_refund_request_id: String(refundRequest.id),
                                p_provider_refund_id: refundEntity.id,
                                p_provider_payload: payload as Json,
                                p_provider_status: isProcessedRefund ? "processed" : "pending",
                            });
                        }

                        // If fully refunded, mark payment_status as refunded on the invitation
                        if (newStatus === "refunded") {
                            await supabaseAdmin
                                .from("invitations")
                                .update({
                                    payment_status: "refunded",
                                    updated_at: new Date().toISOString(),
                                })
                                .eq("id", localPayment.invitation_id);
                        }
                    }
                }
            } else if (eventType === "refund.failed") {
                const refundEntity = payload.payload?.refund?.entity;
                if (!refundEntity) throw new Error("Missing refund entity");

                const providerRefundId = refundEntity.id;
                const providerPaymentId = refundEntity.payment_id;
                const failure = getRefundFailureDetails(refundEntity);
                const now = new Date().toISOString();

                let localPayment = null;
                if (providerPaymentId) {
                    const { data, error } = await supabaseAdmin
                        .from("payments")
                        .select("*")
                        .eq("provider_payment_id", providerPaymentId)
                        .maybeSingle();

                    if (error) throw new Error(`Payment lookup failed for refund failure: ${error.message}`);
                    localPayment = data;
                }

                let refundRequest: RefundRequestLookup | null = null;
                if (providerRefundId) {
                    const { data, error } = await looseSupabase(supabaseAdmin)
                        .from("payment_refund_requests")
                        .select("id,payment_id,status,provider_refund_id")
                        .eq("provider_refund_id", providerRefundId)
                        .maybeSingle();

                    if (error) throw new Error(`Refund request lookup by provider refund id failed: ${error.message}`);
                    refundRequest = data as RefundRequestLookup | null;
                }

                if (!refundRequest && localPayment) {
                    const { data, error } = await looseSupabase(supabaseAdmin)
                        .from("payment_refund_requests")
                        .select("id,payment_id,status,provider_refund_id")
                        .eq("payment_id", localPayment.id)
                        .maybeSingle();

                    if (error) throw new Error(`Refund request lookup by payment id failed: ${error.message}`);
                    refundRequest = data as RefundRequestLookup | null;
                }

                if (!localPayment && refundRequest?.payment_id) {
                    const { data, error } = await supabaseAdmin
                        .from("payments")
                        .select("*")
                        .eq("id", refundRequest.payment_id)
                        .maybeSingle();

                    if (error) throw new Error(`Payment lookup by refund request failed: ${error.message}`);
                    localPayment = data;
                }

                if (!localPayment) {
                    logEvent("warn", "webhook.refund_failed_unknown_payment", {
                        eventId,
                        providerRefundId,
                        providerPaymentId,
                    });
                } else if (
                    localPayment.refund_state === "processed" ||
                    localPayment.status === "refunded" ||
                    refundRequest?.status === "processed"
                ) {
                    logEvent("warn", "webhook.refund_failed_after_processed_refund", {
                        eventId,
                        paymentId: localPayment.id,
                        refundRequestId: refundRequest?.id || null,
                        providerRefundId,
                        providerPaymentId,
                    });
                } else {
                    const paymentMetadata = ((localPayment.metadata as Record<string, Json>) || {});
                    const { error: paymentUpdateError } = await supabaseAdmin
                        .from("payments")
                        .update({
                            refund_state: "failed",
                            provider_refund_id: providerRefundId || localPayment.provider_refund_id,
                            next_refund_reconciliation_at: null,
                            last_error: failure.message,
                            updated_at: now,
                            metadata: {
                                ...paymentMetadata,
                                refund_failed_details: {
                                    provider_refund_id: providerRefundId || localPayment.provider_refund_id,
                                    provider_payment_id: providerPaymentId || localPayment.provider_payment_id,
                                    failure_reason: failure.reason,
                                    error_code: failure.errorCode,
                                    error_message: failure.message,
                                    webhook_payload: payload,
                                },
                            } as Json,
                        })
                        .eq("id", localPayment.id)
                        .neq("refund_state", "processed");

                    if (paymentUpdateError) {
                        throw new Error(`Failed to update payment for refund failure: ${paymentUpdateError.message}`);
                    }

                    if (refundRequest) {
                        const { error: refundRequestUpdateError } = await looseSupabase(supabaseAdmin)
                            .from("payment_refund_requests")
                            .update({
                                status: "failed",
                                provider_refund_id: providerRefundId || refundRequest.provider_refund_id,
                                provider_payload: {
                                    webhook_payload: payload,
                                    failure_reason: failure.reason,
                                    error_code: failure.errorCode,
                                    error_message: failure.message,
                                } as Json,
                                last_error: failure.message,
                                failed_at: now,
                            })
                            .eq("id", refundRequest.id)
                            .neq("status", "processed");

                        if (refundRequestUpdateError) {
                            throw new Error(`Failed to update refund request for refund failure: ${refundRequestUpdateError.message}`);
                        }
                    } else {
                        logEvent("warn", "webhook.refund_failed_missing_refund_request", {
                            eventId,
                            paymentId: localPayment.id,
                            providerRefundId,
                            providerPaymentId,
                        });
                    }

                    logEvent("info", "webhook.refund_failed_recorded", {
                        eventId,
                        paymentId: localPayment.id,
                        refundRequestId: refundRequest?.id || null,
                        providerRefundId,
                        providerPaymentId,
                        errorCode: failure.errorCode,
                    });
                }
            }

            await supabaseAdmin
                .from("webhook_events")
                .update({
                    processing_status: "processed",
                    processed_at: new Date().toISOString(),
                })
                .eq("id", claimedEvent.id);

            return NextResponse.json({ received: true });
        } catch (processError: unknown) {
            reportError(processError, "webhook.processing_failed", { eventId, eventType });
            const message = processError instanceof Error ? processError.message : "Processing error";

            await supabaseAdmin
                .from("webhook_events")
                .update({
                    processing_status: "failed",
                    failed_at: new Date().toISOString(),
                    last_error: message,
                    error_message: message,
                })
                .eq("id", claimedEvent.id);

            return NextResponse.json({ error: "Event processing failed" }, { status: 500 });
        }
    } catch (err: unknown) {
        reportError(err, "webhook.unhandled");
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

function getRefundFailureDetails(refundEntity: RazorpayEntity) {
    const reason =
        refundEntity.failure_reason ||
        refundEntity.error_reason ||
        refundEntity.reason ||
        refundEntity.error_description ||
        "Refund failed";
    const errorCode = refundEntity.error_code || refundEntity.error_reason || "REFUND_FAILED";
    const message = refundEntity.error_description || reason;

    return {
        reason,
        errorCode,
        message,
    };
}
