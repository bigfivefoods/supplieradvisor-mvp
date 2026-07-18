# Ops migrations (run in Supabase SQL Editor)

After deploying, if `/api/system/health` shows `schemaOptionalMissing` or missing profile columns, run these **in order**:

```text
supabase/migrations/20260716_profiles_branch_code.sql
supabase/migrations/20260716_bank_account_verification.sql
supabase/migrations/20260716_customer_invoices_source_po_id.sql
supabase/migrations/20260717_verification_payment_ref.sql
supabase/migrations/20260717_customer_invoices_promise_to_pay.sql
supabase/migrations/20260717_ar_ledger.sql
supabase/migrations/20260717_payment_claims_and_ledger_fx.sql
```

## Collections crons (Vercel)

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/customers/docs/overdue-cron` | daily 05:15 UTC | Flip past-due → overdue |
| `/api/customers/docs/promise-to-pay-cron` | daily 06:30 UTC | Remind finance when promise date due |
| `/api/customers/ar-digest/cron` | Mondays 07:00 UTC | Weekly AR aging email to finance/owner |
| `/api/customers/ar-statement/cron` | 1st of month 07:15 UTC | Monthly AR-by-customer statement email |
| `/api/customers/docs/dunning-cron` | daily 06:45 UTC | Overdue ladder day 1 / 7 / 14 emails |
| `/api/system/paystack-pulse-cron` | daily 08:00 UTC | Webhook stale alert + **CIPC SLA auto-rerun** + breach email |
| `/api/business/network-invites/sequence-cron` | daily 09:30 UTC | Invite resend day 3 / day 7 if not accepted |

Auth: `Authorization: Bearer $CRON_SECRET`

**Ops alert email:** set `OPS_ALERT_EMAIL` or `PAYSTACK_OPS_EMAIL` for stale webhook + CIPC SLA breach alerts.

**Dead-letter CIPC:** `GET/POST /api/system/paystack-dead-letter` (ops) re-runs CIPC from stored payment refs. Pulse cron also auto-replays at-risk paid-not-badged companies.

**Customer CIPC SLA:** `GET /api/business/verify/status?companyId=` — paid_at hours, 24h target, next actions. Dashboard banner shows SLA breach copy.

**Collections UI:** `/dashboard/customers/ar` — aging, customer rollup, **payment ledger**, broken promises, PDF statement.

**AR ledger API:** `GET/POST /api/customers/ar-ledger` (requires `20260717_ar_ledger.sql`). Mark-paid also writes ledger rows when the table exists.

**Buyer payment claims:** `POST /api/buyer/payment-claim` → seller confirm on AR (`/api/customers/payment-claims`). Needs `20260717_payment_claims_and_ledger_fx.sql`. Confirm posts ledger + FX snapshot.

**First trade (30 min):** `GET/POST /api/business/first-trade` + dashboard orchestrator (bootstrap customer + draft invoice).

**Network density:** `GET /api/business/network-metrics` + cards on `/dashboard/network-invites`.

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
