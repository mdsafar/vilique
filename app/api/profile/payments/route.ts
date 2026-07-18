import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { looseSupabase } from "@/lib/supabase/loose";
import { reportError } from "@/lib/observability";

type PaymentRecord = {
    id: string;
    invitation_id: string;
    template_id: string | null;
    amount_paise: number;
    currency: string;
    status: string;
    payment_status: string;
    publish_status: string;
    refund_status: string;
    recovery_status: string;
    refund_reason: string | null;
    refund_reference: string | null;
    refund_processed_at: string | null;
    published_at: string | null;
    receipt: string | null;
    created_at: string;
    templateName: string | null;
    invitationTitle: string | null;
    invitationSlug: string | null;
};

type PaymentRow = {
    id: string;
    invitation_id: string;
    template_id: string | null;
    amount_paise: number;
    currency: string;
    status: string;
    payment_state?: string | null;
    publish_state?: string | null;
    refund_state?: string | null;
    recovery_state?: string | null;
    provider_refund_id?: string | null;
    refund_processed_at?: string | null;
    refunded_at?: string | null;
    manual_review_reason?: string | null;
    last_error?: string | null;
    receipt: string | null;
    created_at: string;
};

const PAYMENT_LIMIT_DEFAULT = 10;
const PAYMENT_LIMIT_MAX = 30;
const paymentSorts = {
    newest: { field: "created_at", ascending: false },
    oldest: { field: "created_at", ascending: true },
    amount_high: { field: "amount_paise", ascending: false },
    amount_low: { field: "amount_paise", ascending: true },
} as const;
const paymentStatuses = ["paid", "published", "captured", "publish_pending", "recovery_pending", "refund_pending", "refunded", "created", "pending", "attempted", "authorized", "failed", "cancelled", "partially_refunded", "manual_review"] as const;
type PaymentSort = keyof typeof paymentSorts;
type PaymentStatus = typeof paymentStatuses[number];
type PaymentStatusFilter = "all" | PaymentStatus;

const basePaymentSelect = `
    id,
    invitation_id,
    template_id,
    amount_paise,
    currency,
    status,
    refunded_at,
    receipt,
    created_at
`;

const lifecyclePaymentSelect = `
    ${basePaymentSelect},
    payment_state,
    publish_state,
    refund_state,
    recovery_state,
    provider_refund_id,
    refund_processed_at,
    manual_review_reason,
    last_error
`;

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const transactions = await getProfileTransactions(user.id, {
            search: (url.searchParams.get("search") || "").trim(),
            status: parsePaymentStatus(url.searchParams.get("status")),
            sort: parsePaymentSort(url.searchParams.get("sort")),
            cursor: decodeCursor(url.searchParams.get("cursor")),
            limit: parseLimit(url.searchParams.get("limit"), PAYMENT_LIMIT_DEFAULT, PAYMENT_LIMIT_MAX),
        });
        return NextResponse.json(transactions);
    } catch (error) {
        console.error("Failed to fetch profile transactions:", error);
        reportError(error, "profile.transactions_fetch_failed");
        return NextResponse.json({ error: "Failed to fetch transaction logs" }, { status: 500 });
    }
}

async function getProfileTransactions(userId: string, options: {
    search: string;
    status: PaymentStatusFilter;
    sort: PaymentSort;
    cursor: { value: string; id: string } | null;
    limit: number;
}) {
    const supabase = await createClient();
    const sortConfig = paymentSorts[options.sort];

    const buildPaymentsQuery = (columns: string) => {
        let query = looseSupabase(supabase)
            .from("payments")
            .select(columns, { count: "exact" })
            .eq("user_id", userId);

        if (options.status !== "all") {
            query = query.eq("status", options.status);
        }
        if (options.search) {
            const escaped = escapeLike(options.search);
            query = query.or(`receipt.ilike.%${escaped}%,provider_payment_id.ilike.%${escaped}%,provider_order_id.ilike.%${escaped}%,status.ilike.%${escaped}%`);
        }
        return applyCursor(query, sortConfig.field, sortConfig.ascending, options.cursor)
            .order(sortConfig.field, { ascending: sortConfig.ascending })
            .order("id", { ascending: sortConfig.ascending })
            .limit(options.limit + 1);
    };

    let { data, error, count } = await buildPaymentsQuery(lifecyclePaymentSelect);

    if (isMissingPaymentLifecycleColumn(error)) {
        ({ data, error, count } = await buildPaymentsQuery(basePaymentSelect));
    }

    if (error) {
        return emptyPaymentResponse(error.message);
    }

    const rows = (data || []) as PaymentRow[];
    const paymentRows = rows.slice(0, options.limit);
    const invitationIds = Array.from(new Set(paymentRows.map((payment) => payment.invitation_id).filter(Boolean)));
    const templateIds = Array.from(new Set(paymentRows.map((payment) => payment.template_id).filter(Boolean) as string[]));

    const [invitationsResult, templatesResult] = await Promise.all([
        invitationIds.length
            ? supabase.from("invitations").select("id, title, slug, published_at").in("id", invitationIds)
            : Promise.resolve({ data: [], error: null }),
        templateIds.length
            ? supabase.from("invitation_templates").select("id, name").in("id", templateIds)
            : Promise.resolve({ data: [], error: null }),
    ]);

    const invitationMap = new Map((invitationsResult.data || []).map((item) => [
        item.id,
        { title: item.title as string | null, slug: item.slug as string | null, published_at: item.published_at as string | null },
    ]));
    const templateMap = new Map((templatesResult.data || []).map((item) => [
        item.id,
        item.name as string | null,
    ]));

    const payments = paymentRows.map((payment) => {
        const invitation = invitationMap.get(payment.invitation_id);

        return {
            ...payment,
            payment_status: payment.payment_state || derivePaymentStatus(payment.status),
            publish_status: payment.publish_state || derivePublishStatus(payment.status),
            refund_status: payment.refund_state || deriveRefundStatus(payment.status),
            recovery_status: payment.recovery_state || deriveRecoveryStatus(payment.status),
            refund_reason: payment.manual_review_reason || payment.last_error || null,
            refund_reference: payment.provider_refund_id || null,
            refund_processed_at: payment.refund_processed_at || payment.refunded_at || null,
            published_at: invitation?.published_at || null,
            templateName: payment.template_id ? templateMap.get(payment.template_id) || null : null,
            invitationTitle: invitation?.title || null,
            invitationSlug: invitation?.slug || null,
        };
    });

    const errorMsg = (invitationsResult.error?.message || templatesResult.error?.message) || null;
    const lastRow = paymentRows[paymentRows.length - 1] as PaymentRow | undefined;
    const hasMore = rows.length > options.limit;

    return {
        payments,
        items: payments,
        nextCursor: hasMore && lastRow
            ? encodeCursor({ value: String(lastRow[sortConfig.field as keyof PaymentRow] || ""), id: lastRow.id })
            : null,
        hasMore,
        totalCount: count || 0,
        counts: await getPaymentCounts(userId, options.search),
        paymentsError: errorMsg,
    };
}

