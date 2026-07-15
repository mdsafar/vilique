import { LegalPage, policyMeta } from "@/components/LegalPage";

export const metadata = {
    title: "Terms of Service",
    description: "Vilique service terms for accounts, invitation publishing, payments, content, and support.",
};

export default function TermsPage() {
    return (
        <LegalPage
            title="Terms of Service"
            description="These terms describe how customers may use Vilique to create, preview, publish, and share digital invitation websites."
            sections={[
                { id: "operator", title: "Operator and eligibility", body: <p>Vilique is operated by {policyMeta.legalEntityName}, {policyMeta.businessAddress}. Users must be legally able to form a contract and are responsible for keeping account details accurate.</p> },
                { id: "service", title: "Service description", body: <p>Vilique lets users create draft invitations, preview them, choose templates, upload content, collect RSVPs and wishes, and publish public invitation links. Draft invitations are private to the owner; published invitations are accessible to anyone with the public link.</p> },
                { id: "pricing", title: "Pricing and payment", body: <p>Paid publication prices come from Vilique’s backend pricing configuration and are shown before checkout. Payment authorization and processing are handled by Razorpay. Vilique does not store card numbers.</p> },
                { id: "publication", title: "Successful and failed publication", body: <p>A purchase is delivered when the invitation is successfully published and the public link becomes accessible. If payment is captured but publication is delayed, Vilique will attempt recovery and customers should not pay again. Refund eligibility is governed by the Refund and Failed Publication Policy.</p> },
                { id: "templates", title: "Template licence", body: <p>Templates, layouts, UI, and Vilique branding remain Vilique property or licensed assets. A purchase grants a limited right to use the selected template for the customer’s invitation; it does not transfer template ownership.</p> },
                { id: "content", title: "User content", body: <p>Customers retain ownership of invitation text, event details, names, images, audio, and other uploaded content. Customers grant Vilique a licence to host, process, display, resize, secure, and deliver that content for the invitation service.</p> },
                { id: "prohibited", title: "Prohibited content and conduct", body: <p>Users may not upload unlawful, abusive, infringing, deceptive, malicious, hateful, sexually exploitative, privacy-invasive, or spam content. Users are responsible for having rights to uploaded media and event information.</p> },
                { id: "guests", title: "RSVPs, wishes, and analytics", body: <p>Public guests may submit RSVPs and wishes. Analytics are approximate and may exclude previews, bots, duplicate views, abuse, or technical noise. Vilique does not guarantee perfectly accurate analytics.</p> },
                { id: "availability", title: "Availability and changes", body: <p>Vilique aims to provide reliable service but does not guarantee uninterrupted availability. Features, prices, templates, and policies may change, subject to applicable law and existing purchase obligations.</p> },
                { id: "liability", title: "Suspension, liability, and disputes", body: <p>Vilique may suspend accounts or invitations that violate these terms. These terms are governed by {policyMeta.jurisdiction}, subject to mandatory law. Grievance contact: {policyMeta.grievanceContact}.</p> },
                { id: "support", title: "Support", body: <p>For account, payment, failed publication, copyright, trademark, or content complaints, contact {policyMeta.supportEmail} with relevant invitation and payment references.</p> },
            ]}
        />
    );
}
