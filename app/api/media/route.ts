import { NextResponse } from "next/server";
import { mediaUploadSchema } from "@/features/invitations/validation";
import { createClient } from "@/lib/supabase/server";
import { isInvitationCompleted } from "@/lib/lifecycle";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const musicTypes = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg"]);
const maxImageBytes = 10 * 1024 * 1024;
const maxMusicBytes = 10 * 1024 * 1024;

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const parsed = mediaUploadSchema.safeParse({
        invitationId: formData.get("invitationId"),
        kind: formData.get("kind"),
    });

    if (!parsed.success || !(file instanceof File)) {
        return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
    }

    const { data: invitation } = await supabase
        .from("invitations")
        .select("id, status, event_date, event_time, event_timezone, lifecycle_status, event_status, first_published_at, published_at")
        .eq("id", parsed.data.invitationId)
        .eq("user_id", user.id)
        .single();

    if (!invitation) {
        return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    if (isInvitationCompleted({
        eventDate: invitation.event_date,
        eventTime: invitation.event_time,
        eventTimezone: invitation.event_timezone,
        status: invitation.status,
        lifecycleStatus: invitation.lifecycle_status,
        eventStatus: invitation.event_status,
        first_published_at: invitation.first_published_at,
        published_at: invitation.published_at,
    })) {
        return NextResponse.json({
            code: "INVITATION_COMPLETED_LOCKED",
            error: "This invitation is completed and can no longer be edited.",
        }, { status: 409 });
    }

    const isMusic = parsed.data.kind === "music";
    const allowedTypes = isMusic ? musicTypes : imageTypes;
    const maxBytes = isMusic ? maxMusicBytes : maxImageBytes;

    if (!allowedTypes.has(file.type) || file.size > maxBytes) {
        return NextResponse.json({ error: "Unsupported file type or size." }, { status: 400 });
    }

    const extension = file.name.split(".").pop() || (isMusic ? "mp3" : "jpg");
    const bucket = isMusic ? "invitation-music" : "invitation-images";
    const path = `${user.id}/${parsed.data.invitationId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type,
        upsert: false,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl, path, bucket });
}
