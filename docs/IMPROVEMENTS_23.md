# Batch of 23 system improvements — ship audit

**Git tip (local = origin/main):** `7976709`  
**Working tree:** clean — nothing uncommitted or unpushed.

| Status | Meaning |
|--------|---------|
| **Code shipped** | On `origin/main`, verified in tree |
| **You (ops)** | Cannot be done by git push alone |
| **Partial** | Core shipped; optional depth still thin |

## Primary batch (23)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Ops docs + health / schema deploy probe | **Code shipped** | `docs/SECRETS_AND_DEPLOY.md`, `/api/system/health`, `lib/system/schema-probe.ts`, `SchemaHealthBanner` |
| 2 | Trade-loop e2e (auth + PO + invoice + peer) | **Code shipped** | `e2e/trade-loop-smoke.spec.ts` (needs env tokens to run live) |
| 3 | Connection workspace depth | **Code shipped** | `app/api/connections/peer-workspace`, `connections/[peerId]/page.tsx` |
| 4 | Catalogue empty nudge tracking | **Code shipped** | `catalogue.nudge` in `activity_log` + email in catalogue API |
| 5 | Soft-warn logo / VAT / reg on doc send | **Code shipped** | `load-commercial-doc` + `docs/send` + DocumentWorkspace toasts |
| 6 | Notifications email for connection / PO / invoice / verify | **Code shipped** | `dispatch-hooks`, `email-alerts`, connection POST notifies |
| 7 | Bank badge public opt-in | **Code shipped** | Profile checkbox → `metadata.show_bank_verified_public` → `/c` TrustBadges |
| 8 | Shortlist industry/country + CSV export | **Code shipped** | `suppliers/shortlist/page.tsx` |
| 9 | Referral role-gated ops console | **Code shipped** | `my-business/referral-ops` (prior wave; still present) |
| 10 | Passport in commerce (PO catalogue) | **Code shipped** (SRM PO) | `suppliers/po` chips + `/p/{public_id}` links; buyer portal PO less deep |
| 11 | Discover server pagination | **Code shipped** | API `offset`/`hasMore`; UI Load more |
| 12 | Rate limits public product / invite / directory | **Code shipped** | public product, invite-supplier, verified-companies |
| 13 | Structured logging (+ optional Sentry) | **Code shipped** | `lib/logging/logger.ts` (Sentry only if `SENTRY_DSN` + package) |
| 14 | Geo bootstrap client cache | **Code shipped** | `GeoSelectFields` `force-cache` |
| 15 | EmptyState on shortlist / peer | **Code shipped** | shortlist + peer not-found |
| 16 | Mobile profile certs/exports scroll | **Code shipped** | `max-md:max-h-*` on profile panels |
| 17 | Directory Load more (append) | **Code shipped** | `CompanyNetworkSection` |
| 18 | Buyer journey checklist | **Code shipped** | `JourneyChecklist` on buyer hub |
| 19 | Supplier journey checklist | **Code shipped** | `JourneyChecklist` on suppliers hub |
| 20 | System health schema + deploy identity | **Code shipped** | health + schema probe + banner |
| 21 | Shared company card / trust badges | **Code shipped** | earlier wave + shortlist reuse |
| 22 | **Prod migration run** | **You (ops)** | SQL in Supabase (see below) |
| 23 | **Secret rotation** if ever pasted | **You (ops)** | Vercel env + provider rotate |

## Build fixes after the batch (also shipped)

| Commit | Fix |
|--------|-----|
| `1a9c303` | `CommercialDocSuccess` type for load-commercial-doc |
| `a4a14f6` / `d15f5be` | `SEED_PROVINCES` sparse comma + `buildSeedProvinces` |
| `7976709` | Public `/c/[id]` concrete types (ReactNode / unknown) |

## Earlier related waves (already on main)

Bank VerifyNow R50, branch_code, geo cascade, logos on cards, denser profile, discovery completeness ≥60%, SchemaHealthBanner, first improvement waves (`64b2db5`, `35a12ec`), PO passport chips (`afd375d`, `9754a5d`).

## Migrations you must run (if not already)

```text
supabase/migrations/20260716_profiles_branch_code.sql
supabase/migrations/20260716_bank_account_verification.sql
supabase/migrations/20260716_geo_reference_public_read.sql
```

Then: `GET /api/system/health` → expect `ok: true` and no missing profile columns.

## Deploy check

1. Vercel production commit should be **`7976709`** or later.  
2. If dashboard still shows failures from `23:56` / `00:02`, those were **pre-fix** commits — redeploy latest `main`.  
3. Nothing left unpushed in this workspace (`main` == `origin/main`, clean tree).

## Optional env

| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` | Mirror warn/error from structured logger |
| `RESEND_API_KEY` | Notification emails |
| `CRON_SECRET` | dispatch-hooks + crons |
| `REFERRAL_OPS_SECRET` | Ops console without root membership |
| `VERIFYNOW_API_KEY` / `PAYSTACK_SECRET_KEY` | Bank + CIPC paid checks |

## Smoke

```bash
curl -sS "$APP_URL/api/system/health" | jq .
curl -sS "$APP_URL/api/public/verified-companies?page=1&pageSize=3" | jq .pageCount
# With E2E_ACCESS_TOKEN + E2E_COMPANY_ID:
npx playwright test e2e/trade-loop-smoke.spec.ts
```
