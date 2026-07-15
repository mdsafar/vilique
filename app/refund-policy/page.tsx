import { LegalPage, policyMeta } from "@/components/LegalPage";

export const metadata = {
    title: "Refund and Failed Publication Policy",
    description: "Vilique refund rules for digital invitation publication and failed-publish recovery.",
};

export default function RefundPolicyPage() {
    return (
        <LegalPage
            title="Refund and Failed Publication Policy"
            description="Vilique provides a digital invitation publishing service. Payments are generally final once an invitation is successfully published and its public link becomes accessible."
            sections={[
                {
                    id: "eligibility",
                    title: "When a refund may be available",
                    body: <p>A refund is available only when Razorpay confirms captured payment, Vilique fails to publish the purchased invitation, the failure is caused by Vilique systems or infrastructure, automated and manual recovery cannot complete publication, the invitation was never publicly accessible, and the payment has not already been refunded.</p>,
                },
                {
                    id: "temporary-failures",
                    title: "Temporary publication delays",
                    body: <p>A temporary delay does not automatically qualify for a refund. Please do not pay again. Vilique will first retry publication, reconcile payment status, restore entitlement where safe, complete the public invitation, or place the case into manual review.</p>,
                },
                {
                    id: "successful-recovery",
                    title: "Successful recovery",
                    body: <p>If Vilique completes publication after a temporary failure, no refund is issued. The original payment remains applied and the customer receives the purchased digital publication.</p>,
                },
                {
                    id: "failed-recovery",
                    title: "Failed recovery",
                    body: <p>If publication is permanently unrecoverable after reasonable automated and manual recovery, Vilique initiates one full refund to the original payment method and links it to the original Razorpay payment. Refund completion depends on Razorpay, the bank, card network, UPI provider, or wallet provider.</p>,
                },
                {
                    id: "exclusions",
                    title: "Normally non-refundable cases",
                    body: <p>Refunds are normally not provided for change of mind, event cancellation or postponement, incorrect user-entered details, preference changes after publication, failure to share or use the invitation, taking a published invitation offline, event completion, edits after successful publication, account access problems caused by inaccurate account information, or dissatisfaction unrelated to Vilique’s technical inability to deliver publication.</p>,
                },
                {
                    id: "report",
                    title: "How to report a failed publication",
                    body: <p>Contact {policyMeta.supportEmail} with your account email, invitation title, Razorpay payment ID or order ID, and a short description. Vilique reviews payment capture, publication logs, recovery attempts, and whether the public URL was ever accessible.</p>,
                },
                {
                    id: "rights",
                    title: "Mandatory rights",
                    body: <p>This policy does not limit mandatory consumer rights that apply under law. Operator: {policyMeta.legalEntityName}, {policyMeta.businessAddress}. Grievance contact: {policyMeta.grievanceContact}.</p>,
                },
            ]}
        />
    );
}
