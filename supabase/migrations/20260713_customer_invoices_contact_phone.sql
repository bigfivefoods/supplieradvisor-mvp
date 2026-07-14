-- Fix: invoice create fails with
--   Could not find the 'contact_phone' column of 'customer_invoices' in the schema cache
-- Quotes/orders already had contact_phone; invoices did not.

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

SELECT public.sa_add_column('customer_invoices', 'contact_phone', 'text');
SELECT public.sa_add_column('customer_quotes', 'contact_phone', 'text');
SELECT public.sa_add_column('sales_orders', 'contact_phone', 'text');

-- Also ensure opportunity_id exists on invoices if conversion uses it
SELECT public.sa_add_column('customer_invoices', 'opportunity_id', 'bigint');

NOTIFY pgrst, 'reload schema';
