# Ops checklist — production readiness

Run this after each significant deploy. Code can be ahead of **configuration**.

## 1. Database migrations

Apply pending files under `supabase/migrations/` on the live project (SQL editor or CLI):

| Migration | Purpose |
|-----------|---------|
| `20260711_quality_inspections.sql` | QA holds / inspections |
| `20260711_haccp_esg_pm_suite.sql` | HACCP, PM, ESG tables |
| `20260711_accounting_period_locks.sql` | Period locks |
| `20260711_tier1_rls_hardening.sql` | Anon deny RLS |
| `20260711_bank_middleware.sql` | Bank connections / match rules |
| `20260711_vat_tax_categories.sql` | VAT categories |

Smoke: open Quality → Inspections and Accounting → Settings (period locks) without schema errors.

## 2. Vercel environment

| Variable | Required for |
|----------|----------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Auth / JWT |
| `SUPABASE_SERVICE_ROLE_KEY` + URL | API data |
| `AUTH_STRICT` | Leave unset or `true` in production |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | Email alerts |
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_WHATSAPP_FROM` | WhatsApp |
| `TWILIO_WHATSAPP_TO_DEFAULT` | Sandbox test recipient |
| `NEXT_PUBLIC_USDC_ESCROW_*` | USDC escrow UI (after deploy) |
| `BANKLINK_API_KEY` | Live open banking |
| `CRON_SECRET` | Cron jobs |

## 3. USDC escrow (Base Sepolia)

```bash
cd contracts/contracts
npx hardhat compile
SEPOLIA_PRIVATE_KEY=0x... \
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org \
USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e \
npx tsx scripts/deploy-usdc.ts
```

Set `NEXT_PUBLIC_USDC_ESCROW_ADDRESS` from deploy output, then one full path: create → fund → ship → confirm.

## 4. Role gates (enforced in code)

| Action | Who |
|--------|-----|
| Period lock/unlock | owner, admin, finance |
| Journals / bank allocate / auto-match | accounting **write** (finance, owner, admin, …) |
| QA inspections write | operations **write** |
| Escrow on-chain attach | owner, admin, finance, operations |
| Team invite | owner, admin |

## 5. Alerts to verify

Trigger once each (email + WhatsApp if configured):

1. Create QA inspection with status `open` or `failed`
2. Ship transfer with held lot (expect 409 + alert)
3. Lock an accounting period
4. Fund escrow on a PO
5. Export quality regulatory pack
6. Fail a bank sync (or wait for real error)

## 6. E2E

```bash
# Unauth API gates
npm run test:e2e:auth

# Bearer token (from logged-in browser)
export E2E_ACCESS_TOKEN=eyJ...
export E2E_COMPANY_ID=123
export PLAYWRIGHT_BASE_URL=https://www.supplieradvisor.com
npm run test:e2e:session

# Full UI session (after manual login seed)
npx playwright codegen --save-storage=e2e/.auth.json https://www.supplieradvisor.com/login
npm run test:e2e:storage
```

## 7. Role-aware UI (in app)

| Surface | Behaviour |
|---------|-----------|
| Period locks | Only owner/admin/finance can toggle; others see banner |
| QA inspections | Operations write required for create/pass/fail |
| Ship transfer | Ops write; QA override checkbox only for owner/admin |
| Accounting settings save | Accounting write required |
| Audit feed | Accounting → Settings → Recent activity |

## 8. ComingSoon

Hubs only link **live** modules. Stubs remain at:

- `/dashboard/projects/budgeting`, `resource-allocation`
- `/dashboard/sustainability/ethical-sourcing`, `water-waste`, `green-certificates`, `regenerative-dashboard`
- `/dashboard/governance/pestle`

Do not add these back to sidebar/hubs until APIs exist.
