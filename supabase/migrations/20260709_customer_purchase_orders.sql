-- Customer-portal purchase orders bridge columns
-- Safe / idempotent for Supabase SQL Editor
-- PR 7: seller_customer_id, source, total_amount (+ dual supplier ids)

-- ---------------------------------------------------------------------------
-- Helpers (same signatures as world_class / customer_platform_invites)
-- DROP first: CREATE OR REPLACE cannot rename parameters on existing helpers
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sa_add_column(text, text, text, text);
DROP FUNCTION IF EXISTS public.sa_add_column(text, text, text);
DROP FUNCTION IF EXISTS public.sa_create_index(text, text, text);
DROP FUNCTION IF EXISTS public.sa_create_index(text, text, text[]);

CREATE OR REPLACE FUNCTION public.sa_add_column(p_table text, p_column text, p_type text, p_default text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = p_column
  ) THEN
    IF p_default IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', p_table, p_column, p_type);
    ELSE
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN %I %s DEFAULT %s',
        p_table, p_column, p_type, p_default
      );
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sa_add_column %.% skip: %', p_table, p_column, SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_create_index(
  p_name text, p_table text, p_columns text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  col text;
  cols text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) THEN
    RETURN;
  END IF;

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

-- ---------------------------------------------------------------------------
-- Ensure purchase_orders exists (minimal greenfield shell)
-- Live DBs already have this table with supplier_id / total_amount / etc.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Compat columns used by suppliers/po + world_class + customer portal
SELECT public.sa_add_column('purchase_orders', 'buyer_profile_id', 'bigint');
SELECT public.sa_add_column('purchase_orders', 'supplier_profile_id', 'bigint');
SELECT public.sa_add_column('purchase_orders', 'supplier_id', 'bigint'); -- legacy dual-write
SELECT public.sa_add_column('purchase_orders', 'description', 'text');
SELECT public.sa_add_column('purchase_orders', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('purchase_orders', 'subtotal', 'numeric(18,2)', '0');
-- Live suppliers/po already writes total_amount; greenfield must get it via sa_add_column
SELECT public.sa_add_column('purchase_orders', 'total_amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('purchase_orders', 'tax_amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('purchase_orders', 'shipping_amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('purchase_orders', 'discount_amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('purchase_orders', 'items', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('purchase_orders', 'status', 'text', '''draft''');
SELECT public.sa_add_column('purchase_orders', 'payment_terms', 'text');
SELECT public.sa_add_column('purchase_orders', 'incoterms', 'text');
SELECT public.sa_add_column('purchase_orders', 'promised_date', 'date');
SELECT public.sa_add_column('purchase_orders', 'closed_at', 'timestamptz');
SELECT public.sa_add_column('purchase_orders', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('purchase_orders', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('purchase_orders', 'updated_at', 'timestamptz', 'now()');

-- Customer-portal bridge
SELECT public.sa_add_column('purchase_orders', 'seller_customer_id', 'bigint');
SELECT public.sa_add_column('purchase_orders', 'source', 'text'); -- e.g. customer_portal

-- Backfill dual supplier ids when only one side is set
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'supplier_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'supplier_profile_id'
  ) THEN
    UPDATE public.purchase_orders
    SET supplier_profile_id = supplier_id
    WHERE supplier_profile_id IS NULL AND supplier_id IS NOT NULL;

    UPDATE public.purchase_orders
    SET supplier_id = supplier_profile_id
    WHERE supplier_id IS NULL AND supplier_profile_id IS NOT NULL;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'PO supplier dual-id backfill skip: %', SQLERRM;
END $$;

-- Keep total_amount and subtotal aligned when one is zero/null
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'total_amount'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'subtotal'
  ) THEN
    UPDATE public.purchase_orders
    SET total_amount = subtotal
    WHERE (total_amount IS NULL OR total_amount = 0)
      AND subtotal IS NOT NULL AND subtotal <> 0;

    UPDATE public.purchase_orders
    SET subtotal = total_amount
    WHERE (subtotal IS NULL OR subtotal = 0)
      AND total_amount IS NOT NULL AND total_amount <> 0;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'PO amount backfill skip: %', SQLERRM;
END $$;

-- Indexes
SELECT public.sa_create_index('idx_po_buyer', 'purchase_orders', 'buyer_profile_id');
SELECT public.sa_create_index('idx_po_supplier', 'purchase_orders', 'supplier_profile_id');
SELECT public.sa_create_index('idx_po_supplier_id', 'purchase_orders', 'supplier_id');
SELECT public.sa_create_index('idx_po_status', 'purchase_orders', 'status');
SELECT public.sa_create_index('idx_po_seller_customer', 'purchase_orders', 'seller_customer_id');
SELECT public.sa_create_index('idx_po_source', 'purchase_orders', 'source');

-- Optional FK (soft; SET NULL on delete)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customers'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'seller_customer_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'purchase_orders_seller_customer_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.purchase_orders
        ADD CONSTRAINT purchase_orders_seller_customer_id_fkey
        FOREIGN KEY (seller_customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'FK purchase_orders_seller_customer_id_fkey skip: %', SQLERRM;
    END;
  END IF;
END $$;

-- Transitional open RLS (same pattern as other CRM tables)
DO $$
BEGIN
  ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'RLS enable purchase_orders skip: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'purchase_orders' AND policyname = 'purchase_orders_all'
  ) THEN
    CREATE POLICY purchase_orders_all ON public.purchase_orders FOR ALL USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'policy purchase_orders_all skip: %', SQLERRM;
END $$;
