# SupplierAdvisor Schema

World-class multi-module Postgres schema for Supabase project `onkklullmgrdqoertngp`.

**Migration file:** [`supabase/migrations/20260709_world_class_schema.sql`](supabase/migrations/20260709_world_class_schema.sql)

**Apply script:** [`scripts/apply-schema.mjs`](scripts/apply-schema.mjs)  
`node scripts/apply-schema.mjs` attempts remote apply via pg-meta, then verifies key tables/columns with the service role client.

> **Manual apply:** If remote SQL endpoints are unavailable, paste the full migration into the Supabase Dashboard → SQL Editor and run it. The migration is idempotent (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`).

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
| `customers` | Customer master |
| `sales_orders` | Outbound orders + line items JSON |
| `leads` | Pipeline leads |

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
| `certificates` | Compliance certificates |
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
