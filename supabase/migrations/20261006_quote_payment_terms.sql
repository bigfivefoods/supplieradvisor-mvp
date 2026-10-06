-- Quote edit fails with:
--   Could not find the 'payment_terms' column of 'customer_quotes' in the schema cache
-- The quotation editor saves payment_terms (and terms) on quotes, orders, and invoices.
-- Quotes already store the same text in terms. Orders and invoices had neither column.
-- Quote trade threads are stored on customer_quotes.metadata.

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

SELECT public.sa_add_column('customer_quotes', 'payment_terms', 'text');
SELECT public.sa_add_column('customer_quotes', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('sales_orders', 'payment_terms', 'text');
SELECT public.sa_add_column('sales_orders', 'terms', 'text');
SELECT public.sa_add_column('customer_invoices', 'payment_terms', 'text');
SELECT public.sa_add_column('customer_invoices', 'terms', 'text');

UPDATE public.customer_quotes
SET payment_terms = terms
WHERE payment_terms IS NULL
  AND terms IS NOT NULL
  AND btrim(terms) <> '';

NOTIFY pgrst, 'reload schema';
