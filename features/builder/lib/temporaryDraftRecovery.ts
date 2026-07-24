type TemporaryDraftRecoveryCandidate = {
    status?: string | null;
    lifecycleStatus?: string | null;
    eventStatus?: string | null;
    paymentStatus?: string | null;
    publishedAt?: string | null;
    firstPublishedAt?: string | null;
};

const FINALIZING_PAYMENT_STATUSES = new Set([
    "paid",
    "publish_pending",
    "recovery_pending",
    "refund_pending",
    "refunded",
]);

/**
 * A browser recovery marker is only a hint. The invitation returned by the
 * server is the source of truth, especially after a tab closes before the
 * publish-success UI has had a chance to clean up local storage.
 */
export function isRecoverableTemporaryDraft(
    invitation: TemporaryDraftRecoveryCandidate,
) {
    return invitation.status === "draft"
        && invitation.lifecycleStatus !== "published"
        && invitation.eventStatus !== "published"
        && !invitation.publishedAt
        && !invitation.firstPublishedAt
        && !FINALIZING_PAYMENT_STATUSES.has(invitation.paymentStatus || "");
}
