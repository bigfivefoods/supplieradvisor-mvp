-- bigfivegroup.africa shop -> SupplierAdvisor® sync (contract v1.0).
-- AWAITING APPROVAL. NOT APPLIED. Do not apply this file to the production
-- Supabase project (onkklullmgrdqoertngp) until it has been reviewed and
-- Craig has approved it. The endpoint stays OFF (BFG_SYNC_ENABLED) until then.
--
-- Additive only: two new tables and four partial unique indexes.
-- No existing column, row or policy is changed.

-- 1. Idempotency store, keyed (profile_id, idempotency_key).
--    A processed key returns the stored response (contract 2.4).
CREATE TABLE IF NOT EXISTS public.bfg_shop_sync_events (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  idempotency_key text NOT NULL,
  event text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'done')),
  fingerprint text,            -- order.placed: subtotal:vat:total in cents (totals_changed guard)
  http_status integer,
  response jsonb,              -- success body only; no personal data
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, idempotency_key)
);

-- 2. Flow-back outbox: payments recorded in SupplierAdvisor® that the shop must hear about
--    (contract 7). Retried with backoff, dead after 8 attempts.
CREATE TABLE IF NOT EXISTS public.bfg_shop_sync_callbacks (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  idempotency_key text NOT NULL,
  body text NOT NULL,          -- JSON, re-signed with a fresh timestamp on every attempt
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'dead')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,             -- error code only
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_bfg_shop_sync_callbacks_due
  ON public.bfg_shop_sync_callbacks (status, next_attempt_at);

-- Service role only: row security on, no policies, so anon and authenticated
-- roles see nothing. The sync code runs with the service role.
ALTER TABLE public.bfg_shop_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfg_shop_sync_callbacks ENABLE ROW LEVEL SECURITY;

-- 3. Keys of record (contract 8.3): one invoice / sales order per shop order
--    reference, one customer per shop customer, one sync payment per
--    (invoice, reference). Partial, so they touch only rows the sync writes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_invoices_shop_order_ref
  ON public.customer_invoices ((metadata ->> 'shop_order_ref'))
  WHERE profile_id = 102 AND (metadata ->> 'shop_order_ref') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_orders_shop_order_ref
  ON public.sales_orders ((metadata ->> 'shop_order_ref'))
  WHERE profile_id = 102 AND (metadata ->> 'shop_order_ref') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_shop_customer_id
  ON public.customers ((metadata ->> 'shop_customer_id'))
  WHERE profile_id = 102 AND (metadata ->> 'shop_customer_id') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ar_payments_bfg_shop_sync_reference
  ON public.customer_invoice_payments (invoice_id, reference)
  WHERE created_by = 'bfg_shop_sync' AND reference IS NOT NULL;
