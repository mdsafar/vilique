import { NextResponse } from "next/server";
import { z } from "zod";
import { initiateUnrecoverablePublishRefund } from "@/lib/payments/refunds";
import { reportError } from "@/lib/observability";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/security/requestGuard";



const initiateRefundSchema = z.object({
    paymentId: z.string().uuid(),
    publicReason: z.string().min(12).max(500).optional(),
    manualApproval: z.boolean().optional(),
});

export async function POST(request: Request) {
    const expectedSecret = process.env.PAYMENT_OPERATIONS_SECRET || process.env.PAYMENT_RECONCILIATION_SECRET;
    const providedSecret = request.headers.get("x-operations-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (!expectedSecret || providedSecret !== expectedSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = await rateLimit({
        key: `refund-initiate:${getClientIp(request)}`,
        limit: 10,
        windowMs: 10 * 60 * 1000,
    });
    if (!limit.ok) {
        return rateLimitResponse(limit.resetAt);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = initiateRefundSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid refund request" }, { status: 400 });
    }

    try {
        const result = await initiateUnrecoverablePublishRefund({
            paymentId: parsed.data.paymentId,
            actorId: null,
            actorType: "admin",
            publicReason: parsed.data.publicReason,
            manualApproval: parsed.data.manualApproval === true,
        });

        if (result.status === "not_eligible") {
            return NextResponse.json({ status: result.status, reason: result.reason }, { status: 409 });
        }

        return NextResponse.json(result);
    } catch (error) {
        reportError(error, "refund.initiate_route_failed", { paymentId: parsed.data.paymentId });
        return NextResponse.json({ error: "Refund initiation failed" }, { status: 500 });
    }
}
