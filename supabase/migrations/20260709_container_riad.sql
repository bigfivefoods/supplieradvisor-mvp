-- Container-scoped RIAD (Risk · Issue · Action · Decision) log
-- Safe / idempotent for Supabase SQL Editor

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

CREATE TABLE IF NOT EXISTS public.riad_logs (
  id bigserial PRIMARY KEY,
  riad_type text NOT NULL DEFAULT 'risk', -- risk | issue | action | decision
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tenancy & container scope
SELECT public.sa_add_column('riad_logs', 'profile_id', 'bigint');
SELECT public.sa_add_column('riad_logs', 'container_id', 'bigint');
SELECT public.sa_add_column('riad_logs', 'contractor_id', 'bigint');
SELECT public.sa_add_column('riad_logs', 'module', 'text', '''containers''');
SELECT public.sa_add_column('riad_logs', 'source', 'text', '''business'''); -- business | contractor

-- Core RIAD fields
SELECT public.sa_add_column('riad_logs', 'riad_type', 'text', '''risk''');
SELECT public.sa_add_column('riad_logs', 'title', 'text');
SELECT public.sa_add_column('riad_logs', 'description', 'text');
SELECT public.sa_add_column('riad_logs', 'status', 'text', '''open''');
SELECT public.sa_add_column('riad_logs', 'priority', 'text', '''medium'''); -- low | medium | high | critical
SELECT public.sa_add_column('riad_logs', 'category', 'text');
SELECT public.sa_add_column('riad_logs', 'owner_name', 'text');
SELECT public.sa_add_column('riad_logs', 'owner_id', 'bigint');
SELECT public.sa_add_column('riad_logs', 'stakeholder_type', 'text');
SELECT public.sa_add_column('riad_logs', 'stakeholder_id', 'bigint');
SELECT public.sa_add_column('riad_logs', 'stakeholder_name', 'text');

-- Risk scoring
SELECT public.sa_add_column('riad_logs', 'severity', 'int');
SELECT public.sa_add_column('riad_logs', 'likelihood', 'int');
SELECT public.sa_add_column('riad_logs', 'time_horizon', 'int');
SELECT public.sa_add_column('riad_logs', 'rpn', 'int');
SELECT public.sa_add_column('riad_logs', 'residual_rpn', 'int');
SELECT public.sa_add_column('riad_logs', 'mitigation_plan', 'text');

-- Workflow
SELECT public.sa_add_column('riad_logs', 'logged_date', 'date');
SELECT public.sa_add_column('riad_logs', 'due_date', 'date');
SELECT public.sa_add_column('riad_logs', 'closed_at', 'timestamptz');
SELECT public.sa_add_column('riad_logs', 'image_url', 'text');
SELECT public.sa_add_column('riad_logs', 'tags', 'text[]', '''{}''');
SELECT public.sa_add_column('riad_logs', 'created_by', 'text');
SELECT public.sa_add_column('riad_logs', 'created_by_name', 'text');
SELECT public.sa_add_column('riad_logs', 'updated_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('riad_logs', 'notes', 'text');
SELECT public.sa_add_column('riad_logs', 'resolution', 'text');

-- Indexes (guarded)
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_riad_profile ON public.riad_logs(profile_id);
  CREATE INDEX IF NOT EXISTS idx_riad_container ON public.riad_logs(container_id);
  CREATE INDEX IF NOT EXISTS idx_riad_type ON public.riad_logs(riad_type);
  CREATE INDEX IF NOT EXISTS idx_riad_status ON public.riad_logs(status);
  CREATE INDEX IF NOT EXISTS idx_riad_module ON public.riad_logs(module);
  CREATE INDEX IF NOT EXISTS idx_riad_contractor ON public.riad_logs(contractor_id);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'riad indexes skip: %', SQLERRM;
END $$;

ALTER TABLE public.riad_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS riad_logs_all ON public.riad_logs;
CREATE POLICY riad_logs_all ON public.riad_logs FOR ALL USING (true) WITH CHECK (true);

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'riad_logs'
  AND column_name IN (
    'profile_id', 'container_id', 'contractor_id', 'module', 'source',
    'riad_type', 'priority', 'rpn', 'mitigation_plan', 'due_date'
  )
ORDER BY column_name;
