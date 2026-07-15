import { describe, expect, it } from "vitest";
import { getTransactionLifecycle } from "@/lib/payments/transactionLifecycle";

describe("transaction lifecycle display state", () => {
    it("shows paid when payment captured and invitation published", () => {
        expect(getTransactionLifecycle({
            status: "published",
            payment_status: "captured",
            publish_status: "published",
            refund_status: "none",
            recovery_status: "recovered",
        })).toBe("paid");
    });

    it("shows refund pending from backend refund state", () => {
        expect(getTransactionLifecycle({
            status: "published",
            refund_status: "pending",
        })).toBe("refund_pending");
    });

    it("shows refunded after webhook/provider reconciliation updates backend state", () => {
        expect(getTransactionLifecycle({
            status: "refunded",
            refund_status: "processed",
        })).toBe("refunded");
    });

    it("shows recovery while publishing is pending after captured payment", () => {
        expect(getTransactionLifecycle({
            status: "recovery_pending",
            payment_status: "captured",
            publish_status: "publish_pending",
            recovery_status: "pending",
        })).toBe("recovery_pending");
    });

    it("shows failed for failed pre-completion payment", () => {
        expect(getTransactionLifecycle({ status: "failed", payment_status: "failed" })).toBe("failed");
    });
});
