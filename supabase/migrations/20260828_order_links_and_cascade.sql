-- Multi-party order chains foundation (Phase A)
-- Safe / idempotent. Supports optional SO ↔ PO linking, production cascade fields,
-- internal SO origin, supplier payments + POP, and batch/lot capture.

-- ── Helpers (idempotent) ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sa_add_column(p_table text, p_column text, p_type text, p_default text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=p_table
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=p_table AND column_name=p_column
  ) THEN
    IF p_default IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', p_table, p_column, p_type);
    ELSE
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s DEFAULT %s', p_table, p_column, p_type, p_default);
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sa_add_column %.% skip: %', p_table, p_column, SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_create_index(p_name text, p_table text, p_columns text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  col text;
  cols text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) THEN RETURN; END IF;
  cols := string_to_array(replace(p_columns, ' ', ''), ',');
  FOREACH col IN ARRAY cols LOOP
    IF col IS NULL OR col = '' THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = p_table AND column_name = col
    ) THEN
      RAISE NOTICE 'Index % skipped: missing %.%', p_name, p_table, col;
      RETURN;
    END IF;
  END LOOP;
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)', p_name, p_table, p_columns);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Index % skipped: %', p_name, SQLERRM;
END;
$$;

-- ── order_links (optional SO ↔ PO relationship) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_links (
  id bigserial PRIMARY KEY,
  company_id bigint NOT NULL,          -- BFF (or any middleman) profile_id
  source_order_id bigint NOT NULL,     -- usually sales_orders.id
  source_order_type text NOT NULL DEFAULT 'sales_order',
    -- sales_order | purchase_order (future-proof)
  target_order_id bigint NOT NULL,     -- usually purchase_orders.id
  target_order_type text NOT NULL DEFAULT 'purchase_order',
  link_type text NOT NULL DEFAULT 'fulfillment',
    -- fulfillment | production | dropship
  status text NOT NULL DEFAULT 'active',
    -- active | unlinked
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  unlinked_by text,
  unlinked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique active link per pair (allow historical unlinked rows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_order_links_active_pair'
  ) THEN
    CREATE UNIQUE INDEX uq_order_links_active_pair
      ON public.order_links (company_id, source_order_id, target_order_id)
      WHERE status = 'active';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'uq_order_links_active_pair skip: %', SQLERRM;
END $$;

SELECT public.sa_create_index('idx_order_links_company', 'order_links', 'company_id');
SELECT public.sa_create_index('idx_order_links_source', 'order_links', 'source_order_id');
SELECT public.sa_create_index('idx_order_links_target', 'order_links', 'target_order_id');
SELECT public.sa_create_index('idx_order_links_status', 'order_links', 'company_id, status');

ALTER TABLE public.order_links ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_links' AND policyname='order_links_all'
  ) THEN
    CREATE POLICY order_links_all ON public.order_links FOR ALL USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'order_links policy skip: %', SQLERRM;
END $$;

-- ── Cascade / production fields on sales_orders ──────────────────────────────
SELECT public.sa_add_column('sales_orders', 'origin', 'text', '''customer_portal''');
  -- customer_portal | internal | api | import
SELECT public.sa_add_column('sales_orders', 'production_status', 'text');
  -- null | released | in_progress | completed | on_hold | cancelled
SELECT public.sa_add_column('sales_orders', 'confirmed_qty', 'numeric(18,4)');
SELECT public.sa_add_column('sales_orders', 'actual_completion_date', 'date');
SELECT public.sa_add_column('sales_orders', 'cascade_updated_at', 'timestamptz');
SELECT public.sa_add_column('sales_orders', 'cascade_source', 'text');
  -- e.g. purchase_order:123

-- ── Cascade / production fields on purchase_orders ───────────────────────────
SELECT public.sa_add_column('purchase_orders', 'production_status', 'text');
  -- null | released | in_progress | completed | on_hold | cancelled
SELECT public.sa_add_column('purchase_orders', 'confirmed_qty', 'numeric(18,4)');
SELECT public.sa_add_column('purchase_orders', 'actual_completion_date', 'date');
SELECT public.sa_add_column('purchase_orders', 'payment_status', 'text', '''unpaid''');
  -- unpaid | partial | paid
SELECT public.sa_add_column('purchase_orders', 'amount_paid', 'numeric(18,2)', '0');
SELECT public.sa_add_column('purchase_orders', 'cascade_updated_at', 'timestamptz');

-- ── order_batches (lot/batch numbers captured by manufacturer) ───────────────
CREATE TABLE IF NOT EXISTS public.order_batches (
  id bigserial PRIMARY KEY,
  company_id bigint NOT NULL,           -- owner of the record (usually BFF or manufacturer)
  order_id bigint NOT NULL,             -- PO or SO id
  order_type text NOT NULL DEFAULT 'purchase_order',
    -- purchase_order | sales_order
  order_line_index int,                 -- optional index into items jsonb
  batch_number text NOT NULL,
  qty numeric(18,4) NOT NULL DEFAULT 0,
  uom text DEFAULT 'ea',
  produced_at date,
  manufacturer_profile_id bigint,       -- Kelpack profile when known
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_create_index('idx_order_batches_order', 'order_batches', 'order_id, order_type');
SELECT public.sa_create_index('idx_order_batches_company', 'order_batches', 'company_id');
SELECT public.sa_create_index('idx_order_batches_batch', 'order_batches', 'batch_number');

ALTER TABLE public.order_batches ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_batches' AND policyname='order_batches_all'
  ) THEN
    CREATE POLICY order_batches_all ON public.order_batches FOR ALL USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'order_batches policy skip: %', SQLERRM;
END $$;

-- ── supplier_payments (BFF → Kelpack payment + POP) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id bigserial PRIMARY KEY,
  company_id bigint NOT NULL,           -- payer (BFF)
  po_id bigint NOT NULL,                -- purchase_orders.id
  amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  reference text,
  method text,                          -- eft | cash | card | other
  status text NOT NULL DEFAULT 'recorded',
    -- pending | recorded | confirmed | void
  pop_document_id text,                 -- storage path / document id
  pop_url text,
  share_with_supplier boolean NOT NULL DEFAULT false,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_create_index('idx_supplier_payments_po', 'supplier_payments', 'po_id');
SELECT public.sa_create_index('idx_supplier_payments_company', 'supplier_payments', 'company_id');
SELECT public.sa_create_index('idx_supplier_payments_status', 'supplier_payments', 'company_id, status');

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_payments' AND policyname='supplier_payments_all'
  ) THEN
    CREATE POLICY supplier_payments_all ON public.supplier_payments FOR ALL USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'supplier_payments policy skip: %', SQLERRM;
END $$;

-- ── Link production_orders to purchase_orders (optional convenience) ─────────
SELECT public.sa_add_column('manufacturing_production_orders', 'purchase_order_id', 'bigint');
SELECT public.sa_create_index('idx_mfg_po_purchase_order', 'manufacturing_production_orders', 'purchase_order_id');

-- ── customer_invoices already has order_id; ensure source clarity ────────────
SELECT public.sa_add_column('customer_invoices', 'source_order_id', 'bigint');
-- Backfill from order_id when present
DO $$
BEGIN
  UPDATE public.customer_invoices
  SET source_order_id = order_id
  WHERE source_order_id IS NULL AND order_id IS NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'customer_invoices source_order_id backfill skip: %', SQLERRM;
END $$;

-- Done marker
SELECT '20260828_order_links_and_cascade applied' AS status;
