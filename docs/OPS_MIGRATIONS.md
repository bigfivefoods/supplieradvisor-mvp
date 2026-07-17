# Ops migrations (run in Supabase SQL Editor)

After deploying, if `/api/system/health` shows `schemaOptionalMissing` or missing profile columns, run these **in order**:

```text
supabase/migrations/20260716_profiles_branch_code.sql
supabase/migrations/20260716_bank_account_verification.sql
supabase/migrations/20260716_customer_invoices_source_po_id.sql
supabase/migrations/20260717_verification_payment_ref.sql
supabase/migrations/20260717_customer_invoices_promise_to_pay.sql
```

## Collections crons (Vercel)

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/customers/docs/overdue-cron` | daily 05:15 UTC | Flip past-due → overdue |
| `/api/customers/docs/promise-to-pay-cron` | daily 06:30 UTC | Remind finance when promise date due |
| `/api/customers/ar-digest/cron` | Mondays 07:00 UTC | Weekly AR aging email to finance/owner |
| `/api/customers/ar-statement/cron` | 1st of month 07:15 UTC | Monthly AR-by-customer statement email |
| `/api/customers/docs/dunning-cron` | daily 06:45 UTC | Overdue ladder day 1 / 7 / 14 emails |
| `/api/system/paystack-pulse-cron` | daily 08:00 UTC | Email OPS_ALERT_EMAIL if webhook stale (&gt;72h) |
| `/api/business/network-invites/sequence-cron` | daily 09:30 UTC | Invite resend day 3 / day 7 if not accepted |

Auth: `Authorization: Bearer $CRON_SECRET`

**Ops alert email:** set `OPS_ALERT_EMAIL` or `PAYSTACK_OPS_EMAIL` for stale webhook alerts.

**Dead-letter CIPC:** `GET/POST /api/system/paystack-dead-letter` (ops) re-runs CIPC from stored payment refs.

**Collections UI:** `/dashboard/customers/ar` — aging, customer rollup, broken promises, per-customer PDF statement.

**Verification ops:** `/dashboard/my-business/verifications` — paid≠badge SLA queue (critical &gt;24h paid).

## Paystack (required for paid CIPC)

| Item | Value |
|------|--------|
| Webhook URL | `https://www.supplieradvisor.com/api/paystack/webhook` |
| Events | `charge.success` (+ refunds if using referral clawback) |
| Env | `PAYSTACK_SECRET_KEY` (server, **required**) + `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` |

**Health:** `/api/system/health` → `checks.paystack.ok` is **false** until the secret is set (public key alone does not count). After adding the secret in Vercel Production env, run **one** redeploy.

See also `docs/PAYSTACK_WEBHOOK.md` and **`docs/PLATFORM_MAJOR_REQUIREMENTS.md`** (Paystack + Twilio + trade-loop smoke).

## Twilio WhatsApp (optional — real PDF document in chat)

| Env | Value |
|-----|--------|
| `TWILIO_ACCOUNT_SID` | Twilio account |
| `TWILIO_AUTH_TOKEN` | Auth token |
| `TWILIO_WHATSAPP_FROM` | e.g. `whatsapp:+1…` |

Without Twilio, WhatsApp PDF uses mobile file share or a PDF document URL + supplieradvisor.com.

## Verify after SQL

```bash
curl -sS "$APP_URL/api/system/health" | jq '{ok,degraded,schemaMissingColumns,schemaOptionalMissing,checks:{paystack,verifynow}}'
```

Expect: no critical missing profile columns; optional list empty after `20260717_verification_payment_ref.sql`.
