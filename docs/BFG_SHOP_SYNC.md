# bigfivegroup.africa shop → SupplierAdvisor® sync (receiver)

Receiving side of sync contract v1.0. The shop (bigfivegroup-africa PR #213) POSTs signed events to
`POST /api/webhooks/bfg-shop-sync`. Everything is scoped to profile 102 (Big Five Group).

**Status: OFF by default.** Nothing happens until the migrations are applied (by a human, after review)
and the environment variables below are set.

## Environment variables (not set by this change)

| Variable | Purpose |
| --- | --- |
| `BFG_SYNC_ENABLED` | Feature flag. Must equal `true` to accept events. Anything else → `503 unavailable`. |
| `BFG_SYNC_SIGNING_SECRET` | Shared HMAC secret (same value as the shop's). Missing → refuses with `503`. |
| `BFG_SYNC_PROFILE_ID` | Must be `102`. Any other value → refuses with `503`. |
| `BFG_SHOP_CALLBACK_URL` | Shop endpoint for `invoice.payment_recorded` flow-back (https only). Unset → no flow-back. |
| `BFG_SYNC_BANK_ACCOUNT_ID` | Optional. Bank account for Paystack receipts; otherwise the single bank account of profile 102. |

## Signature

`x-bfg-signature: v1=hex(HMAC_SHA256(secret, "bfg-shop-sync.v1." + ts + "." + rawBody))`, compared in
constant time. The signature is verified before the ±300 s timestamp window is checked.

## Write paths

No ad-hoc ledger writes. The receiver uses CRM customers, `syncCrmInvoiceToBooks` (including its
void branch, which calls `reverseInvoiceBooks`), `recordArPayment` and `settleInvoicePayment`.
A paid invoice is never voided (`409 void_after_paid`, permanent).

## Migrations (files only, NOT applied)

- `supabase/migrations/20261110_bfg_shop_sync.sql`: idempotency + callback outbox tables, partial unique
  indexes on shop order/customer/payment references.
- `supabase/migrations/20261110_bfg_shop_product_map.sql`: DATA change that adds `shop_product_id` to
  `products.metadata` for profile 102. Needs explicit approval before running.

## Flow-back

`recordArPayment` calls `afterArPaymentRecorded` (only when the flag is on). Payments created by
`bfg_shop_sync` are skipped (loop guard). Failed deliveries retry from an outbox via
`/api/cron/bfg-shop-callbacks` (cron-secret protected). That route is **not** scheduled in `vercel.json`.

## Rollout order

1. Review + merge. 2. Apply the schema migration. 3. Review and apply the product map. 4. Set the env vars.
5. Schedule the callbacks cron if wanted. 6. Send a `dry_run` event from the shop. 7. Turn the flag on.
