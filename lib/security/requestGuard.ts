import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { looseSupabase } from "@/lib/supabase/loose";
import { reportError } from "@/lib/observability";

type RateLimitOptions = {
    key: string;
    limit: number;
    windowMs: number;
};

type Bucket = {
    count: number;
    resetAt: number;
};

const fallbackBuckets = new Map<string, Bucket>();

export function getClientIp(request: Request) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const vercelIp = request.headers.get("x-vercel-forwarded-for");
    const candidate = (vercelIp || forwardedFor || "").split(",")[0]?.trim();
    if (candidate && /^[a-f0-9:.]+$/i.test(candidate)) return candidate;
    return "unknown";
}

export function hashValue(value: string) {
    const salt = process.env.REQUEST_HASH_SECRET || process.env.NEXTAUTH_SECRET || "vilique-local-request-hash";
    return crypto.createHmac("sha256", salt).update(value).digest("hex");
}

export function getVisitorKey(request: Request, guestToken?: string | null) {
    const userAgent = request.headers.get("user-agent") || "unknown-agent";
    const ip = getClientIp(request);
    return hashValue([guestToken || "", ip, userAgent.slice(0, 160)].join("|"));
}

export async function rateLimit({ key, limit, windowMs }: RateLimitOptions) {
    const bucketKey = hashValue(`rate:${key}`);
    try {
        const supabase = createAdminClient();
        const { data, error } = await looseSupabase(supabase).rpc("consume_rate_limit", {
            p_bucket_key: bucketKey,
            p_limit: limit,
            p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
        });

        if (!error && Array.isArray(data) && data[0]) {
            const row = data[0] as {
                allowed: boolean;
                remaining: number;
                reset_at: string;
            };
            return {
                ok: row.allowed,
                remaining: row.remaining,
                resetAt: new Date(row.reset_at).getTime(),
                distributed: true,
            };
        }

        console.warn(JSON.stringify({
            level: "warn",
            event: "rate_limit.distributed_failed",
            message: error?.message || "No rate-limit row returned",
        }));
    } catch (error) {
        console.warn(JSON.stringify({
            level: "warn",
            event: "rate_limit.distributed_unavailable",
            message: error instanceof Error ? error.message : "Unknown rate-limit failure",
        }));
    }

    if (process.env.NODE_ENV === "production") {
        return { ok: false, remaining: 0, resetAt: Date.now() + 60_000, distributed: false };
    }

    const now = Date.now();
    const bucket = fallbackBuckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
        fallbackBuckets.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, remaining: Math.max(limit - 1, 0), resetAt: now + windowMs, distributed: false };
    }

    bucket.count += 1;
    if (bucket.count > limit) {
        return { ok: false, remaining: 0, resetAt: bucket.resetAt, distributed: false };
    }

    return { ok: true, remaining: Math.max(limit - bucket.count, 0), resetAt: bucket.resetAt, distributed: false };
}

export function rateLimitResponse(resetAt: number) {
    return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        {
            status: 429,
            headers: {
                "Retry-After": String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))),
            },
        }
    );
}

export async function readJsonWithLimit(request: Request, maxBytes = 16 * 1024) {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > maxBytes) {
        throw new Error("PAYLOAD_TOO_LARGE");
    }

    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
        throw new Error("PAYLOAD_TOO_LARGE");
    }

    return text ? JSON.parse(text) : {};
}

export function sanitizeText(value: string) {
    return value
        .replace(/<[^>]*>/g, "")
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function isLikelyBot(request: Request) {
    const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
    return /bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|slackbot/.test(userAgent);
}

export async function recordSubmissionGuard(input: {
    scope: "event" | "rsvp" | "wish";
    invitationId: string;
    dedupeKey: string;
    action: string;
    metadata?: Record<string, unknown>;
}) {
    const supabase = createAdminClient();
    const { error } = await looseSupabase(supabase)
        .from("public_submission_guard")
        .insert({
            scope: input.scope,
            invitation_id: input.invitationId,
            dedupe_key: input.dedupeKey,
            action: input.action,
            metadata: input.metadata || {},
        });

    if (!error) return { duplicate: false };
    if (error.code === "23505") {
        return { duplicate: true };
    }

    console.error("Failed to record public submission guard:", error);
    reportError(error, "security.submission_guard_failed", { scope: input.scope, invitationId: input.invitationId });
    return { duplicate: false };
}
