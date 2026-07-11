# Tier 1 — API authentication & multi-tenant isolation

## Model

1. **Browser** authenticates with Privy.
2. **`ApiAuthBridge`** attaches `Authorization: Bearer <access_token>` to all `/api/*` fetches.
3. **Middleware** (production) rejects `/api/*` requests with no Bearer/cookie (coarse gate).
4. **Route handlers** call `requireCompanyAccess(request, companyId)` which:
   - Verifies JWT against Privy JWKS (`lib/auth/verify-privy.ts`)
   - Checks active `business_users` membership
5. **Service-role Supabase** runs only after that gate.
6. **RLS** (`20260711_tier1_rls_hardening.sql`) denies **anon** direct table access.

## Env

```bash
NEXT_PUBLIC_PRIVY_APP_ID=...   # required for JWKS
# Production default: AUTH_STRICT=true (or unset on Vercel production)
AUTH_STRICT=true

# Local emergency only — never in production:
# AUTH_STRICT=false
# AUTH_ALLOW_LEGACY_PRIVY_ID=true
```

## Public routes (no JWT)

See `lib/auth/public-paths.ts`:

- `/api/public/*`
- `/api/fx/rates`
- `/api/system/health`
- `/api/invites/validate`
- `/api/banking/webhooks/*`
- `/api/inventory/products/public`

Cron uses `CRON_SECRET` Bearer (not Privy).

## Helpers

```ts
import { requireCompanyAccess, requireVerifiedUser, legacyPrivyFrom } from '@/lib/auth/api-auth';

const gate = await requireCompanyAccess(request, companyId, {
  legacyPrivyUserId: legacyPrivyFrom(request, body),
});
if (!gate.ok) return gate.response;
// gate.userId is trusted
```

## Tests

```bash
npx playwright test e2e/auth-smoke.spec.ts
```
