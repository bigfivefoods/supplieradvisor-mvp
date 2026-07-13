-- Food security + jobs impact per container (assumptions + per-outlet overrides)
-- Run this in Supabase → SQL Editor if you see:
--   Could not find the table 'public.container_impact_settings' in the schema cache

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

-- Per-container impact overrides
SELECT public.sa_add_column('containers', 'impact_jobs_direct', 'numeric(8,2)');
SELECT public.sa_add_column('containers', 'impact_jobs_support', 'numeric(8,2)');
SELECT public.sa_add_column('containers', 'impact_people_per_sale', 'numeric(8,2)');
SELECT public.sa_add_column('containers', 'impact_avg_meal_price', 'numeric(12,2)');
SELECT public.sa_add_column('containers', 'impact_notes', 'text');

-- Company-level impact assumptions
CREATE TABLE IF NOT EXISTS public.container_impact_settings (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL UNIQUE,
  jobs_direct_default numeric(8,2) NOT NULL DEFAULT 1,
  jobs_support_default numeric(8,2) NOT NULL DEFAULT 0.5,
  avg_meal_price_zar numeric(12,2) NOT NULL DEFAULT 45,
  people_per_meal numeric(8,2) NOT NULL DEFAULT 1,
  people_per_sale_txn numeric(8,2) NOT NULL DEFAULT 2.5,
  people_method text NOT NULL DEFAULT 'revenue',
  currency text NOT NULL DEFAULT 'ZAR',
  methodology_notes text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.container_impact_settings IS
  'Assumptions for jobs created and people fed per container (food security impact)';

-- Service role / app uses these; block anon direct access
DO $$
BEGIN
  ALTER TABLE public.container_impact_settings ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS deny_anon_all ON public.container_impact_settings;
  CREATE POLICY deny_anon_all ON public.container_impact_settings
    FOR ALL TO anon USING (false) WITH CHECK (false);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'impact settings RLS skip: %', SQLERRM;
END $$;

-- Optional: link container stock lines to products catalogue
SELECT public.sa_add_column('container_inventory', 'product_id', 'bigint');

-- Optional: public embed impact toggle
SELECT public.sa_add_column('container_network_shares', 'show_impact', 'boolean', 'true');

-- Reload PostgREST schema cache so the new table is visible immediately
NOTIFY pgrst, 'reload schema';
