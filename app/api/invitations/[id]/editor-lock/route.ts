import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { looseSupabase } from "@/lib/supabase/loose";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/security/requestGuard";
import { reportError } from "@/lib/observability";

type Context = { params: Promise<{ id: string }> };
type Action = "acquire" | "takeover" | "heartbeat" | "check" | "release";

export async function POST(request: Request, { params }: Context) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({})) as {
        action?: Action;
        editorSessionId?: string;
        lockGeneration?: number;
        clientMetadata?: Record<string, unknown>;
    };
    if (!body.action || !isUuid(body.editorSessionId || "")) {
        return NextResponse.json({ error: "Invalid lock request." }, { status: 400 });
    }
    if (body.action === "takeover") {
        const limit = await rateLimit({
            key: `builder-lock-takeover:${user.id}:${id}:${getClientIp(request)}`,
            limit: 8,
            windowMs: 60_000,
        });
        if (!limit.ok) return rateLimitResponse(limit.resetAt);
    }

    const admin = looseSupabase(createAdminClient());
    let result: { data: unknown; error: { code?: string; message?: string } | null };
    if (body.action === "acquire" || body.action === "takeover") {
        result = await admin.rpc("acquire_invitation_editor_lock", {
            p_invitation_id: id,
            p_user_id: user.id,
            p_editor_session_id: body.editorSessionId,
            p_takeover: body.action === "takeover",
            p_client_metadata: sanitizeMetadata(body.clientMetadata),
        });
    } else if (body.action === "check") {
        result = await admin.rpc("check_invitation_editor_lock", {
            p_invitation_id: id,
            p_user_id: user.id,
            p_editor_session_id: body.editorSessionId,
        });
    } else {
        if (!Number.isSafeInteger(body.lockGeneration) || Number(body.lockGeneration) < 1) {
            return NextResponse.json({ error: "Invalid lock generation." }, { status: 400 });
        }
        const rpc = body.action === "heartbeat"
            ? "heartbeat_invitation_editor_lock"
            : "release_invitation_editor_lock";
        result = await admin.rpc(rpc, {
            p_invitation_id: id,
            p_user_id: user.id,
            p_editor_session_id: body.editorSessionId,
            p_lock_generation: body.lockGeneration,
        });
    }

    if (result.error) {
        const status = result.error.code === "P0002" ? 404 : 400;
        if (status !== 404) reportError(result.error, "invitation.editor_lock_failed", { invitationId: id, action: body.action });
        return NextResponse.json({ error: status === 404 ? "Invitation not found." : "Lock operation failed." }, { status });
    }
    return NextResponse.json(typeof result.data === "boolean" ? { released: result.data } : result.data);
}

function sanitizeMetadata(value?: Record<string, unknown>) {
    if (!value) return {};
    return {
        platform: typeof value.platform === "string" ? value.platform.slice(0, 80) : undefined,
        language: typeof value.language === "string" ? value.language.slice(0, 30) : undefined,
    };
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
