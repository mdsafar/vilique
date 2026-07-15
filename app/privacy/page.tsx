import { LegalPage, policyMeta } from "@/components/LegalPage";

export const metadata = {
    title: "Privacy Policy",
    description: "How Vilique handles account, invitation, guest, analytics, payment metadata, and media data.",
};

export default function PrivacyPage() {
    return (
        <LegalPage
            title="Privacy Policy"
            description="This policy explains the information Vilique processes to provide digital invitation creation, publication, sharing, RSVP, wishes, analytics, and support."
            sections={[
                { id: "data", title: "Information we process", body: <p>Vilique processes account information, profile details, invitation content, names, dates, venues, media uploads, guest RSVP data, wishes/messages, analytics events, device/browser information, and payment metadata such as Razorpay order, payment, refund, and status identifiers.</p> },
                { id: "payments", title: "Payments", body: <p>Razorpay processes payment methods. Vilique stores payment metadata needed for reconciliation, publication entitlement, refunds, fraud prevention, support, and accounting. Vilique does not store card numbers or card security codes.</p> },
                { id: "providers", title: "Service providers", body: <p>Vilique uses Supabase for database, authentication, and storage infrastructure; Razorpay for payments; and hosting infrastructure such as Vercel or the current deployment provider. Provider processing may occur in locations where those services operate.</p> },
                { id: "public", title: "Public invitation visibility", body: <p>Published invitation links can be viewed by people who have the link. Guests may see invitation content and approved wishes. Draft invitations and draft media are intended for owner-only access through authenticated sessions and short-lived signed URLs.</p> },
                { id: "purposes", title: "Purposes", body: <p>Vilique uses data to create and publish invitations, process payments, prevent duplicate payment or refund errors, collect RSVPs, show wishes, provide analytics, secure the service, limit abuse, troubleshoot issues, respond to support requests, and meet legal obligations.</p> },
                { id: "cookies", title: "Cookies and local storage", body: <p>Vilique and Supabase use cookies or local storage for authentication, session refresh, preference storage, visitor deduplication, and security. Optional marketing consent must not be pre-checked.</p> },
                { id: "retention", title: "Retention", body: <p>Vilique keeps data only as long as needed for service delivery, account management, payment reconciliation, legal obligations, abuse prevention, and support. Customers may request deletion, subject to payment, security, accounting, and legal retention needs.</p> },
                { id: "security", title: "Security", body: <p>Vilique uses access controls, RLS, private draft storage, signed URLs, webhook verification, payment reconciliation, and operational safeguards. No internet service can be guaranteed perfectly secure.</p> },
                { id: "children", title: "Children and guest data", body: <p>Vilique is not intended for unsupervised use by children. Invitation owners are responsible for lawfully collecting and sharing guest information and for respecting guest privacy when publishing event details.</p> },
                { id: "rights", title: "Rights and contact", body: <p>For access, correction, deletion, account, guest data, payment metadata, or grievance requests, contact {policyMeta.supportEmail}. Operator: {policyMeta.legalEntityName}. Grievance contact: {policyMeta.grievanceContact}.</p> },
            ]}
        />
    );
}
