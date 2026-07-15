import { buildPaymentDocumentResponse } from "@/lib/payments/documentService";

export const runtime = "nodejs";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ transactionId: string }> }
) {
    const { transactionId } = await params;
    return buildPaymentDocumentResponse(transactionId, "refund");
}
