import { NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishInvitationAfterPayment } from "@/features/invitations/publish";
import { Json } from "@/types/database";

type RazorpayEntity = {
    id?: string;
    order_id?: string;
    payment_id?: string;
    amount?: number;
    error_code?: string;
    error_description?: string;
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

export async function POST(request: Request) {
    try {
        const signature = request.headers.get("x-razorpay-signature");
        if (!signature) {
            console.error("Missing x-razorpay-signature header");
            return NextResponse.json({ error: "Missing signature" }, { status: 400 });
        }

        // Read the raw request body for verification
        const rawBody = await request.text();

        // Verify the webhook signature using RAZORPAY_WEBHOOK_SECRET
        const isValid = verifyRazorpayWebhookSignature(rawBody, signature);
        if (!isValid) {
            console.error("Invalid Razorpay webhook signature");
            return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
        }

        // Parse the body
        const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
        const eventId = payload.id;
        const eventType = payload.event;

        if (!eventId || !eventType) {
            return NextResponse.json({ error: "Invalid payload layout" }, { status: 400 });
        }

        const supabaseAdmin = createAdminClient();

        // 1. Idempotency Check: Store webhook event in webhook_events table
        const { data: insertedEvent, error: insertError } = await supabaseAdmin
            .from("webhook_events")
            .insert({
                provider: "razorpay",
                provider_event_id: eventId,
                event_type: eventType,
                payload: payload as Json,
                processing_status: "pending",
            })
            .select()
            .single();

        if (insertError) {
            // Check for duplicate key violation
            if (insertError.code === "23505") {
                console.log(`Duplicate webhook event detected and ignored: ${eventId}`);
                return NextResponse.json({ received: true, duplicate: true });
            }
            console.error("Failed to log webhook event in audit logs:", insertError);
            return NextResponse.json({ error: "Database error logging event" }, { status: 500 });
        }

        // 2. Process webhook event
        try {
            if (eventType === "order.paid" || eventType === "payment.captured") {
                const entity = eventType === "order.paid" ? payload.payload?.order?.entity : payload.payload?.payment?.entity;
                if (!entity) throw new Error("Missing payment/order entity");
                const orderId = eventType === "order.paid" ? entity.id : entity.order_id;
                const paymentId = eventType === "order.paid" ? null : entity.id;

                if (orderId) {
                    // Fetch local payment record
                    const { data: localPayment } = await supabaseAdmin
                        .from("payments")
                        .select("*")
                        .eq("provider_order_id", orderId)
                        .maybeSingle();

                    if (localPayment) {
                        // If not already paid, update to paid
                        if (localPayment.status !== "paid") {
                            const { error: updatePaymentError } = await supabaseAdmin
                                .from("payments")
                                .update({
                                    status: "paid",
                                    provider_payment_id: paymentId || localPayment.provider_payment_id,
                                    paid_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString(),
                                    metadata: {
                                        ...((localPayment.metadata as Record<string, Json>) || {}),
                                        webhook_details: payload as Json,
                                    },
                                })
                                .eq("id", localPayment.id);

                            if (updatePaymentError) {
                                throw new Error(`Failed to update local payment status: ${updatePaymentError.message}`);
                            }

                            // Reconcile and publish invitation atomically
                            try {
                                await publishInvitationAfterPayment({
                                    userId: localPayment.user_id,
                                    invitationId: localPayment.invitation_id,
                                });
                                console.log(`Successfully reconciled and published invitation ${localPayment.invitation_id} via webhook event ${eventId}`);
                            } catch (publishError: unknown) {
                                // Keep payment status as paid, but log the error (user can manually retry publishing)
                                const message = publishError instanceof Error ? publishError.message : "Unknown publish error";
                                console.error(`Webhook reconciled payment to paid, but publishing failed: ${message}`);
                            }
                        }
                    } else {
                        console.warn(`Webhook received capture event for unknown local order id: ${orderId}`);
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
                        const newStatus = amountRefunded >= localPayment.amount_paise ? "refunded" : "partially_refunded";
                        await supabaseAdmin
                            .from("payments")
                            .update({
                                status: newStatus,
                                refunded_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                                metadata: {
                                    ...((localPayment.metadata as Record<string, Json>) || {}),
                                    refund_details: payload as Json,
                                },
                            })
                            .eq("id", localPayment.id);

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
            }

            // 3. Mark webhook event as processed
            await supabaseAdmin
                .from("webhook_events")
                .update({
                    processing_status: "processed",
                    processed_at: new Date().toISOString(),
                })
                .eq("id", insertedEvent.id);

            return NextResponse.json({ received: true });
        } catch (processError: unknown) {
            console.error(`Error processing webhook event: ${eventId}`, processError);
            const message = processError instanceof Error ? processError.message : "Processing error";

            await supabaseAdmin
                .from("webhook_events")
                .update({
                    processing_status: "failed",
                    error_message: message,
                })
                .eq("id", insertedEvent.id);

            // Return 500 so Razorpay retries if it's a temporary database connection crash
            return NextResponse.json({ error: "Event processing failed" }, { status: 500 });
        }
    } catch (err: unknown) {
        console.error("Webhook route unhandled crash:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
