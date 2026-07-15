import * as Sentry from "@sentry/nextjs";

type LogLevel = "info" | "warn" | "error";

const redactedKeys = /secret|signature|password|token|service_role|key_secret/i;

export function logEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
    const payload = {
        level,
        event,
        timestamp: new Date().toISOString(),
        ...(redact(fields) as Record<string, unknown>),
    };

    const line = JSON.stringify(payload);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
}

export function reportError(error: unknown, event: string, fields: Record<string, unknown> = {}) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent("error", event, { ...fields, message });

    if (process.env.SENTRY_DSN) {
        Sentry.captureException(error, {
            tags: { event },
            extra: redact(fields) as Record<string, unknown>,
        });
    }
}

function redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(redact);
    if (!value || typeof value !== "object") return value;

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
            key,
            redactedKeys.test(key) ? "[redacted]" : redact(nested),
        ])
    );
}
