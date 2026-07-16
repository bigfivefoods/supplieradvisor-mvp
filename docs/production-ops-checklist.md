# Production ops checklist + dry-run

Use after each major deploy. Code often lands before **config**.

## 1. Database migrations

Apply pending SQL under `supabase/migrations/` (editor or CLI), especially:

| Migration | Purpose |
|-----------|---------|
| `20260716_referral_*` / `referral_watertight` | SaaS referral, holds, KYC columns |
| `20260716_platform_improvements.sql` | SAM log, rating_prompts, onboarding, founding_waitlist |
| `20260716_container_share_views.sql` | Embed `view_count` / `last_viewed_at` |
| `20260716_subscription_reminders.sql` | `subscription_reminder_meta` |

Smoke:

```sql
SELECT count(*) FROM rating_prompts;
SELECT count(*) FROM sam_conversations;
SELECT count(*) FROM founding_waitlist;
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'profiles' AND column_name = 'subscription_reminder_meta';
```

## 2. Environment (Vercel)

| Variable | Required for |
|----------|----------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Auth |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | APIs |
| `RESEND_API_KEY` + from address | Invites, digests, trial mail, waitlist |
| `XAI_API_KEY` | SAM |
| `CRON_SECRET` | All crons |
| `REFERRAL_OPS_SECRET` (optional) | Ops API without root membership |
| Paystack keys + webhook URL | Subscription + clawback |

## 3. Crons (must appear in Vercel → Crons)

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/business/referrals/cron` | 03:00 & 15:00 UTC | Hold release |
| `/api/business/rating-prompts/cron` | 08:00 UTC | Rating digest |
| `/api/business/subscription/cron` | 07:00 UTC | Trial/expiry emails |
| Banking / invite expire | As configured | Ops hygiene |

Smoke:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "$APP_URL/api/business/subscription/cron"
curl -sS "$APP_URL/api/system/health"
```

Expect health `ok: true`; soft flags for missing Resend/XAI/cron if unset.

## 4. Activation dry-run (30 min)

| Step | Expected |
|------|----------|
| Register / select company | Trial or lifetime access |
| Profile save | Golden path profile ticks |
| Invite partner / supplier | First-partner step; “N of 3” meter |
| Quote or PO | First trade step |
| Complete PO / pay invoice | Rating prompt banner |
| Rate now (modal) | Trust CTA; golden path rate_partner |
| Billing open | Billing step; KYC form save |
| Request payout without KYC | Scroll/highlight KYC + error |
| QA: open inspection on lot → ship | 409 `QA_HOLD` + toast |
| Containers → Reports | Performance / regional / inventory CSV |
| Trust → Trust pack CSV | Downloads with OTIFEF + ratings |
| Open public container embed | View count increments on Share settings |

## 5. Ops-only dry-run

| Step | Path |
|------|------|
| Founding waitlist **Email waiting** | `/dashboard/my-business/founding-waitlist` |
| Bulk invite | Same page — status → invited + email |
| Referral clawback | `docs/referral-clawback-drill.md` |
| Referral ops pay | `/dashboard/my-business/referral-ops` |

## 6. Pass / fail

- [ ] Migrations applied  
- [ ] Env complete on production  
- [ ] Crons return 200 with secret  
- [ ] Activation dry-run complete without schema errors  
- [ ] One real Resend email received (invite or trial test)  
- [ ] One Paystack test payment or webhook log (staging OK)  

## Related

- `docs/referral-trust-runbook.md`
- `docs/qa-ship-hold-demo.md`
- `docs/e2e-authenticated.md`
- `docs/referral-clawback-drill.md`
