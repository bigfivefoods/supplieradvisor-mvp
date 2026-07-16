-- Watertight supply-chain referral: attribution audit, holds, clawbacks, KYC, RLS
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

-- Attribution audit (immutable first-touch events)
CREATE TABLE IF NOT EXISTS public.referral_attributions (
  id bigserial PRIMARY KEY,
  child_profile_id bigint NOT NULL,
  referrer_profile_id bigint NOT NULL,
  source text NOT NULL DEFAULT 'unknown',
  -- ref_link | supplier_invite | customer_invite | invite_business | default_root | admin | claim
  invite_token text,
  actor_user_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_attr_child
  ON public.referral_attributions (child_profile_id);
CREATE INDEX IF NOT EXISTS idx_referral_attr_referrer
  ON public.referral_attributions (referrer_profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_attr_first_touch
  ON public.referral_attributions (child_profile_id);

-- Profile attribution metadata
SELECT public.sa_add_column('profiles', 'referred_at', 'timestamptz');
SELECT public.sa_add_column('profiles', 'referral_source', 'text');
SELECT public.sa_add_column('profiles', 'referral_invite_token', 'text');

-- Payout KYC / bank details (company-level)
SELECT public.sa_add_column('profiles', 'referral_payout_bank_name', 'text');
SELECT public.sa_add_column('profiles', 'referral_payout_account_name', 'text');
SELECT public.sa_add_column('profiles', 'referral_payout_account_number', 'text');
SELECT public.sa_add_column('profiles', 'referral_payout_branch_code', 'text');
SELECT public.sa_add_column('profiles', 'referral_payout_tax_number', 'text');
SELECT public.sa_add_column('profiles', 'referral_payout_verified_at', 'timestamptz');

-- Earnings hold / clawback / eligibility
SELECT public.sa_add_column('supply_chain_referral_earnings', 'eligible_at', 'timestamptz');
SELECT public.sa_add_column('supply_chain_referral_earnings', 'hold_until', 'timestamptz');
SELECT public.sa_add_column('supply_chain_referral_earnings', 'approved_at', 'timestamptz');
SELECT public.sa_add_column('supply_chain_referral_earnings', 'approved_by', 'text');
SELECT public.sa_add_column('supply_chain_referral_earnings', 'clawback_of_id', 'bigint');
SELECT public.sa_add_column('supply_chain_referral_earnings', 'clawed_back_at', 'timestamptz');
SELECT public.sa_add_column('supply_chain_referral_earnings', 'is_clawback', 'boolean', 'false');

CREATE INDEX IF NOT EXISTS idx_scre_hold_until
  ON public.supply_chain_referral_earnings (status, hold_until)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scre_source_ref
  ON public.supply_chain_referral_earnings (source_ref);

-- Clawback / adjustment ledger (explicit records)
CREATE TABLE IF NOT EXISTS public.supply_chain_referral_clawbacks (
  id bigserial PRIMARY KEY,
  earning_id bigint,
  source_ref text,
  earner_profile_id bigint NOT NULL,
  source_profile_id bigint,
  amount_zar numeric(14,2) NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'open',
  -- open | offset | written_off
  created_by text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scr_clawbacks_earner
  ON public.supply_chain_referral_clawbacks (earner_profile_id);
CREATE INDEX IF NOT EXISTS idx_scr_clawbacks_source_ref
  ON public.supply_chain_referral_clawbacks (source_ref);

-- RLS: deny anon; server uses service role
DO $$
BEGIN
  ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.supply_chain_referral_clawbacks ENABLE ROW LEVEL SECURITY;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='supply_chain_referral_earnings') THEN
    ALTER TABLE public.supply_chain_referral_earnings ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='supply_chain_referral_payouts') THEN
    ALTER TABLE public.supply_chain_referral_payouts ENABLE ROW LEVEL SECURITY;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  -- Drop overly-permissive policies if present
  DROP POLICY IF EXISTS scre_all ON public.supply_chain_referral_earnings;
  DROP POLICY IF EXISTS scrp_all ON public.supply_chain_referral_payouts;

  -- Deny anon by default (no policies for anon = deny with RLS; service role bypasses)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'referral_attributions' AND policyname = 'deny_anon_referral_attr'
  ) THEN
    CREATE POLICY deny_anon_referral_attr ON public.referral_attributions
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supply_chain_referral_clawbacks' AND policyname = 'deny_anon_scr_clawbacks'
  ) THEN
    CREATE POLICY deny_anon_scr_clawbacks ON public.supply_chain_referral_clawbacks
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supply_chain_referral_earnings' AND policyname = 'deny_anon_scre'
  ) THEN
    CREATE POLICY deny_anon_scre ON public.supply_chain_referral_earnings
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supply_chain_referral_payouts' AND policyname = 'deny_anon_scrp'
  ) THEN
    CREATE POLICY deny_anon_scrp ON public.supply_chain_referral_payouts
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'referral RLS harden skip: %', SQLERRM;
END $$;
