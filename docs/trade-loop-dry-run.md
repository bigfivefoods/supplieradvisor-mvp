# First trade loop dry-run (production)

Use two companies (or founder multi-company): **Buyer A** and **Supplier B**.

Goal: prove catalogue-based PO → accept → deliver → rate on live.

## Prerequisites

- [ ] Both companies registered on [supplieradvisor.com](https://www.supplieradvisor.com)
- [ ] Network connection **accepted** (or SRM book with `linked_profile_id`)
- [ ] `CRON_SECRET` + Resend live (health `ok: true`)
- [ ] Supplier has at least one **sellable** product (`finished_good` / `service`) **or** an active **pricing agreement** with the buyer

## Steps

### 1. Supplier B — publish sellable catalogue

1. Switch company to **Supplier B**
2. Inventory → Products → add **Finished good** (SKU, sell price, UoM)
3. Optional: Connections → Pricing → create agreement with Buyer A and add lines
4. Confirm products show as active / sellable

### 2. Buyer A — connect and raise PO

1. Switch company to **Buyer A**
2. Suppliers → Discover/Invite → ensure B is linked
3. Suppliers → **Order** (`/dashboard/suppliers/po`)
4. Select supplier B — **Supplier catalogue** panel loads
5. Search catalogue → add line from finished goods or agreed list
6. Optional free-text line still works
7. Set promised date + currency → **Send standard PO** (not draft)

**Expect**

- PO appears in Buyer pipeline as `sent`
- Supplier receives Resend email (if configured)
- Supplier notification bell: “Inbound PO #… awaiting accept”

### 3. Supplier B — inbound inbox

1. Customers → **Inbound** (`/dashboard/customers/orders?tab=inbound`)
2. See PO with buyer name, lines, total
3. **Accept** (or Decline)

**Expect**

- Status → `accepted`
- Buyer receives “PO accepted” email (if Resend set)

### 4. Buyer A — delivery + trust

1. Suppliers → Order → pipeline
2. Record delivery / complete PO (OTIFEF fields)
3. Rate supplier (banner, ratings page, or notification)
4. Optional: Trust pack CSV export

### 5. Pass criteria

| Check | Pass |
|-------|------|
| Catalogue shows B’s products, not A’s inventory | ☐ |
| Unlinked supplier shows invite/connect guidance | ☐ |
| Currency change reloads prices on catalogue lines | ☐ |
| Free-text line still saves | ☐ |
| Inbound list shows buyer + accept/decline | ☐ |
| Notification for awaiting accept | ☐ |
| Email supplier on create (optional soft) | ☐ |
| Email buyer on accept (optional soft) | ☐ |
| Golden path first_trade can tick | ☐ |

## API smoke (optional)

```bash
# Buyer health
curl -sS "$APP_URL/api/system/health" | jq .ok

# Supplier catalogue (auth session / cookie required in browser)
# GET /api/suppliers/catalogue?companyId=BUYER&supplierId=SRM_ID&currency=ZAR

# Inbound as supplier
# GET /api/customers/purchase-orders?companyId=SUPPLIER&privyUserId=...
```

## Related

- `docs/production-ops-checklist.md`
- `docs/e2e-authenticated.md`
- PO create: `POST /api/suppliers/purchase-orders`
- Seller transitions: `PATCH /api/customers/purchase-orders`
