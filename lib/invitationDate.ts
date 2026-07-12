export type CalendarDateParts = {
    year: number;
    month: number;
    day: number;
};

export function parseInvitationDateParts(value: string | null | undefined): CalendarDateParts | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;

    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
        return validateDateParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    }

    const displayMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (displayMatch) {
        return validateDateParts(Number(displayMatch[3]), Number(displayMatch[2]), Number(displayMatch[1]));
    }

    return null;
}

export function normalizeInvitationDateValue(value: string | null | undefined): string | null {
    const parts = parseInvitationDateParts(value);
    if (!parts) return null;

    return [
        String(parts.year).padStart(4, "0"),
        String(parts.month).padStart(2, "0"),
        String(parts.day).padStart(2, "0"),
    ].join("-");
}

function validateDateParts(year: number, month: number, day: number): CalendarDateParts | null {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return { year, month, day };
}
