-- Supplier RIAD log (company-scoped SRM) — mirrors customer_riad
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

CREATE TABLE IF NOT EXISTS public.supplier_riad (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  supplier_id bigint,
  entry_type text NOT NULL DEFAULT 'risk',
  title text NOT NULL DEFAULT 'RIAD entry',
  description text,
  status text NOT NULL DEFAULT 'open',
  severity text DEFAULT 'medium',
  owner_name text,
  due_date date,
  closed_at timestamptz,
  related_po_id bigint,
  category text,
  mitigation_plan text,
  notes text,
  resolution text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('supplier_riad', 'profile_id', 'bigint');
SELECT public.sa_add_column('supplier_riad', 'supplier_id', 'bigint');
SELECT public.sa_add_column('supplier_riad', 'entry_type', 'text', '''risk''');
SELECT public.sa_add_column('supplier_riad', 'title', 'text');
SELECT public.sa_add_column('supplier_riad', 'description', 'text');
SELECT public.sa_add_column('supplier_riad', 'status', 'text', '''open''');
SELECT public.sa_add_column('supplier_riad', 'severity', 'text', '''medium''');
SELECT public.sa_add_column('supplier_riad', 'owner_name', 'text');
SELECT public.sa_add_column('supplier_riad', 'due_date', 'date');
SELECT public.sa_add_column('supplier_riad', 'closed_at', 'timestamptz');
SELECT public.sa_add_column('supplier_riad', 'related_po_id', 'bigint');
SELECT public.sa_add_column('supplier_riad', 'category', 'text');
SELECT public.sa_add_column('supplier_riad', 'mitigation_plan', 'text');
SELECT public.sa_add_column('supplier_riad', 'notes', 'text');
SELECT public.sa_add_column('supplier_riad', 'resolution', 'text');
SELECT public.sa_add_column('supplier_riad', 'created_by', 'text');
SELECT public.sa_add_column('supplier_riad', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('supplier_riad', 'updated_at', 'timestamptz', 'now()');

CREATE INDEX IF NOT EXISTS idx_supplier_riad_profile ON public.supplier_riad(profile_id);
CREATE INDEX IF NOT EXISTS idx_supplier_riad_supplier ON public.supplier_riad(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_riad_status ON public.supplier_riad(profile_id, status);

ALTER TABLE public.supplier_riad ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS supplier_riad_all ON public.supplier_riad;
CREATE POLICY supplier_riad_all ON public.supplier_riad FOR ALL USING (true) WITH CHECK (true);

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'supplier_riad';
