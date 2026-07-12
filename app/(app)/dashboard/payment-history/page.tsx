import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Receipt, ExternalLink, Calendar, HelpCircle, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPublicInvitationUrl } from "@/lib/config/site";
import { formatPaiseToCurrency } from "@/lib/currency";
import AuthRequiredModal from "@/components/AuthRequiredModal";

export const dynamic = "force-dynamic";

export default async function PaymentHistoryPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/profile");
    }

    const { data: payments, error } = await supabase
        .from("payments")
        .select(`
            *,
            invitation_templates (
                name
            ),
            invitations (
                title,
                slug
            )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    const paymentCards = (payments || []).map((payment) => {
        const template = payment.invitation_templates as { name?: string } | null;
        const invitation = payment.invitations as { title?: string; slug?: string } | null;
        const templateName = template?.name || "Premium Design";
        const invitationTitle = invitation?.title || "Deleted Invitation";
        const slug = invitation?.slug;
        const publicUrl = slug ? getPublicInvitationUrl(slug) : null;
        const dateString = new Date(payment.created_at).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

        let statusText = "Pending";
        let statusClass = "pending";
        let StatusIcon = HelpCircle;

        if (payment.status === "paid") {
            statusText = "Paid";
            statusClass = "paid";
            StatusIcon = CheckCircle2;
        } else if (payment.status === "failed") {
            statusText = "Failed";
            statusClass = "failed";
            StatusIcon = AlertTriangle;
        } else if (payment.status === "refunded") {
            statusText = "Refunded";
            statusClass = "refunded";
            StatusIcon = RefreshCw;
        } else if (payment.status === "cancelled") {
            statusText = "Cancelled";
            statusClass = "cancelled";
            StatusIcon = AlertTriangle;
        } else if (payment.status === "partially_refunded") {
            statusText = "Part. Refunded";
            statusClass = "refunded";
            StatusIcon = RefreshCw;
        }

        return (
            <article className="paymentRowCard" key={payment.id}>
                <div className="paymentRowMain">
                    <div className="paymentRowDetails">
                        <div className="paymentTitleBlock">
                            <h3>{templateName}</h3>
                            <span className={`paymentStatusBadge ${statusClass}`}>
                                <StatusIcon size={12} />
                                <span>{statusText}</span>
                            </span>
                        </div>
                        <p className="paymentInvitationName">
                            For: <strong>{invitationTitle}</strong>
                        </p>
                    </div>

                    <div className="paymentRowMeta">
                        <div className="paymentMetaItem">
                            <Calendar size={13} className="metaIcon" />
                            <span>{dateString}</span>
                        </div>
                        {payment.receipt && (
                            <div className="paymentMetaItem refCode">
                                <span className="refLabel">Ref:</span>
                                <code>{payment.receipt}</code>
                            </div>
                        )}
                    </div>

                    <div className="paymentRowAmount">
                        <span className="amountVal">{formatPaiseToCurrency(payment.amount_paise, payment.currency)}</span>
                        <span className="currencyLabel">{payment.currency}</span>
                    </div>
                </div>

                <div className="paymentRowFooter">
                    {publicUrl && payment.status === "paid" ? (
                        <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="paymentLinkAction">
                            <ExternalLink size={13} />
                            <span>View Invitation Site</span>
                        </a>
                    ) : (
                        <span className="paymentNoAction">-</span>
                    )}
                    <span className="invoiceArchitectureLabel">
                        Invoice ready for download
                    </span>
                </div>
            </article>
        );
    });

    return (
        <main className="paymentsPage">
            <AuthRequiredModal next="/dashboard/payment-history" />

            <Link href="/profile" className="backToDashboardBtn">
                <ArrowLeft size={14} />
                <span>Back to Dashboard</span>
            </Link>

            <div className="paymentsHeader">
                <div className="paymentsHeaderBody">
                    <div className="paymentsHeaderIcon">
                        <Receipt size={22} />
                    </div>
                    <div className="paymentsHeaderText">
                        <h1>Transaction History</h1>
                        <p>Verify and manage your invitation publishing payments and invoices.</p>
                    </div>
                </div>
            </div>

            <section className="paymentsSection">
                {error && (
                    <div className="paymentsErrorCard">
                        <AlertTriangle size={20} />
                        <div>
                            <strong>Error Loading Records</strong>
                            <p>We encountered a database error while retrieving your payments logs. Please reload the page.</p>
                        </div>
                    </div>
                )}

                {!error && (!payments || payments.length === 0) ? (
                    <div className="paymentsEmptyState">
                        <div className="emptyIconWrap">
                            <Receipt size={30} />
                        </div>
                        <h2>No Transactions Yet</h2>
                        <p>When you publish premium template designs, your billing records and reference keys will appear here.</p>
                    </div>
                ) : (
                    <div className="paymentsList">
                        {paymentCards}
                    </div>
                )}
            </section>
        </main>
    );
}
