import { NextResponse } from "next/server";
import { createDefaultInvitation } from "@/lib/defaultInvitation";
import { mapInvitationRow } from "@/features/invitations/mappers";
import { createClient } from "@/lib/supabase/server";
import { invitationCreateSchema } from "@/features/invitations/validation";

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = invitationCreateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data: template, error: templateError } = await supabase
        .from("invitation_templates")
        .select("id, template_key, category, accent_color")
        .eq("template_key", parsed.data.templateKey)
        .single();

    if (templateError || !template) {
        return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    const defaults = createDefaultInvitation();
    const slug = `${defaults.primaryName}-${defaults.secondaryName || "invite"}-${crypto.randomUUID().slice(0, 8)}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const { data, error } = await supabase
        .from("invitations")
        .insert({
            user_id: user.id,
            template_id: template.id,
            slug,
            category: template.category,
            title: defaults.title,
            primary_name: defaults.primaryName,
            secondary_name: defaults.secondaryName,
            event_date: defaults.eventDate,
            event_time: defaults.eventTime,
            venue_name: defaults.venueName,
            venue_address: defaults.venueAddress,
            map_link: defaults.mapLink,
            phone: defaults.phone,
            message: defaults.message,
            music_url: defaults.musicUrl,
            theme: {
                ...defaults.theme,
                primaryColor: template.accent_color || defaults.theme.primaryColor,
            },
            sections: {},
            gallery_urls: [],
            status: "draft",
        })
        .select("*, invitation_templates(template_key)")
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(mapInvitationRow(data), { status: 201 });
}
