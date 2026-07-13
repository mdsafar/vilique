"use client";

import useSWR from "swr";
import ProfilePageSkeleton from "@/components/skeletons/ProfilePageSkeleton";
import { useIsClient } from "@/hooks/useIsClient";
import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    ClipboardCheck,
    ExternalLink,
    Eye,
    HelpCircle,
    PencilLine,
    Receipt,
    RefreshCw,
    UsersRound,
} from "lucide-react";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import ProfileCard from "@/components/ProfileCard";
import { Skeleton, TextSkeleton } from "@/components/ui/Skeleton";
import { getPublicInvitationUrl } from "@/lib/config/site";
import { formatPaiseToCurrency } from "@/lib/currency";
import { useScrollPreservation } from "./NavigationStateProvider";
import { InvitationData } from "@/types/invitation";

type PaymentRecord = {
    id: string;
    invitation_id: string;
    template_id: string | null;
    amount_paise: number;
    currency: string;
    status: string;
    receipt: string | null;
    created_at: string;
    templateName: string | null;
    invitationTitle: string | null;
    invitationSlug: string | null;
};

export default function ProfilePageClient() {
    const isClient = useIsClient();

    const { data: dashboardData } = useSWR(isClient ? "/api/profile/dashboard" : null);
    const { data: paymentsData } = useSWR(isClient ? "/api/profile/payments" : null);

    // Register scroll preservation on this page path
    useScrollPreservation("/profile");

    if (!isClient || !dashboardData) {
        return (
            <main className="profilePage">
                <ProfilePageSkeleton />
            </main>
        );
    }

    const profile = dashboardData?.profile || null;
    const invitations = (dashboardData?.invitations || []) as InvitationData[];
    const dashboard = dashboardData?.dashboard || {
        published: 0,
        drafts: 0,
        views: 0,
        rsvps: 0,
        totalSpent: 0,
    };

    const isPaymentsLoading = !paymentsData;
    const payments = paymentsData?.payments || [];
    const paymentsError = paymentsData?.paymentsError || null;

    const displayName = profile?.name || "Guest";
    const initials = getInitials(displayName);
    const greeting = getGreeting();

    const stats = [
        {
            label: "Published",
            value: String(dashboard.published || invitations.filter((item) => item.status === "published").length),
            detail: "Live invitations",
            icon: ClipboardCheck,
            tone: "green",
        },
        {
            label: "Drafts",
            value: String(dashboard.drafts || invitations.filter((item) => item.status === "draft").length),
            detail: "Ready to refine",
            icon: PencilLine,
            tone: "orange",
        },
        {
            label: "Views",
            value: String(dashboard.views),
            detail: "Total invite views",
            icon: Eye,
            tone: "blue",
        },
        {
            label: "RSVPs",
            value: String(dashboard.rsvps),
            detail: "Guests responded",
            icon: UsersRound,
            tone: "rose",
        },
    ];

    const activePublishedCount = dashboard.published || invitations.filter((item) => item.status === "published").length;

    return (
        <main className="profilePage">
            <AuthRequiredModal next="/profile" />

            <section className="profileOverview" aria-label="Profile overview">
                <ProfileCard
                    profile={profile}
                    activePublishedCount={activePublishedCount}
                    totalSpent={dashboard.totalSpent || 0}
                    initials={initials}
                    greeting={greeting}
                />

                <section className="profileStats" aria-label="Invitation metrics">
                    {stats.map((item) => {
                        const Icon = item.icon;

                        return (
                            <article className={`profileStat ${item.tone}`} key={item.label}>
                                <span>
                                    <Icon size={24} aria-hidden="true" />
                                </span>
                                <div>
                                    <strong>{item.value}</strong>
                                    <b>{item.label}</b>
                                    <p>{item.detail}</p>
                                </div>
                            </article>
                        );
                    })}
                </section>
            </section>

            {profile ? (
                <ProfileTransactions
                    payments={payments}
                    hasError={Boolean(paymentsError)}
                    isLoading={isPaymentsLoading}
                />
            ) : null}
        </main>
    );
}

