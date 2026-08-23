# Multi-Party Order Chains + Commercial Close-the-Loop

**Status:** Phase A foundation shipped on branch `feature/multi-party-order-chains`  
**Date:** 23 August 2026  
**Repo:** bigfivefoods/supplieradvisor-mvp

## Goal

Enable Big Five Foods (middleman) to:

1. Create or receive Sales Orders (Boxer / other customers)
2. Raise linked **or** independent Purchase Orders to Kelpack (or any manufacturer)
3. Let the manufacturer update production status + batches via supplier portal
4. Cascade non-commercial fields back to BFF and the customer
5. Close the commercial loop: pay manufacturer (POP) + invoice customer

Linking is **optional**. Independent POs and internal SOs are first-class.

## Phase A (this commit)

### Schema (`supabase/migrations/20260828_order_links_and_cascade.sql`)

- `order_links` — optional SO↔PO links (`link_type=fulfillment`, soft-unlink)
- Cascade fields on `sales_orders` + `purchase_orders`:
  - `production_status`, `confirmed_qty`, `actual_completion_date`, `cascade_updated_at`
- `sales_orders.origin` (`customer_portal` | `internal` | `api` | `import`)
- `purchase_orders.payment_status` + `amount_paid`
- `order_batches` — multi-lot capture
- `supplier_payments` — payment + POP skeleton
- `manufacturing_production_orders.purchase_order_id` convenience link
- `customer_invoices.source_order_id` (backfilled from `order_id`)

### Code

- `lib/orders/order-links.ts` — types, cascade-safe field list, customer-visible status labels
- `app/api/orders/links/route.ts` — GET / POST / DELETE for links (membership-checked)

## Next phases

| Phase | Scope |
|-------|--------|
| **B** | One-click “Raise linked PO”, supplier production status form + event cascade, realtime, batches UI |
| **C** | Supplier payment + POP upload UI, “Raise Invoice from SO”, Operations chain commercial view |
| **D** | Filters, notifications, polish, mobile |

## Apply migration

Paste `supabase/migrations/20260828_order_links_and_cascade.sql` into the Supabase SQL Editor and run. Safe to re-run.

## Visibility rules (non-negotiable)

| Data | BFF | Manufacturer | Customer |
|------|-----|--------------|----------|
| SO commercial | Full | None | Own only |
| PO commercial | Full | Own only | None |
| Production status + batches | Full | Full (own) | High-level + batches |
| Supplier payment + POP | Full | Received + POP if shared | None |
| Customer invoice | Full | None | Own only |

Never cascade price, margin, or internal notes.

## Acceptance (Phase A)

- [x] `order_links` table + unique active pair index
- [x] Cascade columns on SO/PO
- [x] `origin` on sales_orders
- [x] `supplier_payments` + `order_batches` tables
- [x] Link / unlink API with membership check + activity_log
- [ ] UI panels (Phase B+)
- [ ] Production form + cascade events (Phase B)
- [ ] Payment + invoice actions (Phase C)
