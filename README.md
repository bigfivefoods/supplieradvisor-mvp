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
| `SUPABASE_SERVICE_ROLE_KEY` | Team & supplier invite APIs |
| `RESEND_API_KEY` | Invitation emails |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Wallet connect |

See `.env.example` for the full list.

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
lib/                  # Server helpers (Supabase admin, Resend)
utils/supabase/       # Browser & server Supabase clients
src/lib/contracts/    # On-chain PO escrow service
contracts/            # Solidity sources & deploy scripts
supabase/             # Edge functions
```

## Core product flows

1. **Landing** → Join beta / Log in (Privy)
2. **Onboarding** → Register business or claim invite
3. **Select company** → Choose workspace (`business_users` memberships)
4. **Dashboard** → Company command center + module hubs
5. **My Business / Suppliers / Containers** → Primary operational modules

Modules still on the roadmap render a consistent **Coming Soon** experience so navigation never dead-ends.

## Notes

- Prefer a single package manager (`npm`) — `package-lock.json` is authoritative.
- Do not commit `.env.local` or service-role keys.
- Dashboard auth is enforced client-side via Privy (`AuthGate`); edge middleware only sets security headers until server-side Privy session cookies are fully configured.
