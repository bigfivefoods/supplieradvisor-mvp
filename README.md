# SupplierAdvisor MVP

On-chain B2B / B2C supply-chain platform for verified trading, purchase orders, container retail, and operational intelligence across African food systems.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS
- **Privy** for authentication (email, social, wallet)
- **Supabase** for company profiles, memberships, and operational data
- **wagmi / RainbowKit / viem** for wallet connectivity
- **Resend** for invitation emails
- **Stripe / Paystack** for payments
- **Foundry / Hardhat** smart contracts (`POEscrow`, `SupplierRegistry`)

## Getting started

```bash
# Install (npm is the primary lockfile used in this repo)
npm install

# Copy env and fill in values
cp .env.example .env.local

# Dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Required env for core flows

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Login |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Data access |
| `SUPABASE_SERVICE_ROLE_KEY` | Team, supplier, and customer invite APIs |
| `RESEND_API_KEY` | Invitation emails |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Wallet connect |

See `.env.example` for the full list (feature flags, escrow, cron secret, VerifyNow).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | Next.js lint |

## App structure

```
app/                  # Next.js routes (landing, onboarding, dashboard, APIs)
components/           # Shared UI (Sidebar, ModuleHub, ComingSoon, forms)
lib/                  # Server helpers (Supabase admin, Resend, customer access)
utils/supabase/       # Browser & server Supabase clients
src/lib/contracts/    # On-chain PO escrow service
contracts/            # Solidity sources & deploy scripts
supabase/             # Edge functions + SQL migrations
docs/design/          # Feature design docs
```

## Core product flows

1. **Landing** → Join beta / Log in (Privy)
2. **Onboarding** → Register business or claim invite
3. **Select company** → Choose workspace (`business_users` memberships)
4. **Dashboard** → Company command center + module hubs
5. **My Business / Suppliers / Containers** → Primary operational modules
6. **Customers CRM** → Leads → customer account → optional **platform invite** → connected buyer workspace

Modules still on the roadmap render a consistent **Coming Soon** experience so navigation never dead-ends.

## Customer platform invites

Sellers can invite CRM customers onto SupplierAdvisor so buyers get a company-scoped portal (POs, shared docs, reviews). Offline customers remain fully valid for seller-only quotes/orders/invoices.

| Phase | CRM `invite_status` | Notes |
|-------|---------------------|--------|
| Offline | `not_invited` / `expired` / `declined` | No platform link |
| Pending | `invited` | Open `customer_invitations` row |
| Connected | `accepted` | `linked_profile_id` + BC edge `type=customer` |
| Suspended | `suspended` | New POs/shares blocked; history retained |

**Key seller UI:** `/dashboard/customers/invites`, `/dashboard/customers/profiles` (invite + suspend/unsuspend).

**Key buyer UI:** `/dashboard/buyer` (suppliers, POs, documents, reviews).

### Maintenance: expire + reclaim stuck claims (**must schedule**)

Without a scheduler, stuck `claiming` only recovers via same-user claim retry after 5m, and CRM `invite_status` can lag past `expires_at`.

| How | Detail |
|-----|--------|
| **Vercel Cron (in-repo)** | [`vercel.json`](vercel.json) — hourly `GET /api/customers/invites/expire`. Set `CRON_SECRET` in project env (Vercel sends `Authorization: Bearer $CRON_SECRET`). |
| Manual / external | curl below (POST or GET) with the same secret |

```bash
# Requires CRON_SECRET in server env. Re-run while response.moreWork === true
# (large backlogs: up to 10×500 rows per invocation).
curl -X POST "$APP_URL/api/customers/invites/expire" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

- Pending invites past `expires_at` → `expired`; CRM phase flips to `expired` only when no other **open** invite remains (`pending` or `claiming`).
- Stuck `claiming` locks older than **5 minutes** → back to `pending`.

Company members can also run the job scoped to their company with `{ companyId, privyUserId }`.

Full lifecycle, suspend matrix, and migration list: **[SCHEMA.md](./SCHEMA.md)**. Design: `docs/design/customer-crm-platform-invite-2026-07-09.md`.

## Schema

See **[SCHEMA.md](./SCHEMA.md)** for tables, customer invite lifecycle, suspend semantics, and how to apply migrations via the Supabase SQL Editor.

```bash
# After applying SQL migrations
node scripts/apply-schema.mjs
```

## Notes

- Prefer a single package manager (`npm`) — `package-lock.json` is authoritative.
- Do not commit `.env.local` or service-role / cron secrets.
- Dashboard auth is enforced client-side via Privy (`AuthGate`); edge middleware only sets security headers until server-side Privy session cookies are fully configured.
- Privileged CRM/buyer routes enforce app-layer `business_users` membership (not deferred polish).
