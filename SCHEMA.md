# SupplierAdvisor Schema

World-class multi-module Postgres schema for Supabase project `onkklullmgrdqoertngp`.

**Base migration:** [`supabase/migrations/20260709_world_class_schema.sql`](supabase/migrations/20260709_world_class_schema.sql)

**Additive migrations (also apply via SQL Editor when deploying those features):**

| Migration | Purpose |
|-----------|---------|
| [`20260709_customer_platform_invites.sql`](supabase/migrations/20260709_customer_platform_invites.sql) | Customer invite columns on `customers`, `customer_invitations` table, BC pair unique `uq_bc_requester_requestee` |
| [`20260709_crm_document_visibility.sql`](supabase/migrations/20260709_crm_document_visibility.sql) | `visibility` on quotes/SO/invoices; `shared_with_buyer` / `buyer_profile_id` / `shared_at` on contracts |
| [`20260709_customer_purchase_orders.sql`](supabase/migrations/20260709_customer_purchase_orders.sql) | Customer-portal PO bridge columns (`seller_customer_id`, `source`, dual supplier id) |
| [`20260709_po_reviews.sql`](supabase/migrations/20260709_po_reviews.sql) | Bilateral post-PO peer reviews (`po_reviews`) |
| [`20260709_crm_leads_opportunities.sql`](supabase/migrations/20260709_crm_leads_opportunities.sql) | Leads / opportunities CRM |
| [`20260709_crm_sales_lifecycle.sql`](supabase/migrations/20260709_crm_sales_lifecycle.sql) | Quotes, sales orders, invoices lifecycle |

**Apply script:** [`scripts/apply-schema.mjs`](scripts/apply-schema.mjs)  
`node scripts/apply-schema.mjs` verifies key tables/columns with the service role client after apply.

### Apply migrations (SQL Editor)

Remote DDL cannot be run with the **service role API key** alone (it is not the database password). Apply via SQL Editor:

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/onkklullmgrdqoertngp/sql/new)
2. Paste the full contents of `supabase/migrations/20260709_world_class_schema.sql` → **Run**
3. Paste and run additive migrations needed for the environment (see table above; order listed is recommended for customer platform)
4. Verify: `node scripts/apply-schema.mjs` (expect green checks)

Optional for CLI apply later: set `DATABASE_URL` (pooler connection string from Dashboard → Project Settings → Database) in `.env.local` — never commit it.

Migrations are idempotent (`IF NOT EXISTS` / `sa_add_column` / exception-wrapped DO blocks).

---

## Customer platform invites lifecycle

Two fields — **do not conflate** invitation attempt vs CRM relationship phase:

| Field | Source of truth | Values |
|-------|-----------------|--------|
| `customer_invitations.status` | One invite attempt | `pending` · `claiming` · `accepted` · `declined` · `expired` · `revoked` |
| `customers.invite_status` | Denormalized relationship on CRM row | `not_invited` · `invited` · `accepted` · `suspended` · `declined` · `expired` |

### Invitation attempt (`customer_invitations.status`)

| Status | Meaning |
|--------|---------|
| `pending` | Open invite; claimable if `expires_at > now()` |
| `claiming` | Short-lived lock during claim (atomic pending→claiming) |
| `accepted` | Claim completed; buyer linked |
| `declined` | Invitee declined |
| `expired` | Past `expires_at` unclaimed (set by expire job) |
| `revoked` | Seller cancelled |

`claiming` older than **5 minutes** is reaped back to `pending` by `POST /api/customers/invites/expire` (same window as claim same-user recovery).

### CRM relationship (`customers.invite_status`)

| Status | Meaning | Set when |
|--------|---------|----------|
| `not_invited` | Offline CRM default | Create customer; after revoke with no pending invite |
| `invited` | Outstanding pending invitation | Invite send / resend |
| `accepted` | Claimed; collaboration enabled | Successful claim / unsuspend |
| `suspended` | Seller paused collaboration | Suspend API |
| `declined` | Invitee declined | Decline endpoint |
| `expired` | Last invite expired unclaimed | Expire job |

UI badges: **Offline** (`not_invited` \| `expired` \| `declined`) · **Pending invite** (`invited`) · **Connected** (`accepted`) · **Suspended** (`suspended`).

### Suspend matrix

When seller suspends a **connected** customer:

