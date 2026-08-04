# Grok Build brief — Big Five Foods storefront (production)

See also: `docs/supplieradvisor-foods-storefront-brief.md`

## Live contracts

| Endpoint | Notes |
|----------|--------|
| `GET /store/big-five-foods` | Public catalog + multi-SKU `?products=a,b&intent=cart` |
| `GET /store/.../products/{externalRef}` | Deep links; unknown → store home |
| `GET /api/storefront/{slug}/products` | Stable JSON: `seller`, `storeUrl`, `updatedAt`, `products[]` with `externalRef` |
| `POST /api/storefront/{slug}/quotes` | Marketing body `{ name, email, organisation, phone, message, product, channel, source, ref }` |
| `POST /api/storefront/seed` | `x-storefront-seed-secret` |

## Production seed

```bash
curl -X POST https://www.supplieradvisor.com/api/storefront/seed \
  -H "x-storefront-seed-secret: $STOREFRONT_SEED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## SLA

Quote confirmation UI + email: **response within 1 business day**. Seller notified when Resend configured.