function emptyPaymentResponse(error: string | null = null) {
    return {
        payments: [] as PaymentRecord[],
        items: [] as PaymentRecord[],
        nextCursor: null,
        hasMore: false,
        totalCount: 0,
        counts: {},
        paymentsError: error,
    };
}

async function getPaymentCounts(userId: string, search: string) {
    const supabase = await createClient();
    const statuses: PaymentStatusFilter[] = ["all", ...paymentStatuses];
    const entries = await Promise.all(statuses.map(async (status) => {
        let query = looseSupabase(supabase).from("payments").select("id", { count: "exact", head: true }).eq("user_id", userId);
        if (status !== "all") query = query.eq("status", status);
        if (search) {
            const escaped = escapeLike(search);
            query = query.or(`receipt.ilike.%${escaped}%,provider_payment_id.ilike.%${escaped}%,provider_order_id.ilike.%${escaped}%,status.ilike.%${escaped}%`);
        }
        const { count } = await query;
        return [status, count || 0] as const;
    }));
    return Object.fromEntries(entries);
}

function derivePaymentStatus(status: string) {
    if (["paid", "published", "captured", "publish_pending", "recovery_pending", "refund_pending", "refunded", "partially_refunded"].includes(status)) {
        return "captured";
    }
    if (status === "authorized") return "authorized";
    if (status === "failed") return "failed";
    if (status === "cancelled") return "cancelled";
    return "created";
}

function derivePublishStatus(status: string) {
    if (status === "published" || status === "paid") return "published";
    if (status === "publish_pending" || status === "recovery_pending" || status === "manual_review") return "publish_pending";
    if (status === "failed") return "failed";
    return "draft";
}

function deriveRefundStatus(status: string) {
    if (status === "refund_pending") return "pending";
    if (status === "refunded" || status === "partially_refunded") return "processed";
    return "none";
}

function deriveRecoveryStatus(status: string) {
    if (status === "recovery_pending") return "pending";
    if (status === "manual_review") return "manual_review";
    if (status === "published" || status === "paid") return "recovered";
    return "none";
}

function isMissingPaymentLifecycleColumn(error: { code?: string; message?: string } | null) {
    if (!error?.message) return false;
    return error.code === "PGRST204" || (
        error.message.includes("payments") &&
        (
            error.message.includes("payment_state") ||
            error.message.includes("publish_state") ||
            error.message.includes("refund_state") ||
            error.message.includes("recovery_state") ||
            error.message.includes("provider_refund_id") ||
            error.message.includes("refund_processed_at") ||
            error.message.includes("manual_review_reason") ||
            error.message.includes("last_error")
        )
    );
}

function parsePaymentSort(value: string | null): PaymentSort {
    return value && value in paymentSorts ? value as PaymentSort : "newest";
}

function parsePaymentStatus(value: string | null): PaymentStatusFilter {
    return paymentStatuses.includes(value as PaymentStatus) ? value as PaymentStatus : "all";
}

function parseLimit(value: string | null, fallback: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(Math.floor(parsed), max);
}

function applyCursor<T>(
    query: T,
    field: string,
    ascending: boolean,
    cursor: { value: string; id: string } | null
): T {
    if (!cursor?.value || !cursor.id) return query;
    const operator = ascending ? "gt" : "lt";
    return (query as { or: (filters: string) => T }).or(
        `${field}.${operator}.${cursor.value},and(${field}.eq.${cursor.value},id.${operator}.${cursor.id})`
    );
}

function encodeCursor(cursor: { value: string; id: string }) {
    return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string | null): { value: string; id: string } | null {
    if (!value) return null;
    try {
        const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
        if (!parsed || typeof parsed !== "object") return null;
        const cursor = parsed as Record<string, unknown>;
        return typeof cursor.value === "string" && typeof cursor.id === "string"
            ? { value: cursor.value, id: cursor.id }
            : null;
    } catch {
        return null;
    }
}

function escapeLike(value: string) {
    return value.replace(/[%_]/g, (match) => `\\${match}`);
}
