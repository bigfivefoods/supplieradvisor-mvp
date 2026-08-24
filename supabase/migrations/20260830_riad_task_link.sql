-- Link CRM/SRM RIAD rows to joint project tasks (guest portal + desk).
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

SELECT public.sa_add_column('customer_riad', 'related_project_id', 'bigint');
SELECT public.sa_add_column('customer_riad', 'related_task_id', 'bigint');
SELECT public.sa_add_column('supplier_riad', 'related_project_id', 'bigint');
SELECT public.sa_add_column('supplier_riad', 'related_task_id', 'bigint');

CREATE INDEX IF NOT EXISTS idx_customer_riad_task ON public.customer_riad(related_task_id);
CREATE INDEX IF NOT EXISTS idx_supplier_riad_task ON public.supplier_riad(related_task_id);
