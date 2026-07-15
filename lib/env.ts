export function getSupabaseEnv() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
    }

    return { supabaseUrl, supabaseAnonKey };
}

const PLACEHOLDER_SECRET_PARTS = [
    "your-own",
    "changeme",
    "change-me",
    "example",
    "placeholder",
    "replace-with",
    "generated_webhook_secret",
];

function isPlaceholderSecret(value: string) {
    const normalized = value.toLowerCase();

    return PLACEHOLDER_SECRET_PARTS.some((part) =>
        normalized.includes(part)
    );
}

export function validateRazorpayWebhookSecret() {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

    if (!secret) {
        throw new Error("RAZORPAY_WEBHOOK_SECRET is required.");
    }

    if (secret.length < 32 || isPlaceholderSecret(secret)) {
        throw new Error(
            "RAZORPAY_WEBHOOK_SECRET is not configured with a valid server-side secret."
        );
    }

    return secret;
}

function getRazorpayMode(key?: string) {
    if (key?.startsWith("rzp_test_")) return "test";
    if (key?.startsWith("rzp_live_")) return "live";
    return null;
}

export function validateProductionEnv() {
    const vercelEnv = process.env.VERCEL_ENV;
    const appEnv = process.env.APP_ENV;

    const isDeployment =
        vercelEnv === "production" ||
        vercelEnv === "preview" ||
        appEnv === "production" ||
        appEnv === "preview";

    if (!isDeployment) {
        return;
    }

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID?.trim();
    const publicRazorpayKeyId =
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();

    const serverMode = getRazorpayMode(razorpayKeyId);
    const publicMode = getRazorpayMode(publicRazorpayKeyId);

    const isLivePayments =
        serverMode === "live" || publicMode === "live";

    const requiredForDeployment = [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET",
        "NEXT_PUBLIC_RAZORPAY_KEY_ID",
        "RAZORPAY_WEBHOOK_SECRET",
        "PAYMENT_RECONCILIATION_SECRET",
        "PAYMENT_OPERATIONS_SECRET",
        "REQUEST_HASH_SECRET",
    ];

    const hasPublicSiteUrl = Boolean(
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        process.env.NEXT_PUBLIC_SITE_URL?.trim()
    );

    const requiredForLivePayments: string[] = [];

    const required = isLivePayments
        ? [...requiredForDeployment, ...requiredForLivePayments]
        : requiredForDeployment;

    const missing = required.filter((key) => {
        const value = process.env[key];
        return !value?.trim();
    });

    if (!hasPublicSiteUrl) {
        missing.push(
            "NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL"
        );
    }

    if (missing.length > 0) {
        throw new Error(
            `Missing deployment environment variables: ${missing.join(", ")}`
        );
    }

    validateRazorpayWebhookSecret();

    if (!serverMode || !publicMode) {
        throw new Error(
            "Razorpay key IDs must begin with rzp_test_ or rzp_live_."
        );
    }

    if (serverMode !== publicMode) {
        throw new Error(
            "Razorpay server and public key IDs must use the same mode."
        );
    }

    if (vercelEnv === "preview" && isLivePayments) {
        throw new Error(
            "Preview deployments must not use Razorpay Live credentials."
        );
    }
}