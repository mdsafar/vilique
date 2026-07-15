export type RefundDecisionInput = {
    paymentCaptured: boolean;
    invitationPublished: boolean;
    publicUrlWasAccessible: boolean;
    failureCausedByVilique: boolean;
    recoveryAttemptsExhausted: boolean;
    unrecoverable: boolean;
    alreadyRefunded: boolean;
    manualApproval?: boolean;
};

export function getRefundEligibility(input: RefundDecisionInput) {
    const eligible = input.paymentCaptured &&
        !input.invitationPublished &&
        !input.publicUrlWasAccessible &&
        input.failureCausedByVilique &&
        input.recoveryAttemptsExhausted &&
        !input.alreadyRefunded &&
        (input.unrecoverable || input.manualApproval === true);

    return {
        eligible,
        reason: eligible ? "FAILED_PUBLICATION_UNRECOVERABLE" : "RECOVERY_OR_EXCLUSION_APPLIES",
    };
}
