import { createDefaultInvitation } from "@/lib/defaultInvitation";
import {
    normalizeInvitationDateValue,
    parseInvitationDateParts,
} from "@/lib/invitationDate";
import type { InvitationData } from "@/types/invitation";

export function startOfDate(date: Date) {
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
    );
}

export function startOfMonth(date: Date) {
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        1,
    );
}

export function isPastDate(
    date: Date,
    minDate: Date,
) {
    return (
        startOfDate(date).getTime() <
        startOfDate(minDate).getTime()
    );
}

export function getNextSelectableMinute(date: Date) {
    const nextMinute = new Date(
        date.getTime() + 60 * 1000,
    );

    return (
        nextMinute.getHours() * 60 +
        nextMinute.getMinutes()
    );
}

export function getMinimumEventDate(date: Date) {
    const nextMinute = new Date(
        date.getTime() + 60 * 1000,
    );

    const minuteOfDay =
        nextMinute.getHours() * 60 +
        nextMinute.getMinutes();

    if (minuteOfDay > 23 * 60 + 58) {
        return startOfDate(
            new Date(
                nextMinute.getFullYear(),
                nextMinute.getMonth(),
                nextMinute.getDate() + 1,
            ),
        );
    }

    return startOfDate(nextMinute);
}

export function parseDateValue(value: string) {
    const parts = parseInvitationDateParts(value);

    if (!parts) {
        return null;
    }

    return new Date(
        parts.year,
        parts.month - 1,
        parts.day,
    );
}

export function isValidDateValue(value: string) {
    return normalizeInvitationDateValue(value) !== null;
}

export function toDateInputValue(date: Date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}

export function formatDisplayDate(date: Date) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
}

export function addMonths(
    date: Date,
    amount: number,
) {
    return new Date(
        date.getFullYear(),
        date.getMonth() + amount,
        1,
    );
}

export function getCalendarDays(month: Date) {
    const firstDay = new Date(
        month.getFullYear(),
        month.getMonth(),
        1,
    );

    const start = new Date(firstDay);

    start.setDate(
        firstDay.getDate() - firstDay.getDay(),
    );

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start);

        date.setDate(start.getDate() + index);

        return date;
    });
}

export function isSameDate(
    left: Date,
    right: Date,
) {
    return (
        left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate()
    );
}

export function normalizeInvitationDate<
    T extends InvitationData,
>(invitation: T): T {
    const defaults = createDefaultInvitation();

    const normalizedEventDate =
        normalizeInvitationDateValue(
            invitation.eventDate,
        );

    const invitationWithDefaults = {
        ...invitation,
        phone: invitation.phone || defaults.phone,
        secondaryPhone:
            invitation.secondaryPhone ||
            defaults.secondaryPhone,
    };

    if (normalizedEventDate) {
        return {
            ...invitationWithDefaults,
            eventDate: normalizedEventDate,
        };
    }

    return {
        ...invitationWithDefaults,
        eventDate: toDateInputValue(new Date()),
    };
}