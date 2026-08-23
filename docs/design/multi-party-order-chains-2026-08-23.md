# Multi-Party Order Chains + Commercial Close-the-Loop

**Status:** Phase A + B + C on branch `feature/multi-party-order-chains`  
**Date:** 23 August 2026  
**Repo:** bigfivefoods/supplieradvisor-mvp

## Goal

BFF middleman loop: SO ↔ optional linked PO → production cascade → pay manufacturer (POP) → invoice customer, with Operations chain visibility.

## Phase A — Foundation
- Migration `20260828_order_links_and_cascade.sql`
- Links, cascade fields, batches, supplier_payments tables
- `/api/orders/links`, `/cascade`, `/production-status`

## Phase B — Automation & production
- `/api/orders/raise-linked-po`, `/api/orders/batches`
- `LinkedOrdersPanel`, `ProductionStatusForm`

## Phase C — Commercial close (this commit)

### APIs
| Endpoint | Purpose |
|----------|---------|
| `GET/POST /api/orders/supplier-payments` | Record payment + update PO `payment_status` / `amount_paid` |
| `POST /api/orders/raise-invoice-from-so` | Invoice from SO + `source_order_id` |
| `GET /api/orders/chains` | Linked chains with cost vs revenue (BFF only) |

POP files reuse existing `POST /api/buyer/payment-proof`.

### UI
| Component / page | Role |
|------------------|------|
| `components/orders/SupplierPaymentForm.tsx` | Amount, ref, method, POP upload, share-with-supplier |
| `components/orders/RaiseInvoiceFromSo.tsx` | One-click invoice from SO |
| `components/orders/OrderChainCard.tsx` | Chain commercial snapshot card |
| `app/dashboard/operations/chains/page.tsx` | Operations tower chains list |

### Wire-up on PO detail (BFF)
```tsx
<SupplierPaymentForm
  companyId={companyId}
  privyUserId={privyUserId}
  poId={po.id}
  poTotal={po.total_amount}
  amountAlreadyPaid={po.amount_paid}
  currency={po.currency}
/>
```

### Wire-up on SO detail
```tsx
<RaiseInvoiceFromSo
  companyId={companyId}
  privyUserId={privyUserId}
  salesOrderId={so.id}
  orderNumber={so.order_number}
  alreadyInvoiced={Boolean(so.invoice_id)}
/>
```

## Apply migration
Run `supabase/migrations/20260828_order_links_and_cascade.sql` in SQL Editor before using Phase C tables.

## Visibility
- Cost / margin / supplier payment details: **BFF only**
- Customer never sees what was paid to Kelpack
- POP shared with supplier only when `share_with_supplier: true`

## Phase D (polish)
Filters polish, notifications, empty states, mobile, edge cases, preferred-supplier auto-select on raise-linked-PO.
