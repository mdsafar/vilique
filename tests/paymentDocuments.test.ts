import { describe, expect, it } from "vitest";
import { isInvoiceEligible, isRefundReceiptEligible } from "@/lib/payments/documentService";

describe("payment document eligibility", () => {
    it("allows invoices for captured paid payments", () => {
        expect(isInvoiceEligible({
            status: "published",
            payment_state: "captured",
            provider_payment_id: "pay_123",
        })).toBe(true);
    });

    it("keeps original invoices available after refund", () => {
        expect(isInvoiceEligible({
            status: "refunded",
            payment_state: "refunded",
            provider_payment_id: "pay_123",
        })).toBe(true);
    });

    it("rejects invoices for pending or unpaid payments", () => {
        expect(isInvoiceEligible({
            status: "pending",
            payment_state: "pending",
            provider_payment_id: "pay_123",
        })).toBe(false);
    });

    it("allows refund receipts only after provider-confirmed refunds", () => {
        expect(isRefundReceiptEligible({
            status: "refunded",
            refund_state: "processed",
            provider_refund_id: "rfnd_123",
        })).toBe(true);
    });

    it("blocks final refund receipts while refund is pending", () => {
        expect(isRefundReceiptEligible({
            status: "refund_pending",
            refund_state: "pending",
            provider_refund_id: "rfnd_123",
        })).toBe(false);
    });
});
