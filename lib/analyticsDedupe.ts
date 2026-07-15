export function getAnalyticsTimeBucket(timestampMs: number, windowMinutes = 30) {
    const windowMs = windowMinutes * 60 * 1000;
    return new Date(Math.floor(timestampMs / windowMs) * windowMs).toISOString();
}

export function shouldCountPublicView(input: {
    isPublished: boolean;
    isPreview: boolean;
    isOwner: boolean;
    isBot: boolean;
}) {
    return input.isPublished && !input.isPreview && !input.isOwner && !input.isBot;
}
