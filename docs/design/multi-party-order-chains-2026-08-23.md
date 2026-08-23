# Multi-Party Order Chains + Commercial Close-the-Loop

**Status:** Phase A + Phase B on branch `feature/multi-party-order-chains`  
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

## Phase A (shipped)

### Schema (`supabase/migrations/20260828_order_links_and_cascade.sql`)

- `order_links`, cascade columns, `origin`, `order_batches`, `supplier_payments`, etc.

### APIs

- `GET/POST/DELETE /api/orders/links`
- `POST /api/orders/cascade`
- `POST /api/orders/production-status`

### Lib

- `lib/orders/order-links.ts`, `lib/orders/cascade.ts`

## Phase B (this commit)

### APIs

| Endpoint | Purpose |
|----------|---------|
| `POST /api/orders/raise-linked-po` | One-click SO → PO (draft or sent) + `order_links` |
| `GET/POST /api/orders/batches` | List / add batch numbers |

### UI components (drop into existing detail pages)

| Component | Use |
|-----------|-----|
| `components/orders/LinkedOrdersPanel.tsx` | SO/PO detail — show links, raise linked PO, link existing, unlink |
| `components/orders/ProductionStatusForm.tsx` | Supplier portal or PO detail — status, qty, dates, multi-batch, cascade toggle |

### Lib

- `lib/orders/map-so-to-po-items.ts` — map CRM SO lines → SRM PO lines (prices not copied by default)

### Wire-up examples

**On sales order detail (BFF):**

```tsx
import LinkedOrdersPanel from '@/components/orders/LinkedOrdersPanel';

<LinkedOrdersPanel
  companyId={companyId}
  privyUserId={privyUserId}
  orderId={so.id}
  orderType="sales_order"
  defaultSrmSupplierId={preferredKelpackSrmId} // or defaultSupplierProfileId
/>
```

**On PO detail / supplier portal:**

```tsx
import ProductionStatusForm from '@/components/orders/ProductionStatusForm';
import LinkedOrdersPanel from '@/components/orders/LinkedOrdersPanel';

<ProductionStatusForm
  companyId={companyId}
  privyUserId={privyUserId}
  poId={po.id}
  buyerCompanyId={po.buyer_profile_id} // when manufacturer is updating
  initialStatus={po.production_status}
/>

<LinkedOrdersPanel
  companyId={buyerCompanyId}
  privyUserId={privyUserId}
  orderId={po.id}
  orderType="purchase_order"
/>
```

## Apply migration

Paste `supabase/migrations/20260828_order_links_and_cascade.sql` into Supabase SQL Editor and run.

## Phase C (next)

- Supplier payment recording + POP upload UI
- “Raise Invoice from SO” (already partly exists as `convert_to_invoice` on `/api/customers/docs`)
- Operations tower chain commercial view + cost vs revenue

## Visibility rules (non-negotiable)

Never cascade price, margin, or internal notes. Customer sees high-level production status + batches only.
