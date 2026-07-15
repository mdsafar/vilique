import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpaySignature, razorpay } from "@/lib/razorpay";
import { publishInvitationAfterPayment } from "@/features/invitations/publish";
import { getPublicInvitationUrl } from "@/lib/config/site";
import { Json } from "@/types/database";

const verifyInputSchema = z.object({
    invitationId: z.string().uuid(),
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
    slug: z.string().optional(),
});

export async function POST(request: Request) {
    try {
        // 1. Authenticate user
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Validate payload
        const body = await request.json().catch(() => ({}));
        const validation = verifyInputSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: "Invalid verification details provided" }, { status: 400 });
        }

        const {
            invitationId,
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
            slug: customSlug,
        } = validation.data;

        // 3-4. Fetch the local payment by provider_order_id and confirm details
        const supabaseAdmin = createAdminClient();
        const { data: localPayment, error: paymentError } = await supabaseAdmin
            .from("payments")
            .select("*")
            .eq("provider_order_id", orderId)
            .maybeSingle();

        if (paymentError || !localPayment) {
            return NextResponse.json({ error: "Order payment record not found" }, { status: 404 });
        }

        if (localPayment.user_id !== user.id || localPayment.invitation_id !== invitationId) {
            return NextResponse.json({ error: "Unauthorized operation or invitation mismatch" }, { status: 403 });
        }

        // Fetch invitation to check status (if already published or archived)
        const { data: invite } = await supabaseAdmin
            .from("invitations")
            .select("status, slug")
            .eq("id", invitationId)
            .maybeSingle();

        if (!invite) {
            return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
        }

        // Idempotency: a paid payment belongs only to this invitation. If it is already
        // published, return the existing link; otherwise retry publishing this invitation.
        if (localPayment.status === "paid") {
            if (invite.status !== "published") {
                const publishResult = await publishInvitationAfterPayment({
                    userId: user.id,
                    invitationId,
                    customSlug,
                });

                return NextResponse.json({
                    status: "success",
                    publicUrl: publishResult.publicUrl,
                    slug: publishResult.slug,
                });
            }

            const publicUrl = getPublicInvitationUrl(invite.slug);
            return NextResponse.json({
                status: "success",
                publicUrl,
                slug: invite.slug,
            });
        }

        // 5. Recreate expected signature and verify with timing-safe method
        const isSignatureValid = verifyRazorpaySignature(orderId, paymentId, signature);
        if (!isSignatureValid) {
            console.error(`Invalid payment signature for order: ${orderId}, payment: ${paymentId}`);
            return NextResponse.json({ error: "Payment verification signature failed" }, { status: 400 });
        }

        // 6-7. Fetch the payment details from Razorpay API to confirm details
        let providerPayment;
        try {
            providerPayment = await razorpay.payments.fetch(paymentId);
        } catch (fetchError) {
            console.error(`Failed to fetch payment details from Razorpay for id ${paymentId}:`, fetchError);
            return NextResponse.json({ error: "Failed to confirm payment details with provider" }, { status: 502 });
        }

        if (
            providerPayment.order_id !== orderId ||
            providerPayment.amount !== localPayment.amount_paise ||
            providerPayment.currency !== localPayment.currency
        ) {
            console.error("Razorpay payment details do not match local database records:", {
                orderId: providerPayment.order_id,
                localOrderId: orderId,
                amount: providerPayment.amount,
                localAmount: localPayment.amount_paise,
                currency: providerPayment.currency,
                localCurrency: localPayment.currency,
            });
            return NextResponse.json({ error: "Payment details mismatch" }, { status: 400 });
        }

        if (providerPayment.status !== "captured" && providerPayment.status !== "authorized") {
            console.error(`Payment ${paymentId} is not in captured or authorized status: ${providerPayment.status}`);
            return NextResponse.json({ error: "Payment was not completed successfully" }, { status: 400 });
        }

        // 8. Update payment status to paid
        const { error: updatePaymentError } = await supabaseAdmin
            .from("payments")
            .update({
                provider_payment_id: paymentId,
                provider_signature: signature,
                status: "paid",
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: {
                    ...((localPayment.metadata as Record<string, Json>) || {}),
                    payment_details: providerPayment as unknown as Json,
                },
            })
            .eq("id", localPayment.id);

        if (updatePaymentError) {
            console.error("Error updating local payment record to paid:", updatePaymentError);
            return NextResponse.json({ error: "Failed to record transaction status" }, { status: 500 });
        }

        const { error: markInvitationPaidError } = await supabaseAdmin
            .from("invitations")
            .update({
                payment_status: "paid",
                first_payment_id: localPayment.id,
                updated_at: new Date().toISOString(),
            })
            .eq("id", invitationId)
            .eq("user_id", user.id);

        if (markInvitationPaidError) {
            console.error("Payment was recorded but invitation entitlement was not updated:", markInvitationPaidError);
        }

        // 9. Call atomic publishing service
        try {
            const publishResult = await publishInvitationAfterPayment({
                userId: user.id,
                invitationId,
                customSlug,
            });

            return NextResponse.json({
                status: "success",
                publicUrl: publishResult.publicUrl,
                slug: publishResult.slug,
            });
        } catch (publishErr: unknown) {
            console.error("Verification marked payment as PAID but publishing service failed:", publishErr);
            // Re-verify that payment is still recorded as PAID. Return success block indicating recovery required.
            return NextResponse.json({
                status: "paymentPaidPublishFailed",
                error: "Payment completed, but publishing is not ready yet.",
                message: "Your payment was verified. However, we could not launch your invitation yet. Please click Publish Now to retry.",
            });
        }
    } catch (err: unknown) {
        console.error("Unhandled error verifying Razorpay payment:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
