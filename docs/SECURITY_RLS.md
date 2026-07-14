# Supabase RLS & data security (SupplierAdvisor)

## Security model

| Layer | Role | Access |
|-------|------|--------|
| Browser | `anon` key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) | **No table access** after lockdown |
| Next.js API | `service_role` (`SUPABASE_SERVICE_ROLE_KEY`) | Full DB (bypasses RLS) **after** Privy JWT + company membership checks |
| Supabase Auth `authenticated` | JWT from Supabase Auth | **Denied** by default (product uses Privy, not Supabase Auth sessions for multi-tenant data) |

**Never** put `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_*` or client bundles.

## Apply lockdown

1. Open **Supabase → SQL Editor**
2. Run: `supabase/migrations/20260714_rls_security_lockdown.sql`
3. Confirm:

```sql
-- All tables should show rowsecurity = true
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY 1;

-- Policies should be sa_deny_anon / sa_deny_authenticated only (or intentional public storage read)
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY 1, 2
LIMIT 100;
```

4. Hard-refresh the app and smoke-test: login, containers, invoices, inventory, join link.

## What the migration does

1. **ENABLE + FORCE RLS** on every `public` base table  
2. **DROP** all existing policies (including dangerous `USING (true)` open policies)  
3. **CREATE** deny-all for `anon` and `authenticated`  
4. **REVOKE** table/sequence privileges from `anon` / `authenticated` / `PUBLIC`  
5. **Storage**: deny anon write; optional public **read** only for logo/photo buckets  

## App-side enforcement (already required)

API routes must continue to:

1. Verify Privy JWT (`requireVerifiedUser` / `requireCompanyAccess`)  
2. Check `business_users` membership for `companyId`  
3. Scope every query with `profile_id = companyId` (or equivalent)  

RLS does **not** replace membership checks when using the service role.

## Public endpoints (allowed without login)

Only routes under `/api/public/*` (and listed health/fx/webhooks) — e.g.:

- Container network embed  
- Invoice feedback QR  
- Join profile / claim  

These use the **service role on the server** and return **minimal fields** only.

## After lockdown: client direct Supabase

Any remaining browser `.from('…')` with the anon key will **fail**. That is intentional.

**Migrate** those pages to API routes (service role + auth). Known historical client usages:

- `app/dashboard/suppliers/directory`  
- `app/dashboard/loyalty`  
- `app/dashboard/my-business/projects`  
- `app/dashboard/buyer/*` reviews/pos  
- `app/dashboard/customers/orders|reviews` (profile name lookups)  
- Client storage uploads (`uploadPhoto`, product assets) — prefer server upload API  

Join flow is already migrated to `/api/public/join-profile` + `/api/public/join-claim`.

## Storage uploads

With anon write denied, browser uploads to Storage will fail until you either:

1. Add a **server upload API** that uses the service role, or  
2. Add a **tight** storage INSERT policy (e.g. path must start with known company folder) — weaker than server uploads  

Recommended: service-role upload routes only.

## Ongoing checklist

- [ ] Service role only on server  
- [ ] Run `20260714_rls_security_lockdown.sql` on production  
- [ ] No `USING (true)` policies left  
- [ ] New migrations call `sa_lock_table('new_table')` or deny-anon pattern  
- [ ] Public APIs rate-limited and field-minimal  
- [ ] Quarterly: review `pg_policies` + Storage policies in Dashboard  

## Honest “100% secure” note

No system is absolutely secure. This design provides:

- **Strong isolation** of tenant data from the public internet via RLS + revoked grants  
- **Defense in depth** if the anon key is abused  
- **Application-layer tenancy** via membership checks  

Still required: secure env vars, least-privilege Vercel access, dependency updates, and never logging secrets.
