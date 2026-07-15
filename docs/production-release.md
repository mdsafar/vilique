# Vilique Production Release Runbook

## Launch Gate

Do not enable Razorpay Live Mode until payment finalization, webhook idempotency, reconciliation, abuse controls, middleware, media privacy, tests, and CI pass in the target environment.

## Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `PAYMENT_RECONCILIATION_SECRET`
- `REQUEST_HASH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `PAYMENTS_ENABLED`
- `PAYMENT_OPERATIONS_SECRET`
- `VILIQUE_LEGAL_ENTITY_NAME`
- `VILIQUE_BUSINESS_ADDRESS`
- `VILIQUE_SUPPORT_EMAIL`
- `VILIQUE_GRIEVANCE_CONTACT`
- `VILIQUE_JURISDICTION`

Preview deployments must not use `rzp_live` Razorpay credentials. `RAZORPAY_WEBHOOK_SECRET` is server-only and must never be exposed through a `NEXT_PUBLIC_*` variable, API response, client bundle, or log output.

## Razorpay Webhook Secret

Configure the webhook secret in the Razorpay Dashboard and set the exact same value in the deployed app's `RAZORPAY_WEBHOOK_SECRET` environment variable. Test Mode and Live Mode have separate dashboard webhooks and must use different secrets. Keep preview deployments on Test Mode credentials only.

Production env validation rejects missing, empty, placeholder, or suspiciously short webhook secrets without printing the secret value. Do not use example values such as `your-own-webhook-secret`, `changeme`, or `example`.

## Migration Order

Apply migrations in filename order. Do not edit applied migrations. The payment hardening migration is additive and is safe to roll forward before route deployment.

## Deployment Order

1. Apply Supabase migrations.
2. Deploy application with `PAYMENTS_ENABLED=false`.
3. Confirm build, auth middleware, policy pages, and public invitations.
4. Configure Razorpay webhook secret and webhook URL.
5. Configure `CRON_SECRET` or `PAYMENT_RECONCILIATION_SECRET`; Vercel Cron calls `POST /api/payments/reconcile` every 15 minutes via `vercel.json`.
6. Enable payments only after test-mode payment verification, invalid-signature rejection, webhook replay, duplicate callback, and recovery tests pass.
7. Configure Sentry alert rules for webhook, payment finalization, reconciliation, refund, and cron failures.

## Operational Refunds

Refund initiation is server-only through `POST /api/payments/refunds/initiate` with `Authorization: Bearer $PAYMENT_OPERATIONS_SECRET` or `x-operations-secret`. Use it only after a captured payment is permanently unrecoverable or manually approved under the Refund Policy. The route re-checks eligibility, claims one refund request idempotently, calls Razorpay, stores the provider refund ID, and keeps the payment in `refund_pending` until provider confirmation.

## Rate Limiting

Production request limits use the `consume_rate_limit` Postgres RPC and `request_rate_limits` table. If the distributed limiter is unavailable in production, protected routes fail closed with HTTP 429 instead of relying on process memory.

## Monitoring

Set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`, then configure alert rules for `webhook.processing_failed`, `webhook.claim_failed`, `payment.reconciliation_failed`, `refund.initiation_failed`, and cron failures. Alert delivery must be verified in staging before live payments.

## Emergency Payment Disable

Set `PAYMENTS_ENABLED=false`. New Razorpay orders stop. Existing published invitations remain available. Reconciliation can continue for already captured payments.

## Rollback

Prefer rolling forward database fixes. If the app deployment is rolled back, keep payments disabled until the route version and migration version are compatible. Never delete applied migrations in production.

## Webhook Rollback Considerations

Razorpay may retry failed webhooks. Keep `webhook_events.provider_event_id` idempotency intact, but do not treat row existence as success. The webhook route should only return 200 for processed, intentionally ignored, or already completed events; failed and stale processing events are reclaimed through `claim_razorpay_webhook_event`. If webhook processing fails repeatedly, disable new payments, run reconciliation manually, and move unresolved payments to manual review.

## Support Workflow

Support reviews the payment row, Razorpay order/payment/refund IDs, invitation status, webhook events, reconciliation attempts, last error, and audit log. Safe actions are retry reconciliation, retry publish through the idempotent finalizer, mark manual review, and approve unrecoverable refund only after policy checks.
