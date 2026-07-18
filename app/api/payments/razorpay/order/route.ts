import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/observability";
import { razorpay } from "@/lib/razorpay";
import { Json } from "@/types/database";
import { isInvitationCompleted } from "@/lib/lifecycle";
import { buildInvitationSlug, getInvitationReadableName, isSlugAvailable, slugifyInvitationText } from "@/features/invitations/slug";
import crypto from "crypto";
import { looseSupabase } from "@/lib/supabase/loose";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/security/requestGuard";

const orderInputSchema = z.object({
    invitationId: z.string().uuid(),
    slug: z.string().optional(),
});

export async function POST(request: Request) {
    let body: unknown = null;
    try {
        if (process.env.PAYMENTS_ENABLED === "false") {
            return NextResponse.json({
                error: "Payments are temporarily unavailable. Existing published invitations remain accessible.",
            }, { status: 503 });
        }

        // Validate required environment variables
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keyId || !keySecret) {
            console.error("Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET env variables");
            return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
        }

        // 1. Authenticate user
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const limit = await rateLimit({
            key: `payment-order:${user.id}:${getClientIp(request)}`,
            limit: 6,
            windowMs: 10 * 60 * 1000,
        });
        if (!limit.ok) {
            return rateLimitResponse(limit.resetAt);
        }

        // 2. Validate input
        body = await request.json().catch(() => ({}));
        const validation = orderInputSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: "Invalid invitation ID" }, { status: 400 });
        }
        const { invitationId, slug: customSlug } = validation.data;

        // 3-6. Fetch invitation and confirm ownership
        const { data: invite, error: inviteError } = await supabase
            .from("invitations")
            .select("*, invitation_templates(*)")
            .eq("id", invitationId)
            .eq("user_id", user.id)
            .maybeSingle();

        if (inviteError || !invite) {
            return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
        }

        if (invite.status === "archived") {
            return NextResponse.json({ error: "Cannot process payment for archived invitations" }, { status: 400 });
        }

        const template = invite.invitation_templates;
        if (!template) {
            return NextResponse.json({ error: "Template not found" }, { status: 400 });
        }

        const preflightError = await getPublishPreflightError({
            invite,
            invitationId,
            customSlug,
        });
        if (preflightError) {
            return NextResponse.json({ error: getSafePreflightError(preflightError) }, { status: 400 });
        }

        const amountPaise = template.price_paise;
        const currency = template.currency || "INR";

        // 7. Check if already paid
        const supabaseAdmin = createAdminClient();
        const looseAdmin = looseSupabase(supabaseAdmin);
        const { data: existingPaidPayment } = await looseAdmin
            .from("payments")
            .select("id")
            .eq("invitation_id", invitationId)
            .in("status", ["paid", "published"])
            .maybeSingle();

        if (existingPaidPayment) {
            return NextResponse.json({ status: "alreadyPaid" });
        }

        // 8. Check if free
        if (template.is_free) {
            return NextResponse.json({ status: "freePublish" });
        }

        // 9. Check for a reusable pending order created in the last 15 minutes
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data: reusablePayment } = await looseAdmin
            .from("payments")
            .select("*")
            .eq("invitation_id", invitationId)
            .eq("amount_paise", amountPaise)
            .eq("currency", currency)
            .in("status", ["created", "pending", "attempted"])
            .gt("created_at", fifteenMinutesAgo)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        const reusable = reusablePayment as {
            provider_order_id?: string;
            amount_paise?: number;
            currency?: string;
        } | null;

        if (reusable?.provider_order_id) {
            console.log(`Reusing pending order ${reusable.provider_order_id} for invitation ${invitationId}`);
            return NextResponse.json({
                status: "orderCreated",
                orderId: reusable.provider_order_id,
                amount: reusable.amount_paise,
                currency: reusable.currency,
                keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || keyId,
                name: "Vilique Premium Publication",
                description: `Publishing: ${template.name}`,
            });
        }

        // 10. Create Razorpay order
        const receipt = `rcpt_${crypto.randomUUID().slice(0, 16)}`;
        let order;
        try {
            order = await razorpay.orders.create({
                amount: amountPaise,
                currency: currency,
                receipt: receipt,
                notes: {
                    invitation_id: invitationId,
                    user_id: user.id,
                    template_id: template.id,
                },
            });
        } catch (razorpayError) {
            console.error("Razorpay order creation error:", razorpayError);
            reportError(razorpayError, "payment.razorpay_order_failed", { invitationId });
            return NextResponse.json({ error: "Failed to create payment order with Razorpay" }, { status: 502 });
        }

        // 11. Store local payment row
        const { data: insertedPayment, error: insertError } = await looseAdmin
            .from("payments")
            .insert({
                user_id: user.id,
                invitation_id: invitationId,
                template_id: template.id,
                provider: "razorpay",
                provider_order_id: order.id,
                amount_paise: amountPaise,
                currency: currency,
                status: "created",
                payment_state: "created",
                publish_state: "draft",
                recovery_state: "none",
                refund_state: "none",
                receipt: receipt,
                metadata: order as unknown as Json,
            })
            .select("id")
            .single();

        if (insertError) {
            console.error("Failed to insert payment record in DB:", insertError);
            reportError(insertError, "payment.insert_failed", { invitationId, orderId: order.id });
            return NextResponse.json({ error: "Database registration failure" }, { status: 500 });
        }

        const paymentId = typeof insertedPayment === "object" && insertedPayment && "id" in insertedPayment
            ? String(insertedPayment.id)
            : "";

        if (paymentId) {
            const { error: policyError } = await looseAdmin
                .from("policy_acceptances")
                .insert({
                    user_id: user.id,
                    invitation_id: invitationId,
                    payment_id: paymentId,
                    terms_version: "2026-07-15",
                    refund_policy_version: "2026-07-15",
                });

            if (policyError) {
                console.error("Failed to record payment policy acceptance:", policyError);
                reportError(policyError, "payment.policy_record_failed", { invitationId, paymentId });
                return NextResponse.json({ error: "Could not record policy acceptance" }, { status: 500 });
            }
        }

        // 12. Return safe checkout details
        return NextResponse.json({
            status: "orderCreated",
            orderId: order.id,
            amount: amountPaise,
            currency: currency,
            keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || keyId,
            name: "Vilique Premium Publication",
            description: `Publishing: ${template.name}`,
        });
    } catch (err: unknown) {
        console.error("Unhandled error creating Razorpay order:", err);
        const invitationId = body && typeof body === "object" && "invitationId" in body ? String(body.invitationId) : undefined;
        reportError(err, "payment.order_unhandled", { invitationId });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

function getSafePreflightError(error: string) {
    if (error === "SLUG_GENERATION_FAILED") {
        return "We could not create a unique public link. Please try again.";
    }
    return error;
}

async function getPublishPreflightError({
    invite,
    invitationId,
    customSlug,
}: {
    invite: {
        status?: string | null;
        lifecycle_status?: string | null;
        event_status?: string | null;
        event_date?: string | null;
        event_time?: string | null;
        event_timezone?: string | null;
        first_published_at?: string | null;
        published_at?: string | null;
        title?: string | null;
        primary_name?: string | null;
        venue_name?: string | null;
        phone?: string | null;
        secondary_phone?: string | null;
        message?: string | null;
        slug?: string | null;
    };
    invitationId: string;
    customSlug?: string;
}) {
    if (invite.status === "archived" || invite.lifecycle_status === "archived") {
        return "Cannot publish an archived invitation";
    }

    if (isInvitationCompleted({
        eventDate: invite.event_date ?? null,
        eventTime: invite.event_time ?? null,
        eventTimezone: invite.event_timezone ?? null,
        status: invite.status ?? null,
        lifecycleStatus: invite.lifecycle_status ?? null,
        eventStatus: invite.event_status ?? null,
        first_published_at: invite.first_published_at ?? null,
        published_at: invite.published_at ?? null,
    })) {
        return "This invitation is completed and can no longer be published.";
    }

    if (!invite.title?.trim()) return "Title is required to publish";
    if (!invite.primary_name?.trim()) return "Host/Couple name is required to publish";
    if (!invite.event_date) return "Event date is required to publish";
    if (!invite.event_time?.trim()) return "Event time is required to publish";
    if (!invite.venue_name?.trim()) return "Venue name is required to publish";
    if (!invite.phone?.trim()) return "Primary phone is required to publish";
    if (invite.phone.length !== 10) return "Primary phone must be 10 digits";
    if (!invite.secondary_phone?.trim()) return "Secondary phone is required to publish";
    if (invite.secondary_phone.length !== 10) return "Secondary phone must be 10 digits";
    if (!invite.message?.trim()) return "Invitation message is required to publish";

    if (!invite.first_published_at) {
        const cleanSlug = customSlug?.toLowerCase().trim();
        const readableSlug = cleanSlug && cleanSlug !== invite.slug ? slugifyInvitationText(cleanSlug) : "";
        if (cleanSlug && cleanSlug !== invite.slug && !readableSlug) {
            return "Invalid slug format";
        }

        const finalSlug = buildInvitationSlug(readableSlug || getInvitationReadableName(invite), invitationId);
        const available = await isSlugAvailable(finalSlug, invitationId);
        if (!available) {
            const fallbackSlug = buildInvitationSlug(readableSlug || getInvitationReadableName(invite), invitationId, 80, 12);
            const fallbackAvailable = await isSlugAvailable(fallbackSlug, invitationId);
            if (!fallbackAvailable) return "SLUG_GENERATION_FAILED";
        }
    }

    return "";
}
