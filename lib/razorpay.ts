import Razorpay from "razorpay";
import crypto from "crypto";
import { validateRazorpayWebhookSecret } from "@/lib/env";

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn("Razorpay credentials are not set in environment variables.");
}

export const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "dummy_key",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "dummy_secret",
});

export function verifyRazorpaySignature(
    orderId: string,
    paymentId: string,
    signature: string
): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return false;

    const generated = crypto
        .createHmac("sha256", secret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

    if (generated.length !== signature.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(generated, "utf-8"),
        Buffer.from(signature, "utf-8")
    );
}

export function verifyRazorpayWebhookSignature(
    rawBody: string,
    signature: string
): boolean {
    const secret = validateRazorpayWebhookSecret();

    const generated = crypto
        .createHmac("sha256", secret)
        .update(rawBody, "utf8")
        .digest("hex");

    if (
        !/^[a-f0-9]{64}$/i.test(signature) ||
        generated.length !== signature.length
    ) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(generated, "utf-8"),
        Buffer.from(signature, "utf-8")
    );
}
