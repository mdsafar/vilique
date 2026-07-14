export type TemplateRatingSummary = {
    average: number | null;
    count: number;
};

export function formatTemplateRating(summary: TemplateRatingSummary) {
    if (!summary.count || summary.average === null) {
        return "New";
    }

    return `${summary.average.toFixed(1)} (${summary.count})`;
}

export function getDefaultRatingSummary(): TemplateRatingSummary {
    return {
        average: null,
        count: 0,
    };
}
