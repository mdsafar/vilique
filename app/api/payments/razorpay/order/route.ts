import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { razorpay } from "@/lib/razorpay";
import crypto from "crypto";

const orderInputSchema = z.object({
    invitationId: z.string().uuid(),
});

export async function POST(request: Request) {
    try {
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

        // 2. Validate input
        const body = await request.json().catch(() => ({}));
        const validation = orderInputSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: "Invalid invitation ID" }, { status: 400 });
        }
        const { invitationId } = validation.data;

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

        const amountPaise = template.price_paise;
        const currency = template.currency || "INR";

        // 7. Check if already paid
        const supabaseAdmin = createAdminClient();
        const { data: existingPaidPayment } = await supabaseAdmin
            .from("payments")
            .select("id")
            .eq("invitation_id", invitationId)
            .eq("status", "paid")
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
        const { data: reusablePayment } = await supabaseAdmin
            .from("payments")
            .select("*")
            .eq("invitation_id", invitationId)
            .eq("amount_paise", amountPaise)
            .eq("currency", currency)
            .in("status", ["created", "attempted"])
            .gt("created_at", fifteenMinutesAgo)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (reusablePayment && reusablePayment.provider_order_id) {
            console.log(`Reusing pending order ${reusablePayment.provider_order_id} for invitation ${invitationId}`);
            return NextResponse.json({
                status: "orderCreated",
                orderId: reusablePayment.provider_order_id,
                amount: reusablePayment.amount_paise,
                currency: reusablePayment.currency,
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
            return NextResponse.json({ error: "Failed to create payment order with Razorpay" }, { status: 502 });
        }

        // 11. Store local payment row
        const { error: insertError } = await supabaseAdmin
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
                receipt: receipt,
                metadata: order as any,
            });

        if (insertError) {
            console.error("Failed to insert payment record in DB:", insertError);
            return NextResponse.json({ error: "Database registration failure" }, { status: 500 });
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
    } catch (err: any) {
        console.error("Unhandled error creating Razorpay order:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
