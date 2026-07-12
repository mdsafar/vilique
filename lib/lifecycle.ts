/**
 * Checks whether an event has completed based on its date, time range,
 * timezone, and a grace period (in hours).
 */
export function isEventCompleted(
    invitation: {
        eventDate: string | null;
        eventTime?: string | null;
        eventTimezone?: string | null;
    },
    graceHours: number = 6
): boolean {
    if (!invitation.eventDate) return false;

    const timezone = invitation.eventTimezone || "Asia/Kolkata";
    const dateStr = invitation.eventDate;

    let timeStr = "";
    if (invitation.eventTime) {
        const parts = invitation.eventTime.split("-");
        // Get the end time if it exists (e.g. "09:00 PM" in "05:30 PM - 09:00 PM"),
        // otherwise get the start time.
        timeStr = parts[1]?.trim() || parts[0]?.trim() || "";
    }

    // Default to the end of the day if no time range is specified
    if (!timeStr) {
        timeStr = "23:59:59";
    }

    try {
        const [year, month, day] = dateStr.split("-").map(Number);
        let hours = 23;
        let minutes = 59;
        let seconds = 59;

        if (timeStr !== "23:59:59") {
            const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
            if (match) {
                let h = parseInt(match[1], 10);
                const m = parseInt(match[2], 10);
                const period = match[3]?.toUpperCase();

                if (period === "PM" && h < 12) h += 12;
                if (period === "AM" && h === 12) h = 0;

                hours = h;
                minutes = m;
                seconds = 0;
            }
        }

        // Construct target end time in the specified timezone
        // We can do this accurately in vanilla JS by parsing the current time in the invitation's timezone,
        // and comparing it to a local date representation.
        const nowInTimezoneStr = new Date().toLocaleString("en-US", { timeZone: timezone });
        const nowInTimezone = new Date(nowInTimezoneStr);

        const targetLocalEnd = new Date(year, month - 1, day, hours, minutes, seconds);

        const diffMs = nowInTimezone.getTime() - targetLocalEnd.getTime();
        const graceMs = graceHours * 60 * 60 * 1000;

        return diffMs > graceMs;
    } catch (e) {
        // Fallback to local system time comparison if timezone formatting fails
        const parts = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        let h = 23;
        let m = 59;
        if (parts) {
            h = parseInt(parts[1], 10);
            m = parseInt(parts[2], 10);
            if (parts[3]?.toUpperCase() === "PM" && h < 12) h += 12;
            if (parts[3]?.toUpperCase() === "AM" && h === 12) h = 0;
        }
        const eventEnd = new Date(dateStr);
        eventEnd.setHours(h, m, 0, 0);

        return Date.now() > eventEnd.getTime() + graceHours * 60 * 60 * 1000;
    }
}
