# Referral + trust loop runbook

Operational guide for **supply-chain company SaaS referral**, **peer ratings / OTIFEF**, and **SAM** after deploy.

## 1. Database

Apply (SQL editor or CLI), in order if not already applied:

| Migration | Purpose |
|-----------|---------|
| `20260715_*` / `20260716_referral_*` | Referral attribution, holds, payouts, clawback |
| `20260716_referral_watertight.sql` | Ops-only pay, self-referral guard, explicit attribution |
| `20260716_platform_improvements.sql` | `sam_conversations`, `rating_prompts`, onboarding progress, founding waitlist |

Smoke:

```sql
SELECT count(*) FROM public.rating_prompts;
SELECT count(*) FROM public.sam_conversations;
```

## 2. Environment

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | Rating nudge emails after trade |
| `XAI_API_KEY` | SAM (Grok) via xAI Responses API |
| `SAM_MODEL` / `XAI_MODEL` | Optional model pin (default `grok-4.5`) |
| `CRON_SECRET` | Referral cron (`/api/business/referrals/cron`) |
| Paystack webhook secret + URL | Subscription + refund clawback |

## 3. Rating prompts (auto)

Created **soft-fail** (never blocks the trade) when:

| Event | Who rates | Route |
|-------|-----------|--------|
| PO delivered / completed | Buyer → supplier | `PATCH /api/suppliers/purchase-orders` |
| Invoice marked paid | Seller ↔ linked buyer | `POST /api/customers/docs` `mark_paid` |
| Shipment delivered (if peer resolvable via PO / customer) | Company → peer | `PATCH/POST /api/distribution/shipments` |
| Network connection accepted | Mutual | `PATCH /api/connections` accept |

UI: `RatingPromptBanner` + `/dashboard/suppliers/ratings` and `/dashboard/customers/ratings`.

Email: if `RESEND_API_KEY` is set, `createRatingPrompt` sends a short “Rate your partner” mail.

## 4. Referral ops

| Who | Action |
|-----|--------|
| Company | Request payout, save payout KYC (`/api/business/referrals`) |
| Platform ops | Approve / mark paid / void / fraud snapshot (`referral-ops` UI) |

Cron: hold release + stale cleanup via `CRON_SECRET` → `/api/business/referrals/cron`.

## 5. SAM

- Chat: `POST /api/sam/chat` (logs to `sam_conversations`)
- History: `GET /api/sam/history?companyId=` (clock icon in SAM panel)
- Health: `GET /api/sam/chat` → `{ configured }`

## 6. E2E smoke

```bash
# Unauthenticated gates (referral + ratings + SAM history)
npm run test:e2e:auth

# Or specifically
npx playwright test e2e/referral-trust-smoke.spec.ts
```

With a real session:

```bash
export E2E_ACCESS_TOKEN=eyJ...
export E2E_COMPANY_ID=123
export PLAYWRIGHT_BASE_URL=https://www.supplieradvisor.com
npm run test:e2e:session
```

## 7. Production checklist (quick)

1. Migrations applied (tables exist)
2. Resend + XAI keys live on Vercel
3. Paystack webhook hits app for subscription charge/refund
4. Cron scheduled with `CRON_SECRET`
5. One PO complete → pending row in `rating_prompts`
6. One SAM question → row in `sam_conversations` + visible in history panel
