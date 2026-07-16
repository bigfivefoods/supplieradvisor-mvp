-- Supply-chain referral (3 levels) + company referrer link
-- Total commission pool across levels ≤ 10% of qualifying subscription payments.
-- Idempotent.

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

-- Who invited this company onto SupplierAdvisor (level-1 parent)
SELECT public.sa_add_column('profiles', 'referred_by_profile_id', 'bigint');
SELECT public.sa_add_column('profiles', 'referral_code', 'text');

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by
  ON public.profiles (referred_by_profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON public.profiles (referral_code)
  WHERE referral_code IS NOT NULL AND referral_code <> '';

-- Earnings ledger (subscription-share commissions up the supply chain)
CREATE TABLE IF NOT EXISTS public.supply_chain_referral_earnings (
  id bigserial PRIMARY KEY,
  -- Company that earns the fee
  earner_profile_id bigint NOT NULL,
  -- Company whose payment generated the fee
  source_profile_id bigint NOT NULL,
  -- Direct parent (level 1) of the source, for audit trail
  referrer_profile_id bigint,
  level int NOT NULL CHECK (level >= 1 AND level <= 3),
  rate_pct numeric(6,3) NOT NULL,
  base_amount_zar numeric(14,2) NOT NULL DEFAULT 0,
  commission_amount_zar numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  source_type text NOT NULL DEFAULT 'company_subscription',
  -- e.g. paystack ref
  source_ref text,
  status text NOT NULL DEFAULT 'pending',
  -- pending | approved | paid | void
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scre_earner
  ON public.supply_chain_referral_earnings (earner_profile_id);
CREATE INDEX IF NOT EXISTS idx_scre_source
  ON public.supply_chain_referral_earnings (source_profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scre_unique_source_level_earner
  ON public.supply_chain_referral_earnings (source_ref, level, earner_profile_id)
  WHERE source_ref IS NOT NULL AND source_ref <> '';

DO $$
BEGIN
  ALTER TABLE public.supply_chain_referral_earnings ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'supply_chain_referral_earnings' AND policyname = 'scre_all'
  ) THEN
    CREATE POLICY scre_all ON public.supply_chain_referral_earnings
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'scre RLS skip: %', SQLERRM;
END $$;
