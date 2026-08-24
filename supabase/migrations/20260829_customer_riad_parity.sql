-- Align customer_riad with supplier_riad so portal + desk share category,
-- mitigation, notes (comments), and resolution.
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

SELECT public.sa_add_column('customer_riad', 'category', 'text');
SELECT public.sa_add_column('customer_riad', 'mitigation_plan', 'text');
SELECT public.sa_add_column('customer_riad', 'notes', 'text');
SELECT public.sa_add_column('customer_riad', 'resolution', 'text');
SELECT public.sa_add_column('customer_riad', 'created_by', 'text');

CREATE INDEX IF NOT EXISTS idx_customer_riad_status ON public.customer_riad(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_riad_customer ON public.customer_riad(customer_id);
