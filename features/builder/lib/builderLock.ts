export const BUILDER_LOCK_HEARTBEAT_MS = 12_000;

export type BuilderLockCredentials = {
    editorSessionId: string;
    lockGeneration: number;
    revision: number;
};

export type BuilderLockStatus = BuilderLockCredentials & {
    owned: boolean;
    available?: boolean;
    expiresAt?: string;
    heartbeatAt?: string;
    code?: BuilderConflictCode;
};

export type BuilderConflictCode =
    | "LOCK_NOT_OWNED"
    | "LOCK_EXPIRED"
    | "LOCK_TAKEN_OVER"
    | "STALE_REVISION";

export function isBuilderConflictCode(value: unknown): value is BuilderConflictCode {
    return ["LOCK_NOT_OWNED", "LOCK_EXPIRED", "LOCK_TAKEN_OVER", "STALE_REVISION"].includes(String(value));
}

export function getEditorSessionId(invitationId: string) {
    const key = `vilique-builder:editor-session:${invitationId}`;
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    const sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
    return sessionId;
}

export function builderLockHeaders(credentials: BuilderLockCredentials) {
    return {
        "X-Vilique-Editor-Session": credentials.editorSessionId,
        "X-Vilique-Lock-Generation": String(credentials.lockGeneration),
        "X-Vilique-Invitation-Revision": String(credentials.revision),
    };
}

export function parseBuilderLockHeaders(request: Request) {
    const editorSessionId = request.headers.get("x-vilique-editor-session") || "";
    const lockGeneration = Number(request.headers.get("x-vilique-lock-generation"));
    const revision = Number(request.headers.get("x-vilique-invitation-revision"));
    if (!isUuid(editorSessionId) || !Number.isSafeInteger(lockGeneration) || lockGeneration < 1
        || !Number.isSafeInteger(revision) || revision < 0) {
        return null;
    }
    return { editorSessionId, lockGeneration, revision };
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
