# Ops migrations (run in Supabase SQL Editor)

After deploying, if `/api/system/health` shows `schemaOptionalMissing` or missing profile columns, run these **in order**:

```text
supabase/migrations/20260716_profiles_branch_code.sql
supabase/migrations/20260716_bank_account_verification.sql
supabase/migrations/20260716_customer_invoices_source_po_id.sql
supabase/migrations/20260717_verification_payment_ref.sql
```

## Paystack (required for paid CIPC)

| Item | Value |
|------|--------|
| Webhook URL | `https://www.supplieradvisor.com/api/paystack/webhook` |
| Events | `charge.success` (+ refunds if using referral clawback) |
| Env | `PAYSTACK_SECRET_KEY` (server) + `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` |

See also `docs/PAYSTACK_WEBHOOK.md`.

## Verify after SQL

```bash
curl -sS "$APP_URL/api/system/health" | jq '{ok,degraded,schemaMissingColumns,schemaOptionalMissing,checks:{paystack,verifynow}}'
```

Expect: no critical missing profile columns; optional list empty after `20260717_verification_payment_ref.sql`.