1. `customers.invite_status = 'suspended'`
2. `business_connections.metadata.suspended = true` (+ `suspended_at`)
3. **Do not** flip connection `status` off `accepted` (history preserved)

| Capability while suspended | Allowed? |
|----------------------------|----------|
| List supplier/customer in portal | Yes (Suspended badge) |
| Buyer read already-shared docs | Yes |
| Buyer raise **new** PO | **No** (403) |
| Seller mark **new** doc shared | **No** (409) |
| Seller progress existing PO | Yes |
| Buyer/seller review on reviewable PO | Yes |
| Unsuspend (no new invite) | Yes → `invite_status=accepted`, clear metadata flags |

APIs:

- `POST /api/customers/invites/suspend` `{ companyId, customerId, privyUserId }`
- `POST /api/customers/invites/unsuspend` `{ companyId, customerId, privyUserId }`

### Expire / reap job

`POST|GET /api/customers/invites/expire` (**must be scheduled** — see `vercel.json` hourly cron)

1. Reap stuck `claiming` (`updated_at` older than 5m) → `pending`, clear `user_id`
2. Flip `pending` with `expires_at < now` → `expired`
3. If no remaining **open** invite (`pending` **or** `claiming`) and CRM phase is `invited` → `invite_status=expired`, clear `invite_token` (only when the conditional CRM update actually writes a row)

**Drain / batching:** each invocation runs up to 10 passes × 500 rows (reap + expire). Response includes `moreWork` — if `true`, invoke again until `reapedClaiming` and `expiredInvitations` are 0 (or `moreWork` is false). Hourly Vercel Cron is usually enough; after long outages, re-run until drained.

**Auth (either):**

| Mode | How |
|------|-----|
| Cron / service | `Authorization: Bearer $CRON_SECRET` or header `x-cron-secret` (env `CRON_SECRET` or `CUSTOMER_INVITE_EXPIRE_SECRET`). Optional body/query `companyId` to scope. Vercel Cron uses **GET** and sends Bearer `$CRON_SECRET` when that env is set. |
| Membership | Body (POST) or query (GET) `{ companyId, privyUserId }` — company-scoped only |

```bash
# Global cron (POST or GET)
curl -X POST "$APP_URL/api/customers/invites/expire" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'

# Company-scoped (seller member)
curl -X POST "$APP_URL/api/customers/invites/expire" \
  -H "Content-Type: application/json" \
  -d '{"companyId":123,"privyUserId":"did:privy:..."}'
```

**Schedule (required in production):**

- In-repo: [`vercel.json`](vercel.json) — hourly cron → `/api/customers/invites/expire`
- Set `CRON_SECRET` in the Vercel project env so the platform attaches `Authorization: Bearer …`
- Alternatives: GitHub Actions or external scheduler hitting the same path with the bearer secret

