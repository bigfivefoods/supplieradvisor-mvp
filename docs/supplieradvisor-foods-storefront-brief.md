# SupplierAdvisor® storefront — Big Five Foods (Phase 2)

Source brief for online ordering of Big Five Foods products via SupplierAdvisor.

## Live routes

| Route | Purpose |
|-------|---------|
| `/store/big-five-foods` | Public catalog |
| `/store/{companySlug}` | Multi-tenant store home |
| `/store/{companySlug}/products/{sku\|externalRef}` | Product detail |
| `/api/storefront/{slug}/products` | Public JSON catalog |
| `/api/storefront/{slug}/products/{key}` | Product JSON |
| `/api/storefront/{slug}/quotes` | Quote request (NSNP / institutional) |
| `/api/storefront/seed` | Seed Big Five Foods profile + SKUs |

## Deep-link params (from bigfivegroup.africa)

`source`, `ref`, `product`, `sku`, `name`, `channel` (`retail` \| `wholesale` \| `institutional`)

Missing product → store home (not hard 404).

## Onboarding

`/onboarding?type=business&partner=big-five-foods&intent=order&source=...&product=...`

After registration → redirect to `/store/big-five-foods` (or product).

## Login return

`/login?next=/store/big-five-foods?...` returns to store after auth.

## Seed

```bash
# Local / non-prod: authenticated user
curl -X POST http://localhost:3000/api/storefront/seed

# Production: set STOREFRONT_SEED_SECRET
curl -X POST https://www.supplieradvisor.com/api/storefront/seed \
  -H "x-storefront-seed-secret: $STOREFRONT_SEED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Sets `profiles.metadata.store_slug = big-five-foods` and upserts SKUs with `metadata.externalRef`.

## Architecture

- Marketing site discovers; **SA is system of record** for catalog, quotes, orders.
- NSNP SKUs are **quote-first** (no false instant checkout).
- Seller workspace sees quotes under **Customers → Quotes**.

## Acceptance checklist

1. `/store/big-five-foods` lists products  
2. `/store/big-five-foods/products/porridge-chocolate?source=bigfivegroup.africa&ref=foods-sales-portal` opens product  
3. Onboarding partner handoff lands on store  
4. Quote request creates seller `customer_quotes` row  
5. Login `next=/store/...` returns to store  
