# Changelog

## 2026-07-09 — Platform hardening & design consistency

- Fixed production build crash: API routes no longer instantiate Supabase admin / Stripe / Resend / chain clients at module load
- Added `lib/supabase/admin.ts` and `lib/resend.ts` lazy server helpers
- Moved middleware to project root; auth enforced via client `AuthGate` (Privy)
- Split root layout providers into `components/Providers.tsx` with proper metadata
- Login page aligned with Privy (removed broken Supabase password-only flow)
- Select company loads **all** active memberships (not only owners); sign-out + register CTAs
- Added missing routes: containers/add, containers/training, customers/contracts, customers/invites
- Upgraded stub modules to shared `ComingSoon` experience (no dead-end navigation)
- Dashboard greeting time-aware; switch-company actions in sidebar + home
- Design system: `.btn-secondary`, softer heading colors, sidebar active-state fix
- Repo hygiene: `.env.example`, improved `.gitignore`, README, package.json cleanup
- Removed accidental nested empty git clone folder

## 2026-06-14 — Major update

- Fixed select-company to show linked companies
- Fixed onboarding `business_users` linking
- Added Get Verified button + multi-country workflow (CIPC/SARS/CAC)
- Fixed profile page loading and prerender
- Supabase schema + RLS for associations and verification fields
