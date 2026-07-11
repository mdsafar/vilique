export type AnalyticsEventType =
    | "view"
    | "share"
    | "music_play"
    | "map_click"
    | "call_click"
    | "whatsapp_click"
    | "rsvp_submit";

export async function trackInvitationEvent(invitationId: string, eventType: AnalyticsEventType, metadata: Record<string, unknown> = {}) {
    // Simple session-storage deduplication for "view" events to avoid inflating view counts on refresh
    if (eventType === "view") {
        const key = `viliqu_viewed_${invitationId}`;
        try {
            if (sessionStorage.getItem(key)) {
                return;
            }
            sessionStorage.setItem(key, "true");
        } catch {
            // Fallback if sessionStorage is blocked
        }
    }

    await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, eventType, metadata }),
    }).catch(() => undefined);
}
