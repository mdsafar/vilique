import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publishInvitationAfterPayment } from "@/features/invitations/publish";

type Context = {
    params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Context) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get input (custom slug if provided)
        const body = await request.json().catch(() => ({})) as { slug?: string };
        const customSlug = body.slug?.toLowerCase().trim() || "";

        const result = await publishInvitationAfterPayment({
            userId: user.id,
            invitationId: id,
            customSlug,
        });

        return NextResponse.json({
            id,
            slug: result.slug,
            status: result.status,
            published_at: result.publishedAt,
            publicUrl: result.publicUrl,
        });
    } catch (err: unknown) {
        console.error("Error publishing invitation:", err);
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to publish invitation" }, { status: 400 });
    }
}
