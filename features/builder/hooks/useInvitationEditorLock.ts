"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    BUILDER_LOCK_HEARTBEAT_MS,
    getEditorSessionId,
    type BuilderLockCredentials,
} from "@/features/builder/lib/builderLock";

type LockMode = "pending" | "owned" | "readonly" | "lost" | "published";
type RefreshCanonical = () => Promise<number | null>;

export function useInvitationEditorLock({
    invitationId,
    onRefreshCanonical,
    onLostOwnership,
    preserveLocalOnResume = false,
    resumeRevision = null,
}: {
    invitationId: string | null;
    onRefreshCanonical: RefreshCanonical;
    onLostOwnership: () => void;
    preserveLocalOnResume?: boolean;
    resumeRevision?: number | null;
}) {
    const [mode, setMode] = useState<LockMode>(invitationId ? "pending" : "owned");
    const [credentials, setCredentials] = useState<BuilderLockCredentials | null>(null);
    const credentialsRef = useRef<BuilderLockCredentials | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const channelRef = useRef<BroadcastChannel | null>(null);

    const publishEvent = useCallback((type: string, generation?: number) => {
        if (!invitationId || !sessionIdRef.current) return;
        const message = { type, sessionId: sessionIdRef.current, generation, at: Date.now() };
        channelRef.current?.postMessage(message);
        localStorage.setItem(`vilique-builder-lock-event:${invitationId}`, JSON.stringify(message));
    }, [invitationId]);

    const loseOwnership = useCallback((nextMode: LockMode = "lost") => {
        credentialsRef.current = null;
        setCredentials(null);
        setMode(nextMode);
        onLostOwnership();
    }, [onLostOwnership]);

    const runAcquire = useCallback(async (takeover: boolean) => {
        if (!invitationId || !sessionIdRef.current) return false;
        setMode("pending");
        try {
            const response = await fetch(`/api/invitations/${invitationId}/editor-lock`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: takeover ? "takeover" : "acquire",
                    editorSessionId: sessionIdRef.current,
                    clientMetadata: { platform: navigator.platform, language: navigator.language },
                }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.owned) {
                loseOwnership("readonly");
                return false;
            }
            const canPreserveLocal = !takeover && preserveLocalOnResume
                && Number.isSafeInteger(resumeRevision)
                && Number(result.revision) === resumeRevision;
            const revision = canPreserveLocal ? Number(resumeRevision) : await onRefreshCanonical();
            if (revision === null) {
                loseOwnership("readonly");
                return false;
            }
            const next = {
                editorSessionId: sessionIdRef.current,
                lockGeneration: Number(result.lockGeneration),
                revision,
            };
            credentialsRef.current = next;
            setCredentials(next);
            setMode("owned");
            publishEvent(takeover ? "taken-over" : "acquired", next.lockGeneration);
            return true;
        } catch {
            loseOwnership("readonly");
            return false;
        }
    }, [invitationId, loseOwnership, onRefreshCanonical, preserveLocalOnResume, publishEvent, resumeRevision]);

    useEffect(() => {
        if (!invitationId) {
            return;
        }
        sessionIdRef.current = getEditorSessionId(invitationId);
        if ("BroadcastChannel" in window) {
            channelRef.current = new BroadcastChannel(`vilique-builder-lock:${invitationId}`);
        }
        const receive = (message: { type?: string; sessionId?: string; generation?: number }) => {
            const current = credentialsRef.current;
            if (!message.sessionId || message.sessionId === sessionIdRef.current) return;
            if (message.type === "released") {
                void runAcquire(false);
                return;
            }
            if (message.type === "published") {
                loseOwnership("published");
                return;
            }
            if (message.type === "taken-over"
                || (message.generation && current && message.generation > current.lockGeneration)) {
                loseOwnership("lost");
            }
        };
        if (channelRef.current) channelRef.current.onmessage = (event) => receive(event.data || {});
        const onStorage = (event: StorageEvent) => {
            if (event.key !== `vilique-builder-lock-event:${invitationId}` || !event.newValue) return;
            try { receive(JSON.parse(event.newValue)); } catch { /* ignore malformed peer events */ }
        };
        window.addEventListener("storage", onStorage);
        const acquireTimer = window.setTimeout(() => void runAcquire(false), 0);
        return () => {
            window.clearTimeout(acquireTimer);
            window.removeEventListener("storage", onStorage);
            channelRef.current?.close();
            channelRef.current = null;
        };
    }, [invitationId, loseOwnership, runAcquire]);

    useEffect(() => {
        if (!invitationId || mode !== "owned" || !credentials) return;
        const heartbeat = async () => {
            try {
                const response = await fetch(`/api/invitations/${invitationId}/editor-lock`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "heartbeat", editorSessionId: credentials.editorSessionId,
                        lockGeneration: credentials.lockGeneration }),
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok || !result.owned) loseOwnership("lost");
            } catch {
                // A transient failure is not ownership loss; the 55s server lease is authoritative.
            }
        };
        const timer = window.setInterval(() => void heartbeat(), BUILDER_LOCK_HEARTBEAT_MS);
        const onOnline = () => void heartbeat();
        window.addEventListener("online", onOnline);
        return () => { window.clearInterval(timer); window.removeEventListener("online", onOnline); };
    }, [credentials, invitationId, loseOwnership, mode]);

    const updateRevision = useCallback((revision: number) => {
        const current = credentialsRef.current;
        if (!current) return;
        const next = { ...current, revision };
        credentialsRef.current = next;
        setCredentials(next);
    }, []);

    const release = useCallback(() => {
        const current = credentialsRef.current;
        if (!invitationId || !current) return;
        publishEvent("released", current.lockGeneration);
        void fetch(`/api/invitations/${invitationId}/editor-lock`, {
            method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "release", editorSessionId: current.editorSessionId,
                lockGeneration: current.lockGeneration }),
        });
        credentialsRef.current = null;
    }, [invitationId, publishEvent]);

    const markPublished = useCallback(() => {
        const current = credentialsRef.current;
        publishEvent("published", current?.lockGeneration);
        credentialsRef.current = null;
        setCredentials(null);
        setMode("published");
    }, [publishEvent]);

    return {
        mode,
        credentials,
        isReadOnly: Boolean(invitationId) && mode !== "owned",
        takeOver: () => runAcquire(true),
        revalidate: () => runAcquire(false),
        refresh: onRefreshCanonical,
        updateRevision,
        release,
        markPublished,
        publishEvent,
    };
}
