import { LegalPage } from "@/components/LegalPage";

export const metadata = {
    title: "About",
    description: "About Vilique digital invitation websites.",
};

export default function AboutPage() {
    return (
        <LegalPage
            title="About Vilique"
            description="Vilique helps people create, preview, publish, and share digital invitation websites for meaningful events."
            sections={[
                { id: "what", title: "What Vilique provides", body: <p>Vilique provides invitation templates, a builder, publishing, public invitation links, RSVPs, guest wishes, sharing tools, and lightweight analytics for events such as weddings, engagements, birthdays, housewarmings, festivals, graduations, and gatherings.</p> },
                { id: "model", title: "Draft, preview, publish", body: <p>Customers can draft and preview invitation content before publishing. Paid templates require payment before publication. Once published, the invitation becomes a digital service available through its public link.</p> },
                { id: "support", title: "Support", body: <p>Vilique support helps with account access, payments, failed publication recovery, invitation lifecycle questions, and guest-facing issues. Payment incidents are reconciled through Razorpay and Vilique’s internal payment records.</p> },
            ]}
        />
    );
}
