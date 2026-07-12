import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = {
    params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Context) {
    const { id } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch source invitation
    const { data: invite, error: fetchError } = await supabase
        .from("invitations")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (fetchError || !invite) {
        return NextResponse.json({ error: "Source invitation not found." }, { status: 404 });
    }

    // 2. Generate unique clean slug
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const newSlug = `${invite.slug}-${randomSuffix}`;

    // 3. Construct clean copy resetting all payments & snapshot credentials
    const { data: newInvite, error: insertError } = await supabase
        .from("invitations")
        .insert({
            user_id: user.id,
            template_id: invite.template_id,
            slug: newSlug,
            category: invite.category,
            title: `${invite.title} (Copy)`,
            primary_name: invite.primary_name,
            secondary_name: invite.secondary_name,
            event_date: invite.event_date,
            event_time: invite.event_time,
            venue_name: invite.venue_name,
            venue_address: invite.venue_address,
            map_link: invite.map_link,
            phone: invite.phone,
            whatsapp: invite.whatsapp,
            message: invite.message,
            music_url: invite.music_url,
            cover_image_url: invite.cover_image_url,
            gallery_urls: invite.gallery_urls,
            theme: invite.theme,
            sections: invite.sections,
            status: "draft",
            lifecycle_status: "draft",
            payment_status: "unpaid",
            published_at: null,
            first_published_at: null,
            completed_at: null,
            archived_at: null,
            original_category: null,
            original_primary_name: null,
            original_secondary_name: null,
            original_event_date: null,
            original_template_id: null,
            identity_snapshot: null,
            identity_fingerprint: null,
            change_risk_status: "low"
        })
        .select("id, slug")
        .single();

    if (insertError || !newInvite) {
        return NextResponse.json({ error: insertError?.message || "Failed to duplicate invitation" }, { status: 400 });
    }

    return NextResponse.json(newInvite, { status: 201 });
}
