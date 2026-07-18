# Paystack webhook (CIPC auto-verify)

## Configure (required in production)

1. Open [Paystack Dashboard](https://dashboard.paystack.com/) → **Settings** → **API Keys & Webhooks**.
2. Set **Webhook URL** to:

```text
https://www.supplieradvisor.com/api/paystack/webhook
```

3. Ensure **charge.success** (and refund events if you use referral clawback) are delivered.
4. Server env must include `PAYSTACK_SECRET_KEY` (signature verification).

### Why health said "webhook pulse stale"

Ops pulse reads `activity_log` actions:

- `billing.paystack_webhook_received` (every accepted event)
- `billing.paystack_cipc_webhook`
- `billing.paystack_refund_webhook`
- `billing.paystack_webhook_ping` (ops synthetic)

**Common bug (fixed):** Edge middleware required Privy on `/api/paystack/webhook` because the path is `/webhook` (singular) and only `/webhooks/` was allowlisted. Paystack got **401** → never delivered → pulse always `never`/`stale`.

After deploy, verify:

```bash
# Must be 200 without Authorization
curl -sS https://www.supplieradvisor.com/api/paystack/webhook | jq .

# Seed pulse after deploy (optional)
curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://www.supplieradvisor.com/api/system/paystack-webhook-ping | jq .

# Health pulse
curl -sS https://www.supplieradvisor.com/api/system/health | jq '.checks.paystack.detail.webhookPulse'
```

In Paystack Dashboard, use **Send test webhook** (or complete a real R69) so a signed `charge.success` hits production.

## What happens on R69 company verify

Client opens Paystack with reference `sa-verify-{companyId}-{timestamp}` and metadata:

- `purpose` / custom field: `verifynow_company_verification`
- `company_id`: profile id

On **charge.success**:

1. Webhook validates `x-paystack-signature`.
2. Detects CIPC payment via ref prefix or metadata.
3. Calls `runCipcAfterPayment` (VerifyNow CIPC).
4. Sets `verification_status` to `verified` | `mismatch` | `failed`.
5. Emails company + ops (`connect@`).

Browser callback still runs verify as well; runs are **idempotent** for the same payment ref when already verified.

## Smoke test

```bash
# Health shows paystack + webhook hint
curl -sS "$APP_URL/api/system/health" | jq '.checks.paystack, .schemaMissingColumns'

# Ops queue (needs CRON_SECRET or referral ops)
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "$APP_URL/api/system/verification-queue" | jq '.count, .queue[0]'
```

After a real R69 payment, check:

- Paystack dashboard → transaction → webhook delivery log (200)
- Company profile → CIPC status
- `activity_log` action `billing.paystack_cipc_webhook` / `business.verification_verifynow`
