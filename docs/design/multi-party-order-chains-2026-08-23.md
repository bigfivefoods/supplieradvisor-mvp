# Multi-Party Order Chains + Commercial Close-the-Loop

**Status:** Phases A–D complete on branch `feature/multi-party-order-chains`  
**Date:** 23 August 2026  
**Repo:** bigfivefoods/supplieradvisor-mvp

## Goal

BFF middleman loop: SO ↔ optional linked PO → production cascade → pay manufacturer (POP) → invoice customer, with Operations chain visibility.

---

## Phase A — Foundation
- Migration `20260828_order_links_and_cascade.sql`
- `/api/orders/links`, `/cascade`, `/production-status`
- `lib/orders/order-links.ts`, `cascade.ts`

## Phase B — Automation & production
- `/api/orders/raise-linked-po`, `/api/orders/batches`
- `LinkedOrdersPanel`, `ProductionStatusForm`

## Phase C — Commercial close
- `/api/orders/supplier-payments`, `/raise-invoice-from-so`, `/chains`
- `SupplierPaymentForm`, `RaiseInvoiceFromSo`, `OrderChainCard`
- `/dashboard/operations/chains`

## Phase D — Polish (this commit)

| Item | Detail |
|------|--------|
| Preferred supplier | `lib/orders/preferred-supplier.ts` — SO metadata → company settings → sole SRM book entry |
| Auto on raise | `raise-linked-po` resolves manufacturer when none passed; returns `preferredSource` |
| Duplicate link guard | 409 `ALREADY_LINKED` unless `allowMultipleLinks: true` |
| Chain notifications | `lib/orders/notify-chain.ts` — BFF + customer-safe production alerts |
| Void payment | `PATCH /api/orders/supplier-payments` `{ action: 'void', paymentId }` + recompute totals |
| Supplier picker UI | `LinkedOrdersPanel` loads SRM book, empty state, mobile padding |
| Production notes | Merged into PO metadata (no overwrite of commercial description) |

### Company preferred manufacturer (settings example)

On `profiles.settings`:

```json
{
  "preferred_srm_supplier_id": 12,
  "preferred_supplier_profile_id": 45
}
```

Or per SO in `sales_orders.metadata`:

```json
{
  "preferred_srm_supplier_id": 12
}
```

---

## Apply migration

Run in Supabase SQL Editor:

`supabase/migrations/20260828_order_links_and_cascade.sql`

## Visibility (non-negotiable)

- Cost / margin / supplier payments: **BFF only**
- Customer: high-level production labels + batches only
- POP shared with supplier only when `share_with_supplier: true`

## Suggested next steps

1. Apply migration
2. Open PR from `feature/multi-party-order-chains` → `main`
3. Mount panels on SO/PO detail pages
4. Set BFF preferred manufacturer in company settings (Kelpack)
