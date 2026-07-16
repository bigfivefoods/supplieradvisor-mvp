-- Referral payout workflow columns (idempotent)

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

SELECT public.sa_add_column('supply_chain_referral_earnings', 'payout_requested_at', 'timestamptz');
SELECT public.sa_add_column('supply_chain_referral_earnings', 'payout_requested_by', 'text');
SELECT public.sa_add_column('supply_chain_referral_earnings', 'paid_at', 'timestamptz');
SELECT public.sa_add_column('supply_chain_referral_earnings', 'paid_ref', 'text');
SELECT public.sa_add_column('supply_chain_referral_earnings', 'paid_by', 'text');
SELECT public.sa_add_column('supply_chain_referral_earnings', 'voided_at', 'timestamptz');
SELECT public.sa_add_column('supply_chain_referral_earnings', 'void_reason', 'text');

-- Payout batches (optional grouping for finance)
CREATE TABLE IF NOT EXISTS public.supply_chain_referral_payouts (
  id bigserial PRIMARY KEY,
  earner_profile_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  -- requested | processing | paid | cancelled
  amount_zar numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  earning_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  requested_by text,
  paid_by text,
  paid_ref text,
  paid_at timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrp_earner
  ON public.supply_chain_referral_payouts (earner_profile_id);
CREATE INDEX IF NOT EXISTS idx_scrp_status
  ON public.supply_chain_referral_payouts (status);

DO $$
BEGIN
  ALTER TABLE public.supply_chain_referral_payouts ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'supply_chain_referral_payouts' AND policyname = 'scrp_all'
  ) THEN
    CREATE POLICY scrp_all ON public.supply_chain_referral_payouts
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'scrp RLS skip: %', SQLERRM;
END $$;
