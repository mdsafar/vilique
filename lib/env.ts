export function getSupabaseEnv() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
    }

    return { supabaseUrl, supabaseAnonKey };
}

const PLACEHOLDER_ENV_VALUES = new Set([
    "your-own-webhook-secret",
    "changeme",
    "change-me",
    "example",
    "placeholder",
]);

export function validateRazorpayWebhookSecret() {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

    if (!secret) {
        throw new Error("RAZORPAY_WEBHOOK_SECRET is required.");
    }

    if (secret.length < 16 || PLACEHOLDER_ENV_VALUES.has(secret.toLowerCase())) {
        throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured with a valid server-side secret.");
    }

    return secret;
}

export function validateProductionEnv() {
    const isProductionDeployment = process.env.VERCEL_ENV === "production" || process.env.APP_ENV === "production";
    const isPreviewDeployment = process.env.VERCEL_ENV === "preview" || process.env.APP_ENV === "preview";
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const publicRazorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

    const required = [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET",
        "RAZORPAY_WEBHOOK_SECRET",
        "PAYMENT_RECONCILIATION_SECRET",
        "NEXT_PUBLIC_APP_URL",
        "REQUEST_HASH_SECRET",
        "SENTRY_DSN",
        "PAYMENT_OPERATIONS_SECRET",
        "VILIQUE_LEGAL_ENTITY_NAME",
        "VILIQUE_BUSINESS_ADDRESS",
        "VILIQUE_SUPPORT_EMAIL",
        "VILIQUE_GRIEVANCE_CONTACT",
        "VILIQUE_JURISDICTION",
    ];

    if (isPreviewDeployment && (razorpayKeyId?.startsWith("rzp_live") || publicRazorpayKeyId?.startsWith("rzp_live"))) {
        throw new Error("Preview deployments must not use Razorpay live credentials.");
    }

    if (!isProductionDeployment) return;

    const missing = required.filter((key) => !process.env[key]);
    if (missing.length) {
        throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
    }

    validateRazorpayWebhookSecret();

    if (razorpayKeyId && publicRazorpayKeyId && razorpayKeyId.slice(0, 8) !== publicRazorpayKeyId.slice(0, 8)) {
        throw new Error("Razorpay server and public key IDs must use the same mode.");
    }
}
