import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSlugAvailable } from "@/features/invitations/slug";

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

    // 1. Fetch current invitation to validate
    const { data: invite, error: fetchError } = await supabase
        .from("invitations")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (fetchError || !invite) {
        return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    // Validate required invitation fields on the server
    if (!invite.title?.trim()) {
        return NextResponse.json({ error: "Title is required to publish" }, { status: 400 });
    }
    if (!invite.primary_name?.trim()) {
        return NextResponse.json({ error: "Host/Couple name is required to publish" }, { status: 400 });
    }
    if (!invite.event_date) {
        return NextResponse.json({ error: "Event date is required to publish" }, { status: 400 });
    }
    if (!invite.venue_name?.trim()) {
        return NextResponse.json({ error: "Venue name is required to publish" }, { status: 400 });
    }
    if (!invite.message?.trim()) {
        return NextResponse.json({ error: "Invitation message is required to publish" }, { status: 400 });
    }

    // Get input (custom slug if provided)
    const body = await request.json().catch(() => ({}));
    const customSlug = body.slug?.toLowerCase().trim() || "";

    // Determine final slug
    let finalSlug = invite.slug;
    if (customSlug && customSlug !== invite.slug) {
        // Validate slug format
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(customSlug) || customSlug.length < 3 || customSlug.length > 80) {
            return NextResponse.json({ error: "Invalid slug format (min 3 chars, lowercase letters, numbers, and hyphens only)" }, { status: 400 });
        }

        // Check availability
        const isAvailable = await isSlugAvailable(customSlug, id);
        if (!isAvailable) {
            return NextResponse.json({ error: "The customized link is already taken" }, { status: 400 });
        }

        finalSlug = customSlug;
    }

    const { data, error } = await supabase
        .from("invitations")
        .update({
            slug: finalSlug,
            status: "published",
            published_at: invite.published_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id, slug, status, published_at")
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
}
