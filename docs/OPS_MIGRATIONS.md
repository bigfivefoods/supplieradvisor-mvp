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
supabase/migrations/20260718_installments_collections.sql
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
| `/api/system/activation-digest-cron` | Mondays 08:00 UTC | Weekly ops activation + P0 readiness email |
| `/api/system/claim-sla-cron` | daily 10:00 UTC | Nudge sellers on payment claims pending &gt;24h |

Auth: `Authorization: Bearer $CRON_SECRET`

**Ops alert email:** set `OPS_ALERT_EMAIL` or `PAYSTACK_OPS_EMAIL` for stale webhook + CIPC SLA breach alerts.

**Dead-letter CIPC:** `GET/POST /api/system/paystack-dead-letter` (ops) re-runs CIPC from stored payment refs. Pulse cron also auto-replays at-risk paid-not-badged companies.

**Customer CIPC SLA:** `GET /api/business/verify/status?companyId=` — paid_at hours, 24h target, next actions. Dashboard banner shows SLA breach copy.

**Collections UI:** `/dashboard/customers/ar` — aging, customer rollup, **payment ledger**, broken promises, PDF statement.

**Money hub (settle-by-default):** `/dashboard/customers/money` · buyer POP + claims `/dashboard/buyer/money`

**Settle command center:** `/dashboard/settle` · USDC escrow hub `/dashboard/escrow`

**Settle smoke (non-mutating):** `GET /api/system/settle-smoke` — claims + ledger + installments + proof_url / promise columns.

**Next deploy runbook:** `docs/NEXT_DEPLOY_CHECKLIST.md` (SQL, storage, Twilio, dual-tenant E2E).

**POP upload:** `POST /api/buyer/payment-proof` (multipart) → `proof_url` on claim.

**AR ledger API:** `GET/POST /api/customers/ar-ledger` (requires `20260717_ar_ledger.sql`). Mark-paid also writes ledger rows when the table exists.

**Storage:** public bucket `company-documents` (or `payment-proofs`) for POP files.

**Buyer payment claims:** `POST /api/buyer/payment-claim` → seller confirm on AR (`/api/customers/payment-claims`). Needs `20260717_payment_claims_and_ledger_fx.sql`. Confirm posts ledger + FX snapshot.

**Installments (first-class):** `customer_invoice_installments` via `20260718_installments_collections.sql` + `GET/POST /api/customers/installments`. Dual-writes notes `[installments]` for compat. Mark paid posts ledger.

## Ops control plane (P0)

| Item | Path |
|------|------|
| Public readiness | `GET /api/system/health` → `p0Readiness` (blockers/warnings, no secrets) |
| Board API | `GET /api/system/ops-board` (CRON_SECRET or referral ops) |
| UI | `/dashboard/my-business/ops` + global **OpsLiveBanner** |
| CLI | `bash scripts/ops-p0-check.sh` · `node scripts/verify-platform.mjs` |
| Checklist | Paystack secret, webhook pulse, CIPC SLA breaches, AR ledger / claims / installments tables, OPS_ALERT_EMAIL, tip SHA |

```bash
# After every production deploy (P0)
export APP_URL=https://www.supplieradvisor.com
export EXPECT_COMMIT=$(git rev-parse --short HEAD)
bash scripts/ops-p0-check.sh

# Health payload
curl -sS "$APP_URL/api/system/health" | jq '{deploy, p0Readiness, settleMissing, paystack:.checks.paystack.ok}'

# Ops board (secret)
curl -sS -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/system/ops-board" | jq '.board.readiness'

# Local schema (service role)
node scripts/verify-platform.mjs
```

**P0 pass criteria:** `p0Readiness.ok === true`, `deploy.commitShort` matches shipped tip, Paystack webhook not stale, settle tables present.

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
