-- Hotfix: supplier_invitations missing created_at / updated_at
-- (table created before timestamps were ensured via sa_add_column)

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

SELECT public.sa_add_column('supplier_invitations', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('supplier_invitations', 'updated_at', 'timestamptz', 'now()');

-- Also ensure the same on srm_suppliers / supplier_documents if partial
SELECT public.sa_add_column('srm_suppliers', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('srm_suppliers', 'updated_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('supplier_documents', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('supplier_documents', 'updated_at', 'timestamptz', 'now()');

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'supplier_invitations'
  AND column_name IN ('created_at', 'updated_at')
ORDER BY 1;
