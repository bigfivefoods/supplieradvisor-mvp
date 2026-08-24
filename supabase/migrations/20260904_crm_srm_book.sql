-- UPDATED 2026-08-24 — run THIS file in the Supabase SQL editor.
-- Filename: RUN_THIS_FOR_CRM_SRM_BOOK.sql
-- Aligns CRM customers + SRM suppliers book columns (geo + VAT/reg/terms)
-- and adds hot-path indexes. Safe to run more than once.
-- Also in docs/RUN_THIS_FOR_CRM_SRM_BOOK.sql

CREATE OR REPLACE FUNCTION public.sa_add_column(p_table text, p_column text, p_type text, p_default text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
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
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s DEFAULT %s', p_table, p_column, p_type, p_default);
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sa_add_column %.% skip: %', p_table, p_column, SQLERRM;
END;
$$;

-- CRM book — same geo fields as SRM / portal Profile
SELECT public.sa_add_column('customers', 'continent', 'text');
SELECT public.sa_add_column('customers', 'province', 'text');
SELECT public.sa_add_column('customers', 'region', 'text');
SELECT public.sa_add_column('customers', 'city', 'text');
SELECT public.sa_add_column('customers', 'country', 'text');
SELECT public.sa_add_column('customers', 'vat_number', 'text');
SELECT public.sa_add_column('customers', 'registration_number', 'text');
SELECT public.sa_add_column('customers', 'payment_terms', 'text');
SELECT public.sa_add_column('customers', 'logo_url', 'text');

-- SRM book — portal Profile commercial fields
SELECT public.sa_add_column('srm_suppliers', 'continent', 'text');
SELECT public.sa_add_column('srm_suppliers', 'province', 'text');
SELECT public.sa_add_column('srm_suppliers', 'region', 'text');
SELECT public.sa_add_column('srm_suppliers', 'vat_number', 'text');
SELECT public.sa_add_column('srm_suppliers', 'registration_number', 'text');
SELECT public.sa_add_column('srm_suppliers', 'payment_terms', 'text');
SELECT public.sa_add_column('srm_suppliers', 'logo_url', 'text');

-- Keep region in step with province when province is set
DO $$
BEGIN
  UPDATE public.customers
  SET region = province
  WHERE (region IS NULL OR btrim(region) = '')
    AND province IS NOT NULL AND btrim(province) <> '';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'customers region backfill skip: %', SQLERRM;
END $$;

DO $$
BEGIN
  UPDATE public.srm_suppliers
  SET region = province
  WHERE (region IS NULL OR btrim(region) = '')
    AND province IS NOT NULL AND btrim(province) <> '';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'srm_suppliers region backfill skip: %', SQLERRM;
END $$;

-- Hot-path indexes (list + search + portal lookup)
CREATE INDEX IF NOT EXISTS idx_customers_profile_name
  ON public.customers (profile_id, trading_name);
CREATE INDEX IF NOT EXISTS idx_customers_profile_updated
  ON public.customers (profile_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_linked_profile
  ON public.customers (linked_profile_id)
  WHERE linked_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_srm_suppliers_profile_updated
  ON public.srm_suppliers (profile_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_srm_suppliers_linked
  ON public.srm_suppliers (linked_profile_id)
  WHERE linked_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_srm_suppliers_profile_email
  ON public.srm_suppliers (profile_id, lower(email))
  WHERE email IS NOT NULL AND length(trim(email)) > 3;

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('customers', 'srm_suppliers')
  AND column_name IN (
    'continent', 'province', 'region', 'city', 'country',
    'vat_number', 'registration_number', 'payment_terms', 'logo_url'
  )
ORDER BY table_name, column_name;

SELECT 'crm_srm_book_ok' AS status;