function ProfileTransactions({
    payments,
    hasError,
    isLoading,
}: {
    payments: PaymentRecord[];
    hasError: boolean;
    isLoading: boolean;
}) {
    return (
        <section className="profileTransactions" id="profile-transactions" aria-label="Transactions">
            <div className="paymentsHeader">
                <div className="paymentsHeaderBody">
                    <div className="paymentsHeaderIcon">
                        <Receipt size={22} />
                    </div>
                    <div className="paymentsHeaderText">
                        <h2>Transactions</h2>
                        <p>Payment records for published premium invitations.</p>
                    </div>
                </div>
            </div>

            <div className="paymentsSection">
                {isLoading ? (
                    <ProfileTransactionsSkeleton />
                ) : hasError ? (
                    <div className="paymentsErrorCard">
                        <AlertTriangle size={20} />
                        <div>
                            <strong>Error Loading Records</strong>
                            <p>We could not retrieve your transaction logs. Please reload the page.</p>
                        </div>
                    </div>
                ) : payments.length === 0 ? (
                    <div className="paymentsEmptyState">
                        <div className="emptyIconWrap">
                            <Receipt size={30} />
                        </div>
                        <h2>No Transactions Yet</h2>
                        <p>When you publish premium template designs, your billing records and reference keys will appear here.</p>
                    </div>
                ) : (
                    <div className="paymentsList">
                        {payments.map((payment) => (
                            <PaymentRecordCard payment={payment} key={payment.id} />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

function ProfileTransactionsSkeleton() {
    return (
        <div className="paymentsList" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, index) => (
                <article className="profileTransactionCard profileTransactionCard--skeleton" key={index}>
                    <Skeleton className="profileTransactionIcon" rounded="lg" />
                    <div className="profileTransactionBody">
                        <div className="profileTransactionTitle">
                            <TextSkeleton width={132} height={16} />
                            <Skeleton style={{ width: 62, height: 20 }} rounded="full" />
                        </div>
                        <TextSkeleton width={180} height={12} />
                        <div className="profileTransactionMeta">
                            <TextSkeleton width={160} height={12} />
                            <TextSkeleton width={140} height={18} />
                        </div>
                    </div>
                    <div className="profileTransactionAside">
                        <TextSkeleton width={52} height={20} />
                        <TextSkeleton width={26} height={10} />
                    </div>
                    <div className="profileTransactionAction">
                        <Skeleton style={{ width: 134, height: 30 }} rounded="lg" />
                    </div>
                </article>
            ))}
        </div>
    );
}

function PaymentRecordCard({ payment }: { payment: PaymentRecord }) {
    const templateName = payment.templateName || "Premium Design";
    const invitationTitle = payment.invitationTitle || "Deleted Invitation";
    const publicUrl = payment.invitationSlug ? getPublicInvitationUrl(payment.invitationSlug) : null;
    const dateString = new Date(payment.created_at).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
    const status = getPaymentStatus(payment.status);
    const StatusIcon = status.icon;

    return (
        <article className="profileTransactionCard">
            <div className="profileTransactionIcon">
                <Receipt size={18} aria-hidden="true" />
            </div>

            <div className="profileTransactionBody">
                <div className="profileTransactionTitle">
                    <h3>{templateName}</h3>
                    <span className={`paymentStatusBadge ${status.className}`}>
                        <StatusIcon size={12} />
                        <span>{status.label}</span>
                    </span>
                </div>

                <p>
                    For <strong>{invitationTitle}</strong>
                </p>

                <div className="profileTransactionMeta">
                    <span>
                        <Calendar size={13} className="metaIcon" />
                        <span>{dateString}</span>
                    </span>
                    {payment.receipt ? (
                        <span className="profileTransactionRef">
                            <span className="refLabel">Ref:</span>
                            <code>{payment.receipt}</code>
                        </span>
                    ) : null}
                </div>
            </div>

            <div className="profileTransactionAside">
                <strong>{formatPaiseToCurrency(payment.amount_paise, payment.currency)}</strong>
                <span>{payment.currency}</span>
            </div>

            <div className="profileTransactionAction">
                {publicUrl && payment.status === "paid" ? (
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="paymentLinkAction">
                        <ExternalLink size={13} />
                        <span>View Invitation Site</span>
                    </a>
                ) : (
                    <span className="paymentNoAction">No public link</span>
                )}
            </div>
        </article>
    );
}

function getPaymentStatus(status: string) {
    if (status === "paid") {
        return { label: "Paid", className: "paid", icon: CheckCircle2 };
    }
    if (status === "failed") {
        return { label: "Failed", className: "failed", icon: AlertTriangle };
    }
    if (status === "refunded") {
        return { label: "Refunded", className: "refunded", icon: RefreshCw };
    }
    if (status === "cancelled") {
        return { label: "Cancelled", className: "cancelled", icon: AlertTriangle };
    }
    if (status === "partially_refunded") {
        return { label: "Part. Refunded", className: "refunded", icon: RefreshCw };
    }
    return { label: "Pending", className: "pending", icon: HelpCircle };
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
}

function getInitials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "VQ";
}
