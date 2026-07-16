# Batch of 23 system improvements (2026-07-16)

Shipped as code on `main`. **You still run migrations** and rotate any leaked secrets.

| # | Item | Status |
|---|------|--------|
| 1 | Ops: migrations + secrets docs + health deploy probe | Done — `docs/SECRETS_AND_DEPLOY.md`, `/api/system/health`, schema probe |
| 2 | Trade-loop smoke e2e (auth + PO + invoice + peer) | Done — `e2e/trade-loop-smoke.spec.ts` |
| 3 | Connection workspace depth (open POs / invoices / activity) | Done — `/api/connections/peer-workspace` + peer page |
| 4 | Catalogue empty nudge as first-class tracking | Done — `activity_log` `catalogue.nudge` + email |
| 5 | Soft-warn logo / VAT / reg on commercial doc send | Done — `load-commercial-doc` + `docs/send` softWarnings |
| 6 | Notifications email/push for connection / PO / invoice / verify | Done — dispatch-hooks + email-alerts helpers |
| 7 | Bank badge public opt-in | Done — `metadata.show_bank_verified_public` + TrustBadges + `/c` |
| 8 | Shortlist industry/country + CSV export | Done — shortlist page |
| 9 | Referral role-gated ops console | Done — existing `/dashboard/my-business/referral-ops` |
| 10 | Passport in commerce (PO catalogue + display) | Done — prior + catalogue chips |
| 11 | Discover server pagination (`offset` / `page` / `hasMore`) | Done — discover API + Load more UI |
| 12 | Rate limits on public product + invite + directory | Done — `/p` API, invite-supplier, verified-companies |
| 13 | Structured logging (+ optional Sentry) | Done — `lib/logging/logger.ts` |
| 14 | Geo bootstrap client cache | Done — `force-cache` on GeoSelectFields |
| 15 | EmptyState on shortlist / peer not found | Done |
| 16 | Mobile profile collapse (certs / exports scroll) | Done — max-height overflow on mobile |
| 17 | Directory infinite scroll (Load more append) | Done — CompanyNetworkSection |
| 18 | Buyer journey checklist | Done — `JourneyChecklist` on buyer hub |
| 19 | Supplier journey checklist | Done — suppliers hub |
| 20 | System health schema + deploy identity | Done — earlier wave + health |
| 21 | Shared company card / trust badges | Done — earlier wave |
| 22 | **Prod migration run** | **You** — Supabase SQL editor |
| 23 | **Secret rotation** if ever pasted | **You** — Vercel env |

## Migrations to run (if not yet)

```text
supabase/migrations/20260716_profiles_branch_code.sql
supabase/migrations/20260716_bank_account_verification.sql
supabase/migrations/20260716_geo_reference_public_read.sql
```

Then: `GET /api/system/health` → `ok: true`, no `schemaMissingColumns`.

## Optional env

| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` | Mirror warn/error from structured logger |
| `RESEND_API_KEY` | Notification emails |
| `CRON_SECRET` | dispatch-hooks + crons |
| `REFERRAL_OPS_SECRET` | Ops console without root membership |

## Smoke

```bash
curl -sS "$APP_URL/api/system/health" | jq .
curl -sS "$APP_URL/api/public/verified-companies?page=1&pageSize=3" | jq .pageCount
# With E2E_ACCESS_TOKEN + E2E_COMPANY_ID:
npx playwright test e2e/trade-loop-smoke.spec.ts
```
