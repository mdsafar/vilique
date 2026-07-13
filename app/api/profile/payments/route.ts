import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

type PaymentRow = {
    id: string;
    invitation_id: string;
    template_id: string | null;
    amount_paise: number;
    currency: string;
    status: string;
    receipt: string | null;
    created_at: string;
};

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const transactions = await getProfileTransactions(user.id);
        return NextResponse.json(transactions);
    } catch (error) {
        console.error("Failed to fetch profile transactions:", error);
        return NextResponse.json({ error: "Failed to fetch transaction logs" }, { status: 500 });
    }
}

async function getProfileTransactions(userId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("payments")
        .select(`
            id,
            invitation_id,
            template_id,
            amount_paise,
            currency,
            status,
            receipt,
            created_at
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) {
        return { payments: [] as PaymentRecord[], paymentsError: error.message };
    }

    const paymentRows = (data || []) as PaymentRow[];
    const invitationIds = Array.from(new Set(paymentRows.map((payment) => payment.invitation_id).filter(Boolean)));
    const templateIds = Array.from(new Set(paymentRows.map((payment) => payment.template_id).filter(Boolean) as string[]));

    const [invitationsResult, templatesResult] = await Promise.all([
        invitationIds.length
            ? supabase.from("invitations").select("id, title, slug").in("id", invitationIds)
            : Promise.resolve({ data: [], error: null }),
        templateIds.length
            ? supabase.from("invitation_templates").select("id, name").in("id", templateIds)
            : Promise.resolve({ data: [], error: null }),
    ]);

    const invitationMap = new Map((invitationsResult.data || []).map((item) => [
        item.id,
        { title: item.title as string | null, slug: item.slug as string | null },
    ]));
    const templateMap = new Map((templatesResult.data || []).map((item) => [
        item.id,
        item.name as string | null,
    ]));

    const payments = paymentRows.map((payment) => {
        const invitation = invitationMap.get(payment.invitation_id);

        return {
            ...payment,
            templateName: payment.template_id ? templateMap.get(payment.template_id) || null : null,
            invitationTitle: invitation?.title || null,
            invitationSlug: invitation?.slug || null,
        };
    });

    const errorMsg = (invitationsResult.error?.message || templatesResult.error?.message) || null;

    return {
        payments,
        paymentsError: errorMsg,
    };
}
