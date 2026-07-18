# Next deployment checklist (proof & live settle)

Ship tip on `main`, then run this **before** inviting more customers.

## 1. Deploy

- [ ] Vercel production is on the commit you just pushed (`git rev-parse --short HEAD`)
- [ ] Compare to `GET /api/system/health` → `p0Readiness.deploy.commitShort`

## 2. Supabase SQL (in order)

From `docs/OPS_MIGRATIONS.md`:

```text
supabase/migrations/20260717_customer_invoices_promise_to_pay.sql
supabase/migrations/20260717_ar_ledger.sql
supabase/migrations/20260717_payment_claims_and_ledger_fx.sql
supabase/migrations/20260718_installments_collections.sql
```

Plus earlier profile/PO columns if health still lists them.

## 3. Storage (POP uploads)

- [ ] Create public bucket **`company-documents`** (or `payment-proofs`)
- [ ] Allow authenticated upload for path `{companyId}/payment-proofs/*`

## 4. Env (Vercel)

| Var | Purpose |
|-----|---------|
| `CRON_SECRET` | Crons + digests |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | Claim + dunning email |
| `OPS_ALERT_EMAIL` | Ops digests / SLA |
| `PAYSTACK_SECRET_KEY` + webhook URL | CIPC R69 |
| `TWILIO_ACCOUNT_SID` / `AUTH_TOKEN` / `WHATSAPP_FROM` | Claim WhatsApp (optional but recommended) |
| `TWILIO_WHATSAPP_TO_DEFAULT` | Sandbox test number |
| `NEXT_PUBLIC_APP_URL` | Deep links in email/WA |

## 5. Smoke (must be green)

```bash
curl -sS "$APP/api/system/health" | jq '.p0Readiness'
curl -sS "$APP/api/system/settle-smoke" | jq '{ok,settleLive,blockers,warnings}'
```

- [ ] `p0Readiness.ok === true` (or only known warnings)
- [ ] `settle-smoke.settleLive === true`
- [ ] `/dashboard/my-business/ops` loads without blockers

## 6. One human settle loop

1. Seller: first-trade bootstrap → send invoice  
2. Buyer: Money → **I paid** → upload POP  
3. Seller: Money → **View POP** → **Confirm**  
4. Ledger line appears; rating prompt due  
5. Optional: dunning **preview** then send-now  

## 7. Dual-tenant E2E (optional CI)

```bash
E2E_MUTATE=1 \
E2E_ACCESS_TOKEN=… E2E_COMPANY_ID=… \
E2E_BUYER_TOKEN=… E2E_BUYER_COMPANY_ID=… \
E2E_INVOICE_ID=… \   # optional shared open inv
E2E_CONFIRM_CLAIM=1 \
npx playwright test e2e/claim-settle-dual.spec.ts
```

Credit hold probe: `E2E_CREDIT_HOLD_CUSTOMER_ID=` on a customer already on hold.

## 8. Post-deploy product checks

| Surface | Expect |
|---------|--------|
| `/dashboard/customers/money` | Claims, POP, dunning preview, credit hold |
| `/dashboard/buyer/money` | Claim modal + POP upload |
| `/dashboard/settle` | Command center |
| Claim email / WhatsApp | Money hub deep link |

## Done when

- Smoke green  
- One real claim→confirm with POP  
- Ops digests not erroring (Resend + OPS_ALERT_EMAIL)
