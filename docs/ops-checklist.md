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
| `20260716_referral_*.sql` / `referral_watertight` | SaaS referral + ops payouts |
| `20260716_platform_improvements.sql` | SAM log, rating prompts, founding waitlist |

Smoke: open Quality → Inspections and Accounting → Settings (period locks) without schema errors.

Also see **`docs/referral-trust-runbook.md`** for referral, rating prompts, Resend nudges, and SAM history.

## 2. Vercel environment

| Variable | Required for |
|----------|----------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Auth / JWT |
| `SUPABASE_SERVICE_ROLE_KEY` + URL | API data |
| `AUTH_STRICT` | Leave unset or `true` in production |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | Email alerts + rating nudges |
| `XAI_API_KEY` | SAM (Grok) assistant |
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_WHATSAPP_FROM` | WhatsApp |
| `TWILIO_WHATSAPP_TO_DEFAULT` | Sandbox test recipient |
| `NEXT_PUBLIC_USDC_ESCROW_*` | USDC escrow UI (after deploy) |
| `BANKLINK_API_KEY` | Live open banking |
| `CRON_SECRET` | Cron jobs (referral holds + rating digests) |

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
7. QA ship-hold demo — see `docs/qa-ship-hold-demo.md` (expect 409 `QA_HOLD`)
8. Founding waitlist ops — `/dashboard/my-business/founding-waitlist` (platform ops)
9. Referral clawback drill — `docs/referral-clawback-drill.md`
10. Container embed views — open public share URL; confirm view_count on Share settings
11. Subscription reminders — `GET /api/business/subscription/cron` (trial 7d/1d, expiry 7d/1d)
12. Migration `20260716_subscription_reminders.sql` for `subscription_reminder_meta`

```sql
-- Waitlist peek when table exists
SELECT id, email, company_name, status, created_at
FROM public.founding_waitlist
ORDER BY created_at DESC
LIMIT 50;
```

## 6. E2E

```bash
# Unauth API gates
npm run test:e2e:auth

# Referral + trust + SAM gates
npx playwright test e2e/referral-trust-smoke.spec.ts

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
