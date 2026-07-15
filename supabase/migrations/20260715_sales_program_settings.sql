-- Company-specific sales program settings (legal, commission, criteria)
-- One row per company (profile_id). Idempotent.

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

CREATE TABLE IF NOT EXISTS public.sales_program_settings (
  id bigserial PRIMARY KEY,
  profile_id bigint UNIQUE NOT NULL,

  program_name text,
  program_summary text,
  is_enabled boolean NOT NULL DEFAULT true,

  contract_title text,
  contract_version text NOT NULL DEFAULT 'ISC-2026.10-ZA',
  legal_body_html text,
  legal_addendum_html text,
  email_domain text,
  require_re_sign_on_change boolean NOT NULL DEFAULT true,

  commission_model text NOT NULL DEFAULT 'stepped',
  commission_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  min_commission_pct numeric(6,3) NOT NULL DEFAULT 0,
  max_commission_pct numeric(6,3) NOT NULL DEFAULT 100,
  currency text NOT NULL DEFAULT 'ZAR',
  example_units numeric(18,2),
  example_unit_price numeric(18,4),
  example_label text,

  sales_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  reseller_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  eligibility_notes text,
  program_info_html text,

  personal_sales_only boolean NOT NULL DEFAULT true,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sps_profile ON public.sales_program_settings(profile_id);

DO $$
BEGIN
  ALTER TABLE public.sales_program_settings ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sales_program_settings' AND policyname = 'sps_all'
  ) THEN
    CREATE POLICY sps_all ON public.sales_program_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sales_program_settings RLS policies skip: %', SQLERRM;
END $$;