### Invite-related APIs (summary)

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/customers/invites` | Seller member |
| GET | `/api/customers/invites` | Seller member |
| POST | `/api/customers/invites/resend` | Seller member |
| POST | `/api/customers/invites/revoke` | Seller member |
| POST | `/api/customers/invites/decline` | Token (public-ish) |
| POST | `/api/customers/invites/suspend` | Seller member |
| POST | `/api/customers/invites/unsuspend` | Seller member |
| POST/GET | `/api/customers/invites/expire` | Member **or** cron secret (GET for Vercel Cron) |
| GET | `/api/customers/summary` | companyId (includes invite counts) |
| GET | `/api/invites/validate?kind=customer` | Public token |
| POST | `/api/invites/claim` `{ kind: 'customer' }` | Privy user |

Feature flag: `CUSTOMER_INVITES_ENABLED` (default true when unset).

---

## Modules & tables

### Core
| Table | Purpose |
|-------|---------|
| `profiles` | Companies / workspaces (onboarding, currency, timezone, buyer flag, metadata) |
| `business_users` | Team memberships, permissions, invite expiry |
| `business_connections` | Partner network links (status, type, notes, metadata incl. `suspended` for customer edges) |
| `invitations` | Team / supplier invites |

### Procurement
| Table | Purpose |
|-------|---------|
| `purchase_orders` | Buyer/supplier POs, amounts, items JSON, on-chain refs; customer portal: `seller_customer_id`, `source` |
| `po_items` | Line items (tax, received qty) |
| `po_reviews` | Bilateral post-PO peer reviews (1–5 stars; UNIQUE per PO+reviewer; published\|hidden) |
| `requisitions` | Pre-PO purchase requests |
| `supplier_scorecards` | OTIFEF performance snapshots (written by `GET /api/suppliers/otifef?persist=1`) |

### Supplier SRM (buyer book)
| Table | Purpose |
|-------|---------|
| `srm_suppliers` | Company-scoped supplier master (buyer `profile_id`): metadata, certs, trust/OTIFEF cache, `linked_profile_id`, `connection_id`, invite lifecycle. Migration: `20260709_srm_supplier_module.sql`. |
| `supplier_invitations` | Platform invites for off-platform suppliers (`token`, 14-day expiry, pending\|accepted\|revoked…). Claim via existing business invite + SRM link on accept. |
| `supplier_documents` | Shared vault (`visibility` private\|shared, version, content_hash). Share requires accepted `business_connections` with `connection_type='supplier'` (buyer=requester, supplier=requestee). |

APIs: `/api/suppliers`, `/summary`, `/discover`, `/connect`, `/invites`, `/otifef`, `/ratings`, `/documents`, `/purchase-orders`, `/purchase-orders/[id]/onchain`. Feature flags: `SUPPLIER_INVITES_ENABLED` (default true), `SUPPLIER_PO_ESCROW_ENABLED` / `NEXT_PUBLIC_SUPPLIER_PO_ESCROW_ENABLED` (default **true** — client-signed POEscrowV2 create/fund/release).

### SRM purchase order process
| Step | Off-chain | On-chain (optional) |
|------|-----------|---------------------|
| Raise | `POST /api/suppliers/purchase-orders` (`source=srm`) | — |
| Escrow create | status stays sent/accepted | wallet `createPO` → `POST …/onchain` kind=create |
| Fund | status → `funded` | wallet `fundPO` + value |
| Delivery | PATCH promised/actual qty + damaged → `completed` (OTIFEF inputs) | — |
| Release | status completed | wallet `releaseFunds` → `POST …/onchain` kind=release |
| Rate | `POST /api/suppliers/ratings` | — |

Buyer transitions: `lib/procurement/types.ts` → `SRM_BUYER_PO_TRANSITIONS`.

### Inventory
| Table | Purpose |
|-------|---------|
| `warehouses` | Storage locations per profile |
| `products` | SKUs (warehouse, reorder, qty on hand) |
| `stock_levels` | On-hand / reserved / available per warehouse |
| `stock_movements` | Receipts, issues, transfers, adjustments |

### Containers (retail outlets)
| Table | Purpose |
|-------|---------|
| `containers` | Outlets linked to profile / contractor |
| `container_contractors` | Operator registry |
| `container_sales` | Daily sales |
| `container_payouts` | Contractor payouts |

### Customers / sales
| Table | Purpose |
|-------|---------|
| `customers` | Customer master (seller CRM). Invite/platform fields: `linked_profile_id`, `connection_id`, `invite_status` (`not_invited` \| `invited` \| `accepted` \| `suspended` \| `declined` \| `expired`), `invite_token`, `invited_at`, `invite_accepted_at`, `invited_email`. Partial unique `uq_customers_profile_linked` on `(profile_id, linked_profile_id)` where linked is set. |
| `customer_invitations` | Platform invites for customers (token, seller `profile_id`, `customer_id`, email, status `pending`\|`claiming`\|`accepted`\|`declined`\|`expired`\|`revoked`, optional `target_profile_id`, 14-day `expires_at`). Migration: `20260709_customer_platform_invites.sql`. |
| `sales_orders` | Outbound orders + line items JSON. `visibility` (`seller_only` \| `shared`) — buyer reads only via `GET /api/buyer/documents` when shared. Same flag on `customer_quotes` / `customer_invoices`. |
| `customer_contracts` | Commercial contracts. Share fields: `shared_with_buyer`, `buyer_profile_id`, `shared_at` (migration `20260709_crm_document_visibility.sql`). |
| `customer_quotes` / `customer_invoices` | Quotes & AR invoices with `visibility` for buyer shared reads. |
| `leads` | Pipeline leads |
| `opportunities` | Opportunity pipeline |

`business_connections` pair unique: `uq_bc_requester_requestee` on `(requester_profile_id, requestee_profile_id)` — claim UPSERT conflict target. Migration runs a **destructive** one-time cleanup before index create (keeps preferred edge per pair: `status=accepted`, then newest `updated_at`/`created_at`, then highest `id`; higher-ranked losers are deleted). Index create fails the migration if the unique index cannot be created.

Customer-type edges: `connection_type = 'customer'`, seller = `requester`, buyer = `requestee`, `status = 'accepted'`. Suspend freezes **new** collaboration via `metadata.suspended` only.

### Distribution / logistics
| Table | Purpose |
|-------|---------|
| `shipments` | Inbound/outbound tracking |
| `carriers` | Carrier master |

### Quality & compliance
| Table | Purpose |
|-------|---------|
| `quality_inspections` | Incoming / process inspections |
| `haccp_records` | CCP measurements |
| `compliance_certificates` | Compliance certificates (named to avoid clashing with any legacy `certificates` table) |
| `riad_logs` | Risk (RIAD) logs (profile-linked) |

### Finance / accounting
| Table | Purpose |
|-------|---------|
| `chart_of_accounts` | GL accounts |
| `journal_entries` / `journal_lines` | Double-entry books |
| `invoices` | AR/AP invoices |
| `payments` | Payment records |

### People / HR
| Table | Purpose |
|-------|---------|
| `employees` | Staff master |
| `training_records` | Training assignments |

### Projects
| Table | Purpose |
|-------|---------|
| `projects` | Project headers (budget, priority) |
| `project_tasks` | Tasks |
| `timesheets` | Time entries |

### Sustainability
| Table | Purpose |
|-------|---------|
| `carbon_entries` | kgCO2e records |
| `sustainability_certificates` | Green certs |

### Audit
| Table | Purpose |
|-------|---------|
| `activity_log` | Cross-module activity feed. Customer invite actions: `customer.invite.sent` / `.accepted` / `.declined` / `.expired` / `.revoked`; `customer.connection.suspended` / `.unsuspended`. |

## Key column checks (post-migration)

Use service role to confirm:

- `profiles.onboarding_complete`
- `purchase_orders.buyer_profile_id`, `purchase_orders.items`
- `purchase_orders.total_amount`, `purchase_orders.supplier_profile_id` + `supplier_id`
- `purchase_orders.seller_customer_id`, `purchase_orders.source` (customer portal bridge)
- `po_reviews` table exists with UNIQUE `(purchase_order_id, reviewer_profile_id)`
- `customers.invite_status`, `customers.linked_profile_id`, `customer_invitations` table
- `containers.profile_id`, `containers.assigned_contractor`
- `business_connections.responded_at`
- Tables exist: `warehouses`, `customers`, `sales_orders`, `invoices`, `employees`, `activity_log`, `requisitions`, `supplier_scorecards`, `stock_levels`, `shipments`

```bash
node scripts/apply-schema.mjs
```

## Security notes

- Migration enables RLS on new tables with **transitional open policies** (`USING (true)`). Tighten when Privy→JWT claims are wired.
- App-layer membership (`assertCompanyMember`) is required on privileged customer invite / suspend / share / buyer routes.
- Service role bypasses RLS; never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- Expire job secret (`CRON_SECRET`) is server-only; never commit it.
- Do not commit `.env.local` or any secret keys.

## Environment

| Variable | Where |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (invite APIs, schema apply, privileged writes) |
| `CUSTOMER_INVITES_ENABLED` | Server (default true when unset; set `false` to 503 invite APIs) |
| `PO_REVIEWS_ENABLED` | Server (default true when unset; set `false` to 503 reviews APIs) |
| `CRON_SECRET` / `CUSTOMER_INVITE_EXPIRE_SECRET` | Server only — bearer for `POST /api/customers/invites/expire` |
| `CUSTOMER_PO_ESCROW_ENABLED` | Server — optional client-signed POEscrow for buyer POs (default false) |
| `NEXT_PUBLIC_CUSTOMER_PO_ESCROW_ENABLED` | Client UI flag (must match server when enabling) |

Optional for remote `psql` / CLI apply (not required for the app runtime):

- `DATABASE_URL` / `SUPABASE_DB_URL` — direct Postgres connection string
- `SUPABASE_ACCESS_TOKEN` — Supabase Management API token
