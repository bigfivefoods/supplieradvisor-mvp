-- Shared commercial documents: visibility flags for buyer server-side reads
-- Safe / idempotent for Supabase SQL Editor
-- Depends on CRM tables from 20260709_crm_sales_lifecycle.sql
-- buyer_profile_id / shared_at only on contracts (design PR 5)

-- Helpers (same pattern as customer_platform_invites; CREATE OR REPLACE is fine for body-only changes)
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
-- Quotes / sales orders / invoices: visibility attribute (not a security boundary)
-- seller_only (default) | shared
-- Buyer reads only via GET /api/buyer/documents after membership + connection checks
-- ---------------------------------------------------------------------------
SELECT public.sa_add_column('customer_quotes', 'visibility', 'text', '''seller_only''');
SELECT public.sa_add_column('sales_orders', 'visibility', 'text', '''seller_only''');
SELECT public.sa_add_column('customer_invoices', 'visibility', 'text', '''seller_only''');

-- ---------------------------------------------------------------------------
-- Contracts: explicit share flag + buyer profile snapshot when shared
-- ---------------------------------------------------------------------------
SELECT public.sa_add_column('customer_contracts', 'shared_with_buyer', 'boolean', 'false');
SELECT public.sa_add_column('customer_contracts', 'buyer_profile_id', 'bigint');
SELECT public.sa_add_column('customer_contracts', 'shared_at', 'timestamptz');

-- Lookup indexes for seller filter + buyer shared-doc queries
SELECT public.sa_create_index('idx_customer_quotes_profile_visibility', 'customer_quotes', 'profile_id, visibility');
SELECT public.sa_create_index('idx_sales_orders_profile_visibility', 'sales_orders', 'profile_id, visibility');
SELECT public.sa_create_index('idx_customer_invoices_profile_visibility', 'customer_invoices', 'profile_id, visibility');
SELECT public.sa_create_index('idx_customer_contracts_profile_shared', 'customer_contracts', 'profile_id, shared_with_buyer');
SELECT public.sa_create_index('idx_customer_contracts_buyer_profile', 'customer_contracts', 'buyer_profile_id');
