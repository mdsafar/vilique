import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { looseSupabase } from "@/lib/supabase/loose";
import { parseBuilderLockHeaders, type BuilderConflictCode } from "@/features/builder/lib/builderLock";

export async function validateEditorLock(request: Request, invitationId: string, userId: string) {
    const credentials = parseBuilderLockHeaders(request);
    if (!credentials) return { ok: false as const, code: "LOCK_NOT_OWNED" as BuilderConflictCode };
    const { data, error } = await looseSupabase(createAdminClient()).rpc("check_invitation_editor_lock", {
        p_invitation_id: invitationId,
        p_user_id: userId,
        p_editor_session_id: credentials.editorSessionId,
    });
    const lock = (data || {}) as { owned?: boolean; available?: boolean; lockGeneration?: number; revision?: number };
    if (error || !lock.owned) {
        return { ok: false as const, code: (lock.available ? "LOCK_EXPIRED" : "LOCK_TAKEN_OVER") as BuilderConflictCode };
    }
    if (lock.lockGeneration !== credentials.lockGeneration) {
        return { ok: false as const, code: "LOCK_TAKEN_OVER" as BuilderConflictCode };
    }
    if (lock.revision !== credentials.revision) {
        return { ok: false as const, code: "STALE_REVISION" as BuilderConflictCode };
    }
    return { ok: true as const, credentials };
}

export function editorLockConflictResponse(code: BuilderConflictCode) {
    return Response.json({ code, error: "Editing ownership changed. Reload the latest version." }, { status: 409 });
}
