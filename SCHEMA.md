# SupplierAdvisor Schema

World-class multi-module Postgres schema for Supabase project `onkklullmgrdqoertngp`.

**Base migration:** [`supabase/migrations/20260709_world_class_schema.sql`](supabase/migrations/20260709_world_class_schema.sql)

**Additive migrations (also apply via SQL Editor when deploying those features):**
- [`supabase/migrations/20260709_customer_platform_invites.sql`](supabase/migrations/20260709_customer_platform_invites.sql) — customer invite columns, `customer_invitations`, BC pair unique `uq_bc_requester_requestee`
- [`supabase/migrations/20260709_customer_purchase_orders.sql`](supabase/migrations/20260709_customer_purchase_orders.sql) — buyer-raised POs: `total_amount`, dual `supplier_id`/`supplier_profile_id`, `seller_customer_id`, `source`

**Apply script:** [`scripts/apply-schema.mjs`](scripts/apply-schema.mjs)  
`node scripts/apply-schema.mjs` verifies key tables/columns with the service role client after apply.

### Apply migrations (SQL Editor)

Remote DDL cannot be run with the **service role API key** alone (it is not the database password). Apply via SQL Editor:

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/onkklullmgrdqoertngp/sql/new)
2. Paste the full contents of `supabase/migrations/20260709_world_class_schema.sql` → **Run**
3. Paste and run any additive migrations needed for the environment:
   - Customer platform invites: `supabase/migrations/20260709_customer_platform_invites.sql`
   - Customer-portal purchase orders: `supabase/migrations/20260709_customer_purchase_orders.sql`
4. Verify: `node scripts/apply-schema.mjs` (expect green checks)

Optional for CLI apply later: set `DATABASE_URL` (pooler connection string from Dashboard → Project Settings → Database) in `.env.local` — never commit it.

Migrations are idempotent (`IF NOT EXISTS` / `sa_add_column` / exception-wrapped DO blocks).

## Modules & tables

### Core
| Table | Purpose |
|-------|---------|
| `profiles` | Companies / workspaces (onboarding, currency, timezone, buyer flag, metadata) |
| `business_users` | Team memberships, permissions, invite expiry |
| `business_connections` | Partner network links (status, type, notes) |
| `invitations` | Team / supplier invites |

### Procurement
| Table | Purpose |
|-------|---------|
| `purchase_orders` | Buyer/supplier POs, amounts, items JSON, on-chain refs |
| `po_items` | Line items (tax, received qty) |
| `requisitions` | Pre-PO purchase requests |
| `supplier_scorecards` | OTIFEF performance snapshots |

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
| `sales_orders` | Outbound orders + line items JSON |
| `leads` | Pipeline leads |

`business_connections` pair unique: `uq_bc_requester_requestee` on `(requester_profile_id, requestee_profile_id)` — claim UPSERT conflict target. Migration runs a **destructive** one-time cleanup before index create (keeps preferred edge per pair: `status=accepted`, then newest `updated_at`/`created_at`, then highest `id`; higher-ranked losers are deleted). Index create fails the migration if the unique index cannot be created.

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
| `activity_log` | Cross-module activity feed |

## Key column checks (post-migration)

Use service role to confirm:

- `profiles.onboarding_complete`
- `purchase_orders.buyer_profile_id`, `purchase_orders.items`
- `purchase_orders.total_amount`, `purchase_orders.supplier_profile_id` + `supplier_id`
- `purchase_orders.seller_customer_id`, `purchase_orders.source` (customer portal bridge)
- `containers.profile_id`, `containers.assigned_contractor`
- `business_connections.responded_at`
- Tables exist: `warehouses`, `customers`, `sales_orders`, `invoices`, `employees`, `activity_log`, `requisitions`, `supplier_scorecards`, `stock_levels`, `shipments`

```bash
node scripts/apply-schema.mjs
```

## Security notes

- Migration enables RLS on new tables with **transitional open policies** (`USING (true)`). Tighten when Privy→JWT claims are wired.
- Service role bypasses RLS; never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- Do not commit `.env.local` or any secret keys.

## Environment

| Variable | Where |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (invite APIs, schema apply, privileged writes) |

Optional for remote `psql` / CLI apply (not required for the app runtime):

- `DATABASE_URL` / `SUPABASE_DB_URL` — direct Postgres connection string
- `SUPABASE_ACCESS_TOKEN` — Supabase Management API token
