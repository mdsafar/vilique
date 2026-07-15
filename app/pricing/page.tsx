import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata = {
    title: "Pricing",
    description: "Vilique invitation publishing prices and what a paid publication includes.",
};

export default function PricingPage() {
    return (
        <LegalPage
            title="Pricing"
            description="Template prices are loaded from Vilique’s backend pricing configuration and confirmed again during checkout."
            sections={[
                { id: "price", title: "Current publish price", body: <p>Paid templates currently display their configured price in checkout, commonly starting at INR 49 depending on the selected template. Free templates show as free before publishing. Taxes, if applicable, should be confirmed before launch.</p> },
                { id: "included", title: "What payment purchases", body: <p>A paid publication unlocks publication for the selected invitation and template, including a public invitation link, RSVP collection, guest wishes, sharing, analytics, and edits allowed by the invitation lifecycle.</p> },
                { id: "edits", title: "Edits and lifecycle", body: <p>Edits are included while the invitation remains editable. Completed invitations may be locked to preserve event integrity. A different invitation, different paid template entitlement, or new event may require another payment.</p> },
                { id: "refunds", title: "Failed publication", body: <p>Refunds are available only under the failed-publication rule described in the <Link href="/refund-policy">Refund Policy</Link>. Temporary delays are recovered first; customers should not pay again while recovery is pending.</p> },
                { id: "fees", title: "No hidden fees", body: <p>Vilique shows the publish price before Razorpay checkout. Do not rely on any price shown outside the app unless it matches checkout.</p> },
            ]}
        />
    );
}
