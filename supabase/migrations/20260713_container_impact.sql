-- Food security + jobs impact per container (assumptions + per-outlet overrides)

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
  -- Jobs: direct operator roles per deployed container (when staffed)
  jobs_direct_default numeric(8,2) NOT NULL DEFAULT 1,
  -- Additional supporting jobs attributed per outlet (logistics, packing, etc.)
  jobs_support_default numeric(8,2) NOT NULL DEFAULT 0.5,
  -- Average ZAR price of one meal / food serving sold
  avg_meal_price_zar numeric(12,2) NOT NULL DEFAULT 45,
  -- People nourished per meal sold (1 = one person; 3–4 for household share)
  people_per_meal numeric(8,2) NOT NULL DEFAULT 1,
  -- Optional: people fed per sales transaction if line items unavailable
  people_per_sale_txn numeric(8,2) NOT NULL DEFAULT 2.5,
  -- Prefer revenue/meal method vs txn method: 'revenue' | 'transactions' | 'both_max'
  people_method text NOT NULL DEFAULT 'revenue',
  currency text NOT NULL DEFAULT 'ZAR',
  methodology_notes text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.container_impact_settings IS
  'Assumptions for jobs created and people fed per container (food security impact)';

DO $$
BEGIN
  ALTER TABLE public.container_impact_settings ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS deny_anon_all ON public.container_impact_settings;
  CREATE POLICY deny_anon_all ON public.container_impact_settings
    FOR ALL TO anon USING (false) WITH CHECK (false);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'impact settings RLS skip: %', SQLERRM;
END $$;
