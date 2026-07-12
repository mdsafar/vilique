import crypto from "crypto";

/**
 * Normalizes text by lowercasing, removing punctuation, honorifics,
 * and collapsing extra whitespace to handle variations in user formatting.
 */
export function normalizeText(text: string | null | undefined): string {
    if (!text) return "";
    return text
        .toLowerCase()
        // Remove common honorifics and connectors
        .replace(/\b(mr\.|mrs\.|ms\.|dr\.|mr|mrs|ms|dr|weds|wedding|celebrate|and|&)\b/gi, "")
        // Remove punctuation
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        // Collapse white space
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Generates event fingerprint string based on category, sorted normalized names,
 * event date, template configuration, and owner.
 */
export function generateEventFingerprint({
    category,
    primaryName,
    secondaryName,
    eventDate,
    userId,
    templateId,
}: {
    category: string;
    primaryName: string;
    secondaryName?: string | null;
    eventDate: string;
    userId: string;
    templateId: string;
}): string {
    const normPrimary = normalizeText(primaryName);
    const normSecondary = normalizeText(secondaryName || "");

    // Sort names to make fingerprint order-independent (e.g. Maya & Arjun vs Arjun & Maya)
    const names = [normPrimary, normSecondary].filter(Boolean).sort();

    const parts = [
        category.toLowerCase().trim(),
        names.join("|"),
        eventDate.trim(),
        userId,
        templateId,
    ];

    return crypto.createHash("sha256").update(parts.join("::")).digest("hex");
}

type Snapshot = {
    original_category: string;
    original_primary_name: string;
    original_secondary_name?: string | null;
    original_event_date: string;
    original_template_id: string;
};

type Proposed = {
    category?: string;
    primaryName?: string;
    secondaryName?: string | null;
    eventDate?: string | null;
    templateId?: string | null;
};

/**
 * Compares a proposed invitation update against the original publication identity snapshot.
 * Detects whether changes are minor (allowed spelling/venue/rescheduling corrections)
 * or major (silently recycling the payment for a completely different event).
 */
export function assessChangeRisk(
    snapshot: Snapshot,
    proposed: Proposed
): {
    riskLevel: "low" | "medium" | "high";
    decision: "allowed" | "warned" | "blocked" | "duplicated" | "manually_approved";
    reason: string;
} {
    // 1. Check category change
    if (proposed.category && proposed.category !== snapshot.original_category) {
        return {
            riskLevel: "high",
            decision: "blocked",
            reason: `Changing event category from '${snapshot.original_category}' to '${proposed.category}' constitutes a different event type.`,
        };
    }

    // 2. Check names change
    if (proposed.primaryName !== undefined || proposed.secondaryName !== undefined) {
        const origP = normalizeText(snapshot.original_primary_name);
        const origS = normalizeText(snapshot.original_secondary_name || "");

        const propP = normalizeText(proposed.primaryName !== undefined ? proposed.primaryName : snapshot.original_primary_name);
        const propS = normalizeText(proposed.secondaryName !== undefined ? proposed.secondaryName : (snapshot.original_secondary_name || ""));

        const origTokens = [...origP.split(" "), ...origS.split(" ")].filter((t) => t.length > 2);
        const propTokens = [...propP.split(" "), ...propS.split(" ")].filter((t) => t.length > 2);

        // Direct comparison if no long tokens exist
        if (origTokens.length === 0 || propTokens.length === 0) {
            const origCombined = [origP, origS].filter(Boolean).sort().join("|");
            const propCombined = [propP, propS].filter(Boolean).sort().join("|");
            if (origCombined !== propCombined) {
                return {
                    riskLevel: "high",
                    decision: "blocked",
                    reason: "Host name has been completely replaced.",
                };
            }
        } else {
            // Check if there is at least one overlapping token (e.g. Arjun is still Arjun)
            const hasSharedToken = origTokens.some((ot) => propTokens.includes(ot));
            if (!hasSharedToken) {
                return {
                    riskLevel: "high",
                    decision: "blocked",
                    reason: "Both host/couple names have been completely replaced with unrelated names.",
                };
            }
        }
    }

    // 3. Check extreme date change (legitimate rescheduling is allowed, but changing dates after completion or moving by months is flagged)
    if (proposed.eventDate && proposed.eventDate !== snapshot.original_event_date) {
        const origDate = new Date(snapshot.original_event_date);
        const propDate = new Date(proposed.eventDate);

        if (!isNaN(origDate.getTime()) && !isNaN(propDate.getTime())) {
            const diffDays = Math.abs(propDate.getTime() - origDate.getTime()) / (1000 * 60 * 60 * 24);
            // Flag rescheduling changes that shift the event by more than 90 days
            if (diffDays > 90) {
                return {
                    riskLevel: "medium",
                    decision: "warned",
                    reason: "Rescheduling shifts the event date by more than 90 days. Please verify this is the same event.",
                };
            }
        }
    }

    return {
        riskLevel: "low",
        decision: "allowed",
        reason: "Changes classify as minor details corrections (spelling, date shift, template, theme, maps, etc.).",
    };
}
