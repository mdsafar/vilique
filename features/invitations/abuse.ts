import crypto from "crypto";
import { parseInvitationDateParts } from "../../lib/invitationDate";

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

    // Sort names to make fingerprint order-independent (e.g. Name 1 & Name 2 vs Name 2 & Name 1)
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

export type EventIdentitySnapshot = {
    original_category: string;
    original_primary_name: string;
    original_secondary_name?: string | null;
    original_event_date: string;
    original_template_id: string | null;
    original_venue_name?: string | null;
    original_venue_address?: string | null;
    original_message?: string | null;
    owner_id?: string | null;
    first_published_at?: string | null;
    first_payment_id?: string | null;
    first_publish_version?: number | null;
};

type Proposed = {
    category?: string;
    primaryName?: string;
    secondaryName?: string | null;
    eventDate?: string | null;
    templateId?: string | null;
    venueName?: string | null;
    venueAddress?: string | null;
    message?: string | null;
};

export type EventChangeRisk = {
    riskLevel: "low" | "medium" | "high";
    decision: "allowed" | "warned" | "blocked" | "duplicated" | "manually_approved";
    score: number;
    reason: string;
    signals: string[];
};

/**
 * Compares a proposed invitation update against the original publication identity snapshot.
 * Detects whether changes are minor (allowed spelling/venue/rescheduling corrections)
 * or major (silently recycling the payment for a completely different event).
 */
export function assessChangeRisk(
    snapshot: EventIdentitySnapshot,
    proposed: Proposed
): EventChangeRisk {
    let score = 0;
    const signals: string[] = [];

    if (proposed.category && proposed.category !== snapshot.original_category) {
        score += isRelatedCategory(snapshot.original_category, proposed.category) ? 30 : 55;
        signals.push(`Category changed from '${snapshot.original_category}' to '${proposed.category}'.`);
    }

    if (proposed.primaryName !== undefined || proposed.secondaryName !== undefined) {
        const origP = normalizeText(snapshot.original_primary_name);
        const origS = normalizeText(snapshot.original_secondary_name || "");

        const propP = normalizeText(proposed.primaryName !== undefined ? proposed.primaryName : snapshot.original_primary_name);
        const propS = normalizeText(proposed.secondaryName !== undefined ? proposed.secondaryName : (snapshot.original_secondary_name || ""));

        const nameSimilarity = tokenSimilarity([origP, origS].join(" "), [propP, propS].join(" "));

        if (nameSimilarity < 0.2) {
            score += 45;
            signals.push("Host/couple names appear completely replaced.");
        } else if (nameSimilarity < 0.55) {
            score += 25;
            signals.push("Host/couple names changed significantly.");
        } else if (nameSimilarity < 0.9) {
            score += 8;
            signals.push("Host/couple names changed slightly.");
        }
    }

    if (proposed.eventDate && proposed.eventDate !== snapshot.original_event_date) {
        const diffDays = getDateDiffDays(snapshot.original_event_date, proposed.eventDate);

        if (diffDays !== null) {
            if (diffDays > 365) {
                score += 28;
                signals.push("Event date moved by more than one year.");
            } else if (diffDays > 180) {
                score += 22;
                signals.push("Event date moved by more than six months.");
            } else if (diffDays > 90) {
                score += 12;
                signals.push("Event date moved by more than three months.");
            } else if (diffDays > 30) {
                score += 5;
                signals.push("Event date moved by more than one month.");
            }
        }
    }

    const venueOriginal = [snapshot.original_venue_name, snapshot.original_venue_address].filter(Boolean).join(" ");
    const venueProposed = [proposed.venueName, proposed.venueAddress].filter((value) => value !== undefined).join(" ");
    if (venueOriginal && venueProposed) {
        const venueSimilarity = tokenSimilarity(venueOriginal, venueProposed);
        if (venueSimilarity < 0.2) {
            score += 22;
            signals.push("Venue appears completely replaced.");
        } else if (venueSimilarity < 0.5) {
            score += 10;
            signals.push("Venue changed significantly.");
        }
    }

    if ((proposed.templateId || snapshot.original_template_id) && proposed.templateId && proposed.templateId !== snapshot.original_template_id) {
        score += 20;
        signals.push("Template changed after first publish.");
    }

    if (signals.length >= 3) score += 10;
    if (signals.length >= 4) score += 10;

    if (score >= 70) {
        return {
            riskLevel: "high",
            decision: "warned",
            score,
            reason: "This looks like a major update to your invitation.",
            signals,
        };
    }

    if (score >= 35) {
        return {
            riskLevel: "medium",
            decision: "warned",
            score,
            reason: "This looks like a major update to your invitation.",
            signals,
        };
    }

    return {
        riskLevel: "low",
        decision: "allowed",
        score,
        reason: "Changes classify as same-event corrections or legitimate rescheduling.",
        signals,
    };
}

function tokenSimilarity(left: string | null | undefined, right: string | null | undefined) {
    const leftTokens = new Set(normalizeText(left).split(" ").filter((token) => token.length > 2));
    const rightTokens = new Set(normalizeText(right).split(" ").filter((token) => token.length > 2));

    if (leftTokens.size === 0 && rightTokens.size === 0) return 1;
    if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

    let intersection = 0;
    leftTokens.forEach((token) => {
        if (rightTokens.has(token)) intersection += 1;
    });

    const union = new Set([...leftTokens, ...rightTokens]).size;
    return union === 0 ? 1 : intersection / union;
}

function getDateDiffDays(left: string, right: string) {
    const leftParts = parseInvitationDateParts(left);
    const rightParts = parseInvitationDateParts(right);
    if (!leftParts || !rightParts) return null;

    const leftDate = Date.UTC(leftParts.year, leftParts.month - 1, leftParts.day);
    const rightDate = Date.UTC(rightParts.year, rightParts.month - 1, rightParts.day);
    return Math.abs(rightDate - leftDate) / (1000 * 60 * 60 * 24);
}

function isRelatedCategory(left: string, right: string) {
    const relatedPairs = new Set([
        "wedding:engagement",
        "engagement:wedding",
        "party:birthday",
        "birthday:party",
    ]);
    return relatedPairs.has(`${left}:${right}`);
}
