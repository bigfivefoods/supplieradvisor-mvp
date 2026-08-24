-- SUPERSEDED — use RUN_THIS_FOR_ORDER_CHAINS_COMPLETE.sql (same script, new name).
-- Run in the Supabase SQL editor (once is enough; everything is idempotent).
-- Order chains: customer → your products → supplier routing, SO↔PO links,
-- production cascade, and supplier lot / manufacture / expiry traceability.

-- ── Helpers ──────────────────────────────────────────────────────────────────
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

-- ── order_chain_setups (standing customer + products + supplier routes) ──────
CREATE TABLE IF NOT EXISTS public.order_chain_setups (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  name text,
  customer_id bigint,
  customer_name text,
  srm_supplier_id bigint,
  supplier_name text,
  product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('order_chain_setups', 'profile_id', 'bigint');
SELECT public.sa_add_column('order_chain_setups', 'name', 'text');
SELECT public.sa_add_column('order_chain_setups', 'customer_id', 'bigint');
SELECT public.sa_add_column('order_chain_setups', 'customer_name', 'text');
SELECT public.sa_add_column('order_chain_setups', 'srm_supplier_id', 'bigint');
SELECT public.sa_add_column('order_chain_setups', 'supplier_name', 'text');
SELECT public.sa_add_column('order_chain_setups', 'product_ids', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('order_chain_setups', 'status', 'text', '''active''');
SELECT public.sa_add_column('order_chain_setups', 'notes', 'text');
SELECT public.sa_add_column('order_chain_setups', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('order_chain_setups', 'created_by', 'text');
SELECT public.sa_add_column('order_chain_setups', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('order_chain_setups', 'updated_at', 'timestamptz', 'now()');

CREATE INDEX IF NOT EXISTS idx_order_chain_setups_profile
  ON public.order_chain_setups (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_order_chain_setups_customer
  ON public.order_chain_setups (profile_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_order_chain_setups_supplier
  ON public.order_chain_setups (profile_id, srm_supplier_id);

ALTER TABLE public.order_chain_setups ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='order_chain_setups' AND policyname='order_chain_setups_all'
  ) THEN
    CREATE POLICY order_chain_setups_all ON public.order_chain_setups
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'order_chain_setups policy skip: %', SQLERRM;
END $$;

-- ── order_links (SO ↔ manufacturer PO) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_links (
  id bigserial PRIMARY KEY,
  company_id bigint NOT NULL,
  source_order_id bigint NOT NULL,
  source_order_type text NOT NULL DEFAULT 'sales_order',
  target_order_id bigint NOT NULL,
  target_order_type text NOT NULL DEFAULT 'purchase_order',
  link_type text NOT NULL DEFAULT 'fulfillment',
  status text NOT NULL DEFAULT 'active',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  unlinked_by text,
  unlinked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('order_links', 'company_id', 'bigint');
SELECT public.sa_add_column('order_links', 'source_order_id', 'bigint');
SELECT public.sa_add_column('order_links', 'source_order_type', 'text', '''sales_order''');
SELECT public.sa_add_column('order_links', 'target_order_id', 'bigint');
SELECT public.sa_add_column('order_links', 'target_order_type', 'text', '''purchase_order''');
SELECT public.sa_add_column('order_links', 'link_type', 'text', '''fulfillment''');
SELECT public.sa_add_column('order_links', 'status', 'text', '''active''');
SELECT public.sa_add_column('order_links', 'notes', 'text');
SELECT public.sa_add_column('order_links', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('order_links', 'created_by', 'text');
SELECT public.sa_add_column('order_links', 'unlinked_by', 'text');
SELECT public.sa_add_column('order_links', 'unlinked_at', 'timestamptz');
SELECT public.sa_add_column('order_links', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('order_links', 'updated_at', 'timestamptz', 'now()');

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
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='order_links' AND policyname='order_links_all'
  ) THEN
    CREATE POLICY order_links_all ON public.order_links FOR ALL USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'order_links policy skip: %', SQLERRM;
END $$;

-- ── Production cascade on sales_orders ───────────────────────────────────────
SELECT public.sa_add_column('sales_orders', 'origin', 'text', '''customer_portal''');
SELECT public.sa_add_column('sales_orders', 'production_status', 'text');
SELECT public.sa_add_column('sales_orders', 'confirmed_qty', 'numeric(18,4)');
SELECT public.sa_add_column('sales_orders', 'actual_completion_date', 'date');
SELECT public.sa_add_column('sales_orders', 'cascade_updated_at', 'timestamptz');
SELECT public.sa_add_column('sales_orders', 'cascade_source', 'text');

-- ── Production cascade on purchase_orders ────────────────────────────────────
SELECT public.sa_add_column('purchase_orders', 'production_status', 'text');
SELECT public.sa_add_column('purchase_orders', 'confirmed_qty', 'numeric(18,4)');
SELECT public.sa_add_column('purchase_orders', 'actual_completion_date', 'date');
SELECT public.sa_add_column('purchase_orders', 'payment_status', 'text', '''unpaid''');
SELECT public.sa_add_column('purchase_orders', 'amount_paid', 'numeric(18,2)', '0');
SELECT public.sa_add_column('purchase_orders', 'cascade_updated_at', 'timestamptz');
SELECT public.sa_add_column('purchase_orders', 'source', 'text');
SELECT public.sa_add_column('purchase_orders', 'supplier_id', 'bigint');
SELECT public.sa_add_column('purchase_orders', 'supplier_name', 'text');

-- ── order_batches (lot + manufacture date + expiry) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.order_batches (
  id bigserial PRIMARY KEY,
  company_id bigint NOT NULL,
  order_id bigint NOT NULL,
  order_type text NOT NULL DEFAULT 'purchase_order',
  order_line_index int,
  batch_number text NOT NULL,
  qty numeric(18,4) NOT NULL DEFAULT 0,
  uom text DEFAULT 'ea',
  produced_at date,
  expiry_date date,
  manufacturer_profile_id bigint,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('order_batches', 'company_id', 'bigint');
SELECT public.sa_add_column('order_batches', 'order_id', 'bigint');
SELECT public.sa_add_column('order_batches', 'order_type', 'text', '''purchase_order''');
SELECT public.sa_add_column('order_batches', 'order_line_index', 'int');
SELECT public.sa_add_column('order_batches', 'batch_number', 'text');
SELECT public.sa_add_column('order_batches', 'qty', 'numeric(18,4)', '0');
SELECT public.sa_add_column('order_batches', 'uom', 'text', '''ea''');
SELECT public.sa_add_column('order_batches', 'produced_at', 'date');
SELECT public.sa_add_column('order_batches', 'expiry_date', 'date');
SELECT public.sa_add_column('order_batches', 'manufacturer_profile_id', 'bigint');
SELECT public.sa_add_column('order_batches', 'notes', 'text');
SELECT public.sa_add_column('order_batches', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('order_batches', 'created_by', 'text');
SELECT public.sa_add_column('order_batches', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('order_batches', 'updated_at', 'timestamptz', 'now()');

SELECT public.sa_create_index('idx_order_batches_order', 'order_batches', 'order_id, order_type');
SELECT public.sa_create_index('idx_order_batches_company', 'order_batches', 'company_id');
SELECT public.sa_create_index('idx_order_batches_batch', 'order_batches', 'batch_number');

ALTER TABLE public.order_batches ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='order_batches' AND policyname='order_batches_all'
  ) THEN
    CREATE POLICY order_batches_all ON public.order_batches FOR ALL USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'order_batches policy skip: %', SQLERRM;
END $$;

-- ── supplier_payments (optional POP on a manufacturer PO) ────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id bigserial PRIMARY KEY,
  company_id bigint NOT NULL,
  po_id bigint NOT NULL,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  reference text,
  method text,
  status text NOT NULL DEFAULT 'recorded',
  pop_document_id text,
  pop_url text,
  share_with_supplier boolean NOT NULL DEFAULT false,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('supplier_payments', 'company_id', 'bigint');
SELECT public.sa_add_column('supplier_payments', 'po_id', 'bigint');
SELECT public.sa_add_column('supplier_payments', 'amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('supplier_payments', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('supplier_payments', 'payment_date', 'date', 'CURRENT_DATE');
SELECT public.sa_add_column('supplier_payments', 'reference', 'text');
SELECT public.sa_add_column('supplier_payments', 'method', 'text');
SELECT public.sa_add_column('supplier_payments', 'status', 'text', '''recorded''');
SELECT public.sa_add_column('supplier_payments', 'pop_document_id', 'text');
SELECT public.sa_add_column('supplier_payments', 'pop_url', 'text');
SELECT public.sa_add_column('supplier_payments', 'share_with_supplier', 'boolean', 'false');
SELECT public.sa_add_column('supplier_payments', 'notes', 'text');
SELECT public.sa_add_column('supplier_payments', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('supplier_payments', 'created_by', 'text');
SELECT public.sa_add_column('supplier_payments', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('supplier_payments', 'updated_at', 'timestamptz', 'now()');

SELECT public.sa_create_index('idx_supplier_payments_po', 'supplier_payments', 'po_id');
SELECT public.sa_create_index('idx_supplier_payments_company', 'supplier_payments', 'company_id');
SELECT public.sa_create_index('idx_supplier_payments_status', 'supplier_payments', 'company_id, status');

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='supplier_payments' AND policyname='supplier_payments_all'
  ) THEN
    CREATE POLICY supplier_payments_all ON public.supplier_payments FOR ALL USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'supplier_payments policy skip: %', SQLERRM;
END $$;

SELECT public.sa_add_column('manufacturing_production_orders', 'purchase_order_id', 'bigint');
SELECT public.sa_create_index('idx_mfg_po_purchase_order', 'manufacturing_production_orders', 'purchase_order_id');
SELECT public.sa_add_column('customer_invoices', 'source_order_id', 'bigint');

DO $$
BEGIN
  UPDATE public.customer_invoices
  SET source_order_id = order_id
  WHERE source_order_id IS NULL AND order_id IS NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'customer_invoices source_order_id backfill skip: %', SQLERRM;
END $$;

-- Confirm the tables/columns the app now writes.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'order_chain_setups',
    'order_links',
    'order_batches',
    'supplier_payments'
  )
ORDER BY table_name, ordinal_position;

SELECT 'order_chains_ok' AS status;
