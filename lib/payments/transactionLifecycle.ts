export type TransactionLifecycleInput = {
    status: string;
    payment_status?: string | null;
    publish_status?: string | null;
    refund_status?: string | null;
    recovery_status?: string | null;
};

export type TransactionLifecycleState =
    | "paid"
    | "refund_pending"
    | "refunded"
    | "recovery_pending"
    | "failed"
    | "processing";

export function getTransactionLifecycle(input: TransactionLifecycleInput): TransactionLifecycleState {
    const status = input.status;
    const paymentStatus = input.payment_status || "";
    const publishStatus = input.publish_status || "";
    const refundStatus = input.refund_status || "";
    const recoveryStatus = input.recovery_status || "";

    if (status === "refunded" || refundStatus === "processed") return "refunded";
    if (status === "refund_pending" || refundStatus === "pending") return "refund_pending";
    if (status === "failed" || paymentStatus === "failed") return "failed";
    if (status === "recovery_pending" || recoveryStatus === "pending" || recoveryStatus === "retrying" || publishStatus === "publish_pending") {
        return "recovery_pending";
    }
    if (status === "paid" || status === "published" || (paymentStatus === "captured" && publishStatus === "published")) {
        return "paid";
    }

    return "processing";
}
