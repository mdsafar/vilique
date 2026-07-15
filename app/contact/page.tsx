import { LegalPage, policyMeta } from "@/components/LegalPage";

export const metadata = {
    title: "Contact",
    description: "Contact Vilique support for account, payment, and failed publication help.",
};

export default function ContactPage() {
    return (
        <LegalPage
            title="Contact"
            description="Use these channels for account, payment, failed publication, content, and guest-data support."
            sections={[
                { id: "support", title: "Support email", body: <p>Email {policyMeta.supportEmail}. Include your account email, invitation title, issue category, and Razorpay order/payment/reference ID for payment or failed-publication issues.</p> },
                { id: "categories", title: "Issue categories", body: <p>Choose the closest category in your message: payment issue, failed publication, refund review, account access, invitation edit, guest RSVP/wish concern, content complaint, privacy request, or general support.</p> },
                { id: "response", title: "Response expectations", body: <p>Vilique prioritizes payment and failed-publication incidents. Response times may vary by volume, provider availability, and whether manual reconciliation is required.</p> },
                { id: "spam", title: "Anti-spam", body: <p>Repeated, automated, abusive, or unrelated submissions may be rate limited or blocked to protect customers and guests.</p> },
            ]}
        />
    );
}
