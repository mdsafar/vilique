import { parseInvitationDateParts } from "@/lib/invitationDate";

type EventPhase = "upcoming" | "in_progress" | "completed";
export type InvitationLifecycleStatus = "draft" | "upcoming" | "live_today" | "completed" | "offline";
type EventTimingInput = {
    eventDate: string | null;
    eventTime?: string | null;
    eventTimezone?: string | null;
};
export type EventLifecycleInput = EventTimingInput & {
    status?: string | null;
    lifecycleStatus?: string | null;
    lifecycle_status?: string | null;
    eventStatus?: string | null;
    event_status?: string | null;
    firstPublishedAt?: string | null;
    first_published_at?: string | null;
    publishedAt?: string | null;
    published_at?: string | null;
};

export function isEventCompleted(
    invitation: EventTimingInput,
    graceHours?: number,
    now?: Date
): boolean;
export function isEventCompleted(
    eventDate: string | null,
    eventTime?: string | null,
    eventTimezone?: string | null,
    graceHours?: number,
    now?: Date
): boolean;
export function isEventCompleted(
    input: EventTimingInput | string | null,
    eventTimeOrGraceHours: string | null | undefined | number = 0,
    eventTimezoneOrNow: string | null | undefined | Date = new Date(),
    graceHours: number = 0,
    now: Date = new Date()
): boolean {
    const invitation = normalizeEventTimingInput(input, eventTimeOrGraceHours, eventTimezoneOrNow);
    const resolvedGraceHours = typeof eventTimeOrGraceHours === "number" ? eventTimeOrGraceHours : graceHours;
    const resolvedNow = eventTimezoneOrNow instanceof Date ? eventTimezoneOrNow : now;
    return getEventPhase(invitation, resolvedGraceHours, resolvedNow) === "completed";
}

function getNormalizedStatusFields(invitation: EventLifecycleInput) {
    return {
        status: invitation.status || null,
        lifecycleStatus: invitation.lifecycleStatus || invitation.lifecycle_status || null,
        eventStatus: invitation.eventStatus || invitation.event_status || null,
    };
}

export function isInvitationCompleted(invitation: EventLifecycleInput, now: Date = new Date()): boolean {
    const { status, lifecycleStatus, eventStatus } = getNormalizedStatusFields(invitation);
    if (isExplicitDraft(invitation)) return false;
    if (!hasEverBeenPublished(invitation)) return false;
    if (lifecycleStatus === "unpublished" || eventStatus === "unpublished" || status !== "published") return false;
    if (lifecycleStatus === "completed" || eventStatus === "completed") return true;
    return isEventCompleted(invitation, 0, now);
}

export function getInvitationLifecycle(
    invitation: EventLifecycleInput,
    now: Date = new Date()
): InvitationLifecycleStatus {
    const { status, lifecycleStatus, eventStatus } = getNormalizedStatusFields(invitation);

    const isOfflineState =
        lifecycleStatus === "unpublished" ||
        lifecycleStatus === "offline" ||
        eventStatus === "unpublished" ||
        eventStatus === "offline" ||
        status === "unpublished" ||
        status === "offline";
    if (isOfflineState) {
        return "offline";
    }

    if (isExplicitDraft(invitation)) {
        return "draft";
    }

    if (!hasEverBeenPublished(invitation)) {
        return "draft";
    }

    if (status !== "published") {
        return "offline";
    }

    if (isInvitationCompleted(invitation, now)) {
        return "completed";
    }

    const phase = getEventPhase(invitation, 0, now);
    if (phase === "upcoming") return "upcoming";
    if (phase === "in_progress") return "live_today";
    return "completed";
}

export function hasEverBeenPublished(invitation: EventLifecycleInput): boolean {
    return Boolean(
        invitation.firstPublishedAt ||
        invitation.first_published_at ||
        invitation.publishedAt ||
        invitation.published_at
    );
}

function isExplicitDraft(invitation: EventLifecycleInput): boolean {
    const { status, lifecycleStatus, eventStatus } = getNormalizedStatusFields(invitation);
    return status === "draft" &&
        (lifecycleStatus === "draft" || !lifecycleStatus) &&
        (eventStatus === "draft" || !eventStatus);
}

export function getEventPhase(
    invitation: EventTimingInput,
    graceHours: number = 0,
    now: Date = new Date()
): EventPhase {
    if (!invitation.eventDate) return "upcoming";

    const timezone = invitation.eventTimezone || "Asia/Kolkata";
    const dateParts = parseInvitationDateParts(invitation.eventDate);
    if (!dateParts) return "upcoming";

    const { startTime, endTime } = parseEventTimeRange(invitation.eventTime);

    try {
        const { year, month, day } = dateParts;
        const nowInTimezone = getNowInTimezone(timezone, now);
        const targetLocalStart = new Date(year, month - 1, day, startTime.hours, startTime.minutes, startTime.seconds);
        const targetLocalEnd = new Date(year, month - 1, day, endTime.hours, endTime.minutes, endTime.seconds);

        if (nowInTimezone.getTime() < targetLocalStart.getTime()) return "upcoming";

        const diffMs = nowInTimezone.getTime() - targetLocalEnd.getTime();
        const graceMs = graceHours * 60 * 60 * 1000;

        return diffMs > graceMs ? "completed" : "in_progress";
    } catch {
        const eventStart = new Date(dateParts.year, dateParts.month - 1, dateParts.day, startTime.hours, startTime.minutes, startTime.seconds);
        const eventEnd = new Date(dateParts.year, dateParts.month - 1, dateParts.day, endTime.hours, endTime.minutes, endTime.seconds);
        const now = Date.now();

        if (now < eventStart.getTime()) return "upcoming";
        return now > eventEnd.getTime() + graceHours * 60 * 60 * 1000 ? "completed" : "in_progress";
    }
}

function normalizeEventTimingInput(
    input: EventTimingInput | string | null,
    eventTimeOrGraceHours: string | null | undefined | number,
    eventTimezoneOrNow: string | null | undefined | Date
): EventTimingInput {
    if (typeof input === "object" && input !== null) return input;

    return {
        eventDate: input,
        eventTime: typeof eventTimeOrGraceHours === "string" ? eventTimeOrGraceHours : null,
        eventTimezone: typeof eventTimezoneOrNow === "string" ? eventTimezoneOrNow : null,
    };
}

function getNowInTimezone(timezone: string, now: Date) {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: false,
    });
    const nowParts = formatter.formatToParts(now);
    const partValues = Object.fromEntries(nowParts.map((p) => [p.type, p.value]));

    return new Date(
        parseInt(partValues.year, 10),
        parseInt(partValues.month, 10) - 1,
        parseInt(partValues.day, 10),
        parseInt(partValues.hour, 10) % 24,
        parseInt(partValues.minute, 10),
        parseInt(partValues.second, 10)
    );
}

function parseEventTimeRange(value: string | null | undefined) {
    const [rawStart = "", rawEnd = ""] = (value || "").split(/\s*[-–—]\s*/).map((part) => part.trim());
    const startTime = parseTime(rawStart, { hours: 0, minutes: 0, seconds: 0 });
    const endTime = parseTime(rawEnd || rawStart, { hours: 23, minutes: 59, seconds: 59 });

    return { startTime, endTime };
}

function parseTime(value: string, fallback: { hours: number; minutes: number; seconds: number }) {
    const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return fallback;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3]?.toUpperCase();

    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    return { hours, minutes, seconds: 0 };
}
