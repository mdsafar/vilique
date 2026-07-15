import { describe, expect, it } from "vitest";
import { getRefundEligibility } from "@/lib/payments/refundPolicy";

describe("refund eligibility", () => {
    it("allows refund only for unrecoverable Vilique-caused failed publication", () => {
        expect(getRefundEligibility({
            paymentCaptured: true,
            invitationPublished: false,
            publicUrlWasAccessible: false,
            failureCausedByVilique: true,
            recoveryAttemptsExhausted: true,
            unrecoverable: true,
            alreadyRefunded: false,
        })).toEqual({
            eligible: true,
            reason: "FAILED_PUBLICATION_UNRECOVERABLE",
        });
    });

    it("does not refund successfully published invitations", () => {
        expect(getRefundEligibility({
            paymentCaptured: true,
            invitationPublished: true,
            publicUrlWasAccessible: true,
            failureCausedByVilique: true,
            recoveryAttemptsExhausted: true,
            unrecoverable: true,
            alreadyRefunded: false,
        }).eligible).toBe(false);
    });

    it("does not refund temporary recovery failures", () => {
        expect(getRefundEligibility({
            paymentCaptured: true,
            invitationPublished: false,
            publicUrlWasAccessible: false,
            failureCausedByVilique: true,
            recoveryAttemptsExhausted: false,
            unrecoverable: false,
            alreadyRefunded: false,
        }).eligible).toBe(false);
    });
});
