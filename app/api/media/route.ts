import { NextResponse } from "next/server";
import { mediaUploadSchema } from "@/features/invitations/validation";
import { createClient } from "@/lib/supabase/server";
import { isInvitationCompleted } from "@/lib/lifecycle";
import { reportError } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { looseSupabase } from "@/lib/supabase/loose";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const musicTypes = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg"]);
const maxImageBytes = 10 * 1024 * 1024;
const maxMusicBytes = 10 * 1024 * 1024;
const maxImagePixels = 16_000_000;
const maxImageSide = 6000;
const maxAudioSeconds = 8 * 60;
const maxFilesPerInvitationKind = 40;
const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
};

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

    const editorSessionId = String(formData.get("editorSessionId") || "");
    const lockGeneration = Number(formData.get("lockGeneration"));
    const expectedRevision = Number(formData.get("revision"));
    if (!isUuid(editorSessionId) || !Number.isSafeInteger(lockGeneration) || !Number.isSafeInteger(expectedRevision)) {
        return NextResponse.json({ code: "LOCK_NOT_OWNED", error: "A valid editor lock is required." }, { status: 409 });
    }
    const { data: lockData, error: lockError } = await looseSupabase(createAdminClient()).rpc("check_invitation_editor_lock", {
        p_invitation_id: parsed.data.invitationId,
        p_user_id: user.id,
        p_editor_session_id: editorSessionId,
    });
    const lock = (lockData || {}) as { owned?: boolean; lockGeneration?: number; revision?: number; available?: boolean };
    if (lockError || !lock.owned || lock.lockGeneration !== lockGeneration || lock.revision !== expectedRevision) {
        const code = lock.revision !== expectedRevision ? "STALE_REVISION" : lock.available ? "LOCK_EXPIRED" : "LOCK_TAKEN_OVER";
        return NextResponse.json({ code, error: "Editing ownership changed. Reload the latest version." }, { status: 409 });
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

    if (!allowedTypes.has(file.type) || file.size > maxBytes || file.size <= 0) {
        return NextResponse.json({ error: "Unsupported file type or size." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasAllowedSignature(bytes, file.type)) {
        return NextResponse.json({ error: "Uploaded file content does not match the declared type." }, { status: 400 });
    }

    if (!isMusic) {
        const dimensions = getImageDimensions(bytes, file.type);
        if (!dimensions || dimensions.width > maxImageSide || dimensions.height > maxImageSide || dimensions.width * dimensions.height > maxImagePixels) {
            return NextResponse.json({ error: "Image dimensions are too large." }, { status: 400 });
        }
    } else {
        const duration = getAudioDurationSeconds(bytes, file.type);
        if (duration !== null && duration > maxAudioSeconds) {
            return NextResponse.json({ error: "Audio duration is too long." }, { status: 400 });
        }
    }

    const extension = extensionByType[file.type] || (isMusic ? "mp3" : "jpg");
    const isPublished = invitation.status === "published";
    const bucket = isMusic
        ? (isPublished ? "invitation-music" : "invitation-draft-music")
        : (isPublished ? "invitation-images" : "invitation-draft-images");
    const path = `${user.id}/${parsed.data.invitationId}/${crypto.randomUUID()}.${extension}`;
    const folder = `${user.id}/${parsed.data.invitationId}`;
    const { data: existingFiles } = await supabase.storage.from(bucket).list(folder, { limit: maxFilesPerInvitationKind + 1 });
    if ((existingFiles?.length || 0) >= maxFilesPerInvitationKind) {
        return NextResponse.json({ error: "Media quota reached for this invitation." }, { status: 429 });
    }

    const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
        contentType: file.type,
        upsert: false,
        cacheControl: isPublished ? "31536000" : "private, max-age=300",
        metadata: {
            originalNameHash: await digestText(file.name),
            scanStatus: "pending",
            visibility: isPublished ? "published" : "draft",
        },
    });

    if (error) {
        reportError(error, "media.upload_failed", { invitationId: parsed.data.invitationId, kind: parsed.data.kind });
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (isPublished) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return NextResponse.json({ url: data.publicUrl, path, bucket, visibility: "published" });
    }

    const { data: signed, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(path, 15 * 60);
    if (signedError) {
        reportError(signedError, "media.signed_url_failed", { invitationId: parsed.data.invitationId, path, bucket });
        return NextResponse.json({ error: signedError.message }, { status: 400 });
    }

    return NextResponse.json({ url: signed.signedUrl, path, bucket, visibility: "draft", expiresIn: 900 });
}

export async function DELETE(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as { bucket?: string; path?: string; invitationId?: string };
    if (!body.bucket || !body.path || !body.invitationId) {
        return NextResponse.json({ error: "Invalid delete request." }, { status: 400 });
    }

    const allowedBuckets = new Set(["invitation-images", "invitation-music", "invitation-draft-images", "invitation-draft-music"]);
    if (!allowedBuckets.has(body.bucket) || !body.path.startsWith(`${user.id}/${body.invitationId}/`)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { data: invitation } = await supabase
        .from("invitations")
        .select("id")
        .eq("id", body.invitationId)
        .eq("user_id", user.id)
        .single();

    if (!invitation) {
        return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    const { error } = await supabase.storage.from(body.bucket).remove([body.path]);
    if (error) {
        reportError(error, "media.delete_failed", { invitationId: body.invitationId, bucket: body.bucket, path: body.path });
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
}

function hasAllowedSignature(bytes: Uint8Array, mime: string) {
    if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (mime === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (mime === "image/webp") return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP";
    if (mime === "image/gif") return ascii(bytes, 0, 3) === "GIF";
    if (mime === "audio/mpeg") return bytes[0] === 0xff || ascii(bytes, 0, 3) === "ID3";
    if (mime === "audio/wav") return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WAVE";
    if (mime === "audio/ogg") return ascii(bytes, 0, 4) === "OggS";
    if (mime === "audio/mp4") return ascii(bytes, 4, 8) === "ftyp";
    return false;
}

function ascii(bytes: Uint8Array, start: number, end: number) {
    return String.fromCharCode(...bytes.slice(start, end));
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getImageDimensions(bytes: Uint8Array, mime: string) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (mime === "image/png" && bytes.byteLength >= 24) {
        return { width: view.getUint32(16), height: view.getUint32(20) };
    }
    if (mime === "image/gif" && bytes.byteLength >= 10) {
        return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
    }
    if (mime === "image/webp" && bytes.byteLength >= 30) {
        if (ascii(bytes, 12, 16) === "VP8X") {
            const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
            const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
            return { width, height };
        }
        return null;
    }
    if (mime === "image/jpeg") {
        return getJpegDimensions(bytes);
    }
    return null;
}

function getJpegDimensions(bytes: Uint8Array) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) return null;
        const marker = bytes[offset + 1];
        const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
        if (marker >= 0xc0 && marker <= 0xc3) {
            return {
                height: (bytes[offset + 5] << 8) + bytes[offset + 6],
                width: (bytes[offset + 7] << 8) + bytes[offset + 8],
            };
        }
        offset += 2 + length;
    }
    return null;
}

function getAudioDurationSeconds(bytes: Uint8Array, mime: string) {
    if (mime === "audio/wav" && bytes.byteLength > 44) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const byteRate = view.getUint32(28, true);
        const dataBytes = view.getUint32(40, true);
        return byteRate > 0 ? dataBytes / byteRate : null;
    }
    return null;
}

async function digestText(value: string) {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
