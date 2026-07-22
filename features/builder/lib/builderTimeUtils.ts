export type TimeInputParts = {
    hour: string;
    minute: string;
    period: "AM" | "PM";
};

export function parseTimeRange(value: string) {
    const [rawStart = "", rawEnd = ""] = value
        .split(/\s*[-–—]\s*/)
        .map((part) => part.trim());

    return {
        startTime: toTimeInputValue(rawStart),
        endTime: toTimeInputValue(rawEnd),
    };
}

export function parseTimeInputParts(
    value: string,
): TimeInputParts {
    const [hours = "09", minutes = "00"] = (
        value || "09:00"
    ).split(":");

    const hours24 = Number(hours);
    const period = hours24 >= 12 ? "PM" : "AM";

    const hour = String(
        hours24 % 12 || 12,
    ).padStart(2, "0");

    return {
        hour,
        minute: String(
            Number(minutes) || 0,
        ).padStart(2, "0"),
        period,
    };
}

export function toTimeInputFromParts({
    hour,
    minute,
    period,
}: TimeInputParts) {
    let hours = Number(hour);

    if (period === "PM" && hours < 12) {
        hours += 12;
    }

    if (period === "AM" && hours === 12) {
        hours = 0;
    }

    return `${String(hours).padStart(
        2,
        "0",
    )}:${minute}`;
}

export function toMinutes(value: string) {
    const [hours = "0", minutes = "0"] =
        value.split(":");

    return (
        Number(hours) * 60 +
        Number(minutes)
    );
}

export function fromMinutes(value: number) {
    const clamped = Math.max(
        0,
        Math.min(value, 23 * 60 + 59),
    );

    const hours = Math.floor(clamped / 60);
    const minutes = clamped % 60;

    return `${String(hours).padStart(
        2,
        "0",
    )}:${String(minutes).padStart(2, "0")}`;
}

export function isSelectableTime(
    value: string,
    minTimeMinutes: number | null,
    maxTimeMinutes: number | null = null,
) {
    const minutes = toMinutes(value);

    if (
        minTimeMinutes !== null &&
        minutes < minTimeMinutes
    ) {
        return false;
    }

    if (
        maxTimeMinutes !== null &&
        minutes > maxTimeMinutes
    ) {
        return false;
    }

    return true;
}

export function getMinimumEndTimeMinutes(
    startTime: string,
) {
    return startTime
        ? Math.min(
            toMinutes(startTime) + 1,
            23 * 60 + 59,
        )
        : null;
}

export function getPreferredEndTime(
    startTime: string,
    minEndTimeMinutes: number | null,
) {
    const preferredEndMinutes = startTime
        ? toMinutes(startTime) + 60
        : 21 * 60;

    return fromMinutes(
        Math.max(
            minEndTimeMinutes ?? 0,
            preferredEndMinutes,
        ),
    );
}

export function normalizeTimeRangeForStart(
    startTime: string,
    endTime: string,
) {
    const minEndTimeMinutes =
        getMinimumEndTimeMinutes(startTime);

    const nextEndTime =
        endTime &&
            isSelectableTime(
                endTime,
                minEndTimeMinutes,
            )
            ? endTime
            : getPreferredEndTime(
                startTime,
                minEndTimeMinutes,
            );

    return formatTimeRange(
        startTime,
        nextEndTime,
    );
}

export function toTimeInputValue(value: string) {
    const normalized = value
        .trim()
        .toUpperCase();

    if (!normalized) return "";

    const match = normalized.match(
        /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/,
    );

    if (!match) return "";

    let hours = Number(match[1]);
    const minutes = Number(match[2] || "00");
    const meridiem = match[3];

    if (
        Number.isNaN(hours) ||
        Number.isNaN(minutes) ||
        hours > 23 ||
        minutes > 59
    ) {
        return "";
    }

    if (meridiem === "PM" && hours < 12) {
        hours += 12;
    }

    if (meridiem === "AM" && hours === 12) {
        hours = 0;
    }

    return `${String(hours).padStart(
        2,
        "0",
    )}:${String(minutes).padStart(2, "0")}`;
}

export function formatTimeRange(
    startTime: string,
    endTime: string,
) {
    const startLabel =
        fromTimeInputValue(startTime);

    const endLabel =
        fromTimeInputValue(endTime);

    if (startLabel && endLabel) {
        return `${startLabel} - ${endLabel}`;
    }

    return startLabel || endLabel;
}

export function fromTimeInputValue(
    value: string,
) {
    if (!value) return "";

    const [
        rawHours = "0",
        rawMinutes = "00",
    ] = value.split(":");

    const hours24 = Number(rawHours);
    const minutes = Number(rawMinutes);

    if (
        Number.isNaN(hours24) ||
        Number.isNaN(minutes)
    ) {
        return "";
    }

    const meridiem =
        hours24 >= 12 ? "PM" : "AM";

    const hours12 =
        hours24 % 12 || 12;

    return `${String(hours12).padStart(
        2,
        "0",
    )}:${String(minutes).padStart(
        2,
        "0",
    )} ${meridiem}`;
}

export function formatSavedTime(timestamp: string | number | Date | null | undefined): string {
    if (!timestamp) return "Last saved recently";

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Last saved recently";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 60) {
        return "Last saved just now";
    }

    if (diffMin < 60) {
        return `Last saved ${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
    }

    const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

    const timeString = date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

    if (isToday) {
        return `Last saved today at ${timeString}`;
    }

    if (isYesterday) {
        return `Last saved yesterday at ${timeString}`;
    }

    return `Last saved ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${timeString}`;
}