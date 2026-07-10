-- Sales contractor portal: agreements, commission tiers, rep attribution
-- Safe / idempotent

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

-- ── Agreements (one active per business_user membership) ─────────────────────
CREATE TABLE IF NOT EXISTS public.sales_contractor_agreements (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  business_user_id bigint,
  user_id text,
  contractor_email text,
  contractor_name text,
  status text NOT NULL DEFAULT 'pending',
  -- pending | signed | suspended | terminated
  contract_version text NOT NULL DEFAULT 'ISC-2026.1',
  commission_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_commission_pct numeric(6,3) NOT NULL DEFAULT 5,
  min_commission_pct numeric(6,3) NOT NULL DEFAULT 1,
  currency text NOT NULL DEFAULT 'ZAR',
  signed_at timestamptz,
  signature_name text,
  signature_email text,
  accepted_ip text,
  terms_summary text,
  -- Platform portal subscription (R199/mo × 6 months prepaid)
  subscription_status text DEFAULT 'none',
  -- none | active | expired | cancelled
  subscription_starts_at timestamptz,
  subscription_ends_at timestamptz,
  subscription_paystack_ref text,
  subscription_amount_zar numeric(12,2),
  subscription_term_months int DEFAULT 6,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sca_profile ON public.sales_contractor_agreements(profile_id);
CREATE INDEX IF NOT EXISTS idx_sca_user ON public.sales_contractor_agreements(user_id);
CREATE INDEX IF NOT EXISTS idx_sca_bu ON public.sales_contractor_agreements(business_user_id);
CREATE INDEX IF NOT EXISTS idx_sca_status ON public.sales_contractor_agreements(profile_id, status);

-- ── Commission ledger (earned on invoice paid / order won) ────────────────────
CREATE TABLE IF NOT EXISTS public.sales_commission_ledger (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  business_user_id bigint,
  sales_rep_user_id text NOT NULL,
  source_type text NOT NULL,
  -- quote | order | invoice | opportunity
  source_id bigint,
  customer_id bigint,
  customer_name text,
  deal_amount numeric(18,2) NOT NULL DEFAULT 0,
  commission_pct numeric(8,4) NOT NULL DEFAULT 0,
  commission_amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  status text NOT NULL DEFAULT 'projected',
  -- projected | earned | approved | paid | void
  event_date date,
  paid_at timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scl_profile ON public.sales_commission_ledger(profile_id);
CREATE INDEX IF NOT EXISTS idx_scl_rep ON public.sales_commission_ledger(sales_rep_user_id);
CREATE INDEX IF NOT EXISTS idx_scl_status ON public.sales_commission_ledger(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_scl_source ON public.sales_commission_ledger(source_type, source_id);

-- ── Rep attribution on CRM entities ──────────────────────────────────────────
SELECT public.sa_add_column('leads', 'sales_rep_user_id', 'text');
SELECT public.sa_add_column('leads', 'sales_rep_name', 'text');
SELECT public.sa_add_column('customers', 'sales_rep_user_id', 'text');
SELECT public.sa_add_column('customers', 'sales_rep_name', 'text');
SELECT public.sa_add_column('opportunities', 'sales_rep_user_id', 'text');
SELECT public.sa_add_column('opportunities', 'sales_rep_name', 'text');
SELECT public.sa_add_column('customer_quotes', 'sales_rep_user_id', 'text');
SELECT public.sa_add_column('customer_quotes', 'sales_rep_name', 'text');
SELECT public.sa_add_column('sales_orders', 'sales_rep_user_id', 'text');
SELECT public.sa_add_column('sales_orders', 'sales_rep_name', 'text');
SELECT public.sa_add_column('customer_invoices', 'sales_rep_user_id', 'text');
SELECT public.sa_add_column('customer_invoices', 'sales_rep_name', 'text');

-- Soft open policies (app-layer auth is primary, matches rest of CRM)
DO $$
BEGIN
  ALTER TABLE public.sales_contractor_agreements ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.sales_commission_ledger ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sales_contractor_agreements' AND policyname = 'sca_all'
  ) THEN
    CREATE POLICY sca_all ON public.sales_contractor_agreements FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sales_commission_ledger' AND policyname = 'scl_all'
  ) THEN
    CREATE POLICY scl_all ON public.sales_commission_ledger FOR ALL USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sales contractor RLS policies skip: %', SQLERRM;
END $$;
