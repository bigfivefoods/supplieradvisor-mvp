# Paystack webhook (CIPC auto-verify)

## Configure (required in production)

1. Open [Paystack Dashboard](https://dashboard.paystack.com/) → **Settings** → **API Keys & Webhooks**.
2. Set **Webhook URL** to:

```text
https://www.supplieradvisor.com/api/paystack/webhook
```

3. Ensure **charge.success** (and refund events if you use referral clawback) are delivered.
4. Server env must include `PAYSTACK_SECRET_KEY` (signature verification).

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
