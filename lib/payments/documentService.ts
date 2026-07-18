import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { looseSupabase } from "@/lib/supabase/loose";
import { renderInvoicePdf, renderRefundReceiptPdf, PaymentDocumentData } from "@/lib/payments/documentPdf";
import { rateLimit, rateLimitResponse } from "@/lib/security/requestGuard";
import { reportError } from "@/lib/observability";

type DocumentKind = "invoice" | "refund";

type PaymentDocumentRow = PaymentDocumentData["payment"] & {
    user_id: string;
    invitation_id: string | null;
    template_id: string | null;
};

type ProfileRow = {
    full_name?: string | null;
};

type InvitationRow = NonNullable<PaymentDocumentData["invitation"]>;
type TemplateRow = NonNullable<PaymentDocumentData["template"]>;

const INVOICE_STATUSES = new Set(["paid", "captured", "published", "refund_pending", "refunded", "partially_refunded"]);

export async function buildPaymentDocumentResponse(transactionId: string, kind: DocumentKind) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return documentError("AUTH_REQUIRED", "Please sign in to download this document.", 401);
        }

        if (!isUuid(transactionId)) {
            return documentError("TRANSACTION_NOT_FOUND", "Transaction not found.", 404);
        }

        const limit = await rateLimit({
            key: `payment-document:${user.id}:${kind}`,
            limit: 8,
            windowMs: 60_000,
        });
        if (!limit.ok) {
            return rateLimitResponse(limit.resetAt);
        }

        const admin = createAdminClient();
        const { data: paymentData, error: paymentError } = await looseSupabase(admin)
            .from("payments")
            .select(`
                id,
                user_id,
                invitation_id,
                template_id,
                provider_order_id,
                provider_payment_id,
                provider_refund_id,
                provider_status,
                amount_paise,
                currency,
                status,
                payment_state,
                publish_state,
                refund_state,
                recovery_state,
                paid_at,
                refunded_at,
                refund_processed_at,
                created_at,
                invoice_number,
                invoice_issued_at,
                invoice_version,
                refund_receipt_number,
                refund_receipt_issued_at,
                refund_reason_public
            `)
            .eq("id", transactionId)
            .maybeSingle();

        if (paymentError) {
            console.error("Payment document lookup failed:", paymentError);
            reportError(paymentError, "payment.document_lookup_failed", { paymentId: transactionId, kind });
            return documentError("PDF_GENERATION_FAILED", "Unable to prepare this document.", 500);
        }

        const payment = paymentData as PaymentDocumentRow | null;
        if (!payment) {
            return documentError("TRANSACTION_NOT_FOUND", "Transaction not found.", 404);
        }
        if (payment.user_id !== user.id) {
            return documentError("FORBIDDEN", "This document is not available for your account.", 403);
        }

        const eligibilityError = validateDocumentEligibility(payment, kind);
        if (eligibilityError) return eligibilityError;

        const assignedNumber = await assignDocumentNumber(admin, payment.id, kind);
        if (kind === "invoice") {
            payment.invoice_number = assignedNumber;
            payment.invoice_issued_at ||= new Date().toISOString();
        } else {
            payment.refund_receipt_number = assignedNumber;
            payment.refund_receipt_issued_at ||= new Date().toISOString();
            if (!payment.invoice_number) {
                payment.invoice_number = await assignDocumentNumber(admin, payment.id, "invoice");
            }
        }

        const data = await buildDocumentData(admin, payment, user.email || null);
        const pdfBytes = kind === "invoice"
            ? await renderInvoicePdf(data)
            : await renderRefundReceiptPdf(data);
        const documentNumber = kind === "invoice" ? payment.invoice_number : payment.refund_receipt_number;
        const filename = `${kind === "invoice" ? "vilique-invoice" : "vilique-refund"}-${safeFilePart(documentNumber || payment.id)}.pdf`;

        const body = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;

        return new Response(body, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (error) {
        console.error("Payment document generation failed:", error);
        reportError(error, "payment.document_generation_failed", { transactionId, kind });
        return documentError("PDF_GENERATION_FAILED", "Unable to generate this document.", 500);
    }
}

function validateDocumentEligibility(payment: PaymentDocumentRow, kind: DocumentKind) {
    if (kind === "invoice") {
        if (!isInvoiceEligible(payment)) {
            return documentError("INVOICE_NOT_AVAILABLE", "An invoice is available only after payment is captured.", 409);
        }
        return null;
    }

    if (!isRefundReceiptEligible(payment)) {
        return documentError("REFUND_RECEIPT_NOT_AVAILABLE", "Refund receipt is available only after Razorpay confirms the refund.", 409);
    }
    return null;
}

export function isInvoiceEligible(payment: {
    status: string;
    payment_state?: string | null;
    provider_payment_id?: string | null;
}) {
    const isPaid = INVOICE_STATUSES.has(payment.status)
        || payment.payment_state === "captured"
        || payment.payment_state === "refunded";

    return isPaid && Boolean(payment.provider_payment_id);
}

export function isRefundReceiptEligible(payment: {
    status: string;
    refund_state?: string | null;
    provider_refund_id?: string | null;
}) {
    return payment.status === "refunded"
        && payment.refund_state === "processed"
        && Boolean(payment.provider_refund_id);
}

async function assignDocumentNumber(admin: unknown, paymentId: string, kind: DocumentKind) {
    const functionName = kind === "invoice"
        ? "assign_payment_invoice_number"
        : "assign_payment_refund_receipt_number";
    const { data, error } = await looseSupabase(admin).rpc(functionName, { p_payment_id: paymentId });

    if (error || typeof data !== "string") {
        throw new Error(error?.message || `Unable to assign ${kind} document number`);
    }
    return data;
}

async function buildDocumentData(admin: unknown, payment: PaymentDocumentRow, email: string | null): Promise<PaymentDocumentData> {
    const [profileResult, invitationResult, templateResult] = await Promise.all([
        looseSupabase(admin)
            .from("profiles")
            .select("full_name")
            .eq("id", payment.user_id)
            .maybeSingle(),
        payment.invitation_id
            ? looseSupabase(admin)
                .from("invitations")
                .select("title, slug, category, published_at")
                .eq("id", payment.invitation_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        payment.template_id
            ? looseSupabase(admin)
                .from("invitation_templates")
                .select("name, category")
                .eq("id", payment.template_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
    ]);

    if (profileResult.error || invitationResult.error || templateResult.error) {
        throw new Error("Unable to load document reference data");
    }

    const profile = profileResult.data as ProfileRow | null;

    return {
        payment,
        customer: {
            name: profile?.full_name || null,
            email,
        },
        invitation: invitationResult.data as InvitationRow | null,
        template: templateResult.data as TemplateRow | null,
    };
}

function documentError(code: string, message: string, status: number) {
    return NextResponse.json(
        { code, error: message },
        {
            status,
            headers: {
                "Cache-Control": "private, no-store",
            },
        }
    );
}

function safeFilePart(value: string) {
    return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "transaction";
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
