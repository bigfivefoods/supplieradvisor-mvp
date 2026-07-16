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

## Sprint follow-up (location + trade loop)

| Item | Status |
|------|--------|
| Discover empty → invite CTA with country prefill | Shipped |
| Profile save derives continent from country | Shipped (`applyLocationDefaults`) |
| Location backfill API | `POST /api/business/location-backfill` (company or cron) |
| Connection workspace next-action CTA | Shipped |
| Email/in-app on connection accept + invoice send | Shipped |

## Mini-sprint (directory / passport / bell / catalogue)

| Item | Status |
|------|--------|
| Homepage directory continent→country cascade (full Africa) | Shipped |
| Public API continent filter via country map | Shipped |
| Buyer PO product passport links | Shipped |
| Notification bell deep-links + inbox/activity merge | Shipped |
| Catalogue-empty banner (dashboard + suppliers hub) | Shipped |

## Mini-sprint 2 (connect / quality / buyer catalogue / inbound deep-link)

| Item | Status |
|------|--------|
| Public `/c/[id]` Request connection | Shipped (`PublicConnectButton`) |
| Invoice pre-send quality checklist | Shipped (`/api/customers/docs/quality` + confirm) |
| Buyer PO supplier catalogue picker + passport chips | Shipped |
| Inbound PO deep-link `?tab=inbound&po=` expand/highlight | Shipped |

## Mini-sprint 3 (visibility / inbox / directory growth)

| Item | Status |
|------|--------|
| Profile “visible in search?” card | Shipped (`SearchVisibilityCard`) |
| Homepage directory empty → invite by country | Shipped |
| Connections pending inbox Accept/Decline | Shipped |
| Inbound PO deep-link primary Accept/Decline | Shipped |

## Mini-sprint 4 (eligibility / backfill / invoice CTA / toggle)

| Item | Status |
|------|--------|
| Discover eligibility strip (visible/hidden counts) | Shipped |
| Select-company “Fix locations” multi backfill | Shipped |
| PO accept → Create invoice CTA | Shipped |
| Profile discoverable toggle on visibility card | Shipped |

## Mini-sprint 5 (fromPo prefill / email inbox / qty / ratings / cron)

| Item | Status |
|------|--------|
| Invoice form prefill from `?fromPo=` | Shipped |
| Connection request email → `?focus=incoming` | Shipped |
| Buyer catalogue qty + merge lines | Shipped |
| Rating prompts on PO completed/paid | Shipped |
| Daily location-backfill cron (04:15 UTC) | Shipped |

## Mini-sprint 6 (fromPo customer / double invoice / ratings / bell / peer CTA)

| Item | Status |
|------|--------|
| Auto-create/link CRM customer on fromPo | Shipped |
| Block duplicate invoice for same PO | Shipped |
| Buyer delivery → mutual rating prompts | Shipped |
| Post-accept + accepted-PO notifications → fromPo invoice | Shipped |
| Peer workspace Create invoice primary CTA | Shipped |

## Mini-sprint 7 (draft fromPo / source_po_id / OTIFEF / peer Accept)

| Item | Status |
|------|--------|
| fromPo invoices create as **draft** + “Email when ready” CTA | Shipped |
| `customer_invoices.source_po_id` migration + API dual double-invoice guard | Shipped (run SQL in Supabase) |
| OTIFEF preview on delivery + require delivered qty to complete | Shipped |
| Peer workspace **Accept** inbound PO (`status=sent`) | Shipped |
| Deploy Vercel prod | After push |

**Ops migration:** `supabase/migrations/20260716_customer_invoices_source_po_id.sql`

Ops after every major deploy:

```bash
curl -sS "$APP_URL/api/system/health" | jq '{ok,deploy,degraded}'
curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":200}' \
  "$APP_URL/api/business/location-backfill"
```
