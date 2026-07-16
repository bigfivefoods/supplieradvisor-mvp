# Secrets hygiene & production deploy

## Required Vercel env (production)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server APIs, geo seed, health |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Checkout |
| `PAYSTACK_SECRET_KEY` | Verify payments (R50 bank, R69 CIPC, subscriptions) |
| `VERIFYNOW_API_KEY` | CIPC + bank AVS + people ID |
| `VERIFYNOW_MODE` | `production` or `sandbox` |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Auth |
| `PRIVY_*` | Privy server secrets as configured |
| `INVENTORY_PASSPORT_ADDRESS` | On-chain product passport |
| `PRIVATE_KEY` | Sepolia/Base minter (never commit) |
| `CRON_SECRET` | Cron routes |
| `RESEND_API_KEY` | Email |
| `XAI_API_KEY` | SAM |

## Hygiene rules

1. **Never paste live private keys or API secrets into chat or git.**
2. Rotate any key that was shared in a ticket or PR description.
3. Prefer Vercel encrypted env; no `.env` with production secrets in the repo.
4. After rotation, redeploy production once.

## Deploy discipline

1. Prefer **one** production path: push to `main` → GitHub → Vercel auto-deploy.
2. Avoid stacking multiple `vercel deploy --prod` while builds are queued.
3. Confirm live commit: `GET /api/system/health` → `deploy.commitShort`.
4. After feature work that needs schema, run migrations **before** users hit the feature:
   - `20260716_profiles_branch_code.sql`
   - `20260716_bank_account_verification.sql`
   - `20260716_geo_reference_public_read.sql`
5. Health `degraded: true` with `schemaMissingColumns` means run SQL immediately.

## VerifyNow credits

- CIPC and bank AVS responses include `remainingCredits`.
- Profile UI shows credits after a check; top up at verifynow.co.za when low.
- Use `VERIFYNOW_MODE=sandbox` for demos without burning credits.

## Secret rotation checklist

If a key was ever pasted into chat, a ticket, or a PR:

1. Rotate in the provider (Paystack, VerifyNow, Supabase service role, Privy, Resend, wallet `PRIVATE_KEY`).
2. Update Vercel Production + Preview env.
3. Redeploy production once.
4. Confirm `/api/system/health` still green.

See also `docs/IMPROVEMENTS_23.md` for the latest product batch.
