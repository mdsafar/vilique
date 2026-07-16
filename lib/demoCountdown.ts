const DEMO_COUNTDOWN_DURATION_MS = 60 * 60 * 1000;

export function createDemoCountdownTargetDate(openedAt = new Date()) {
    return new Date(openedAt.getTime() + DEMO_COUNTDOWN_DURATION_MS);
}
