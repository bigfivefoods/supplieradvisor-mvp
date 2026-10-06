-- Same script as supabase/migrations/20261006_referral_commission.sql
-- Referral commission for companies that bring in sales.

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

CREATE TABLE IF NOT EXISTS public.referral_commission_agreements (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  partner_profile_id bigint NOT NULL,
  partner_name text,
  rate_pct numeric(8,4) NOT NULL,
  basis text NOT NULL DEFAULT 'ex_vat',
  earn_on text NOT NULL DEFAULT 'collected',
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, partner_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_ref_comm_agree_partner
  ON public.referral_commission_agreements (partner_profile_id);

CREATE TABLE IF NOT EXISTS public.referral_commission_redemptions (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL,
  partner_profile_id bigint NOT NULL,
  amount numeric(18,2) NOT NULL,
  redeemed_on date NOT NULL,
  method text NOT NULL DEFAULT 'paid',
  reference text,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ref_comm_redeem_pair
  ON public.referral_commission_redemptions (profile_id, partner_profile_id, redeemed_on);

SELECT public.sa_add_column('customers', 'referral_partner_profile_id', 'bigint');
SELECT public.sa_add_column('customer_invoices', 'referral_partner_profile_id', 'bigint');

CREATE INDEX IF NOT EXISTS idx_customers_referral_partner
  ON public.customers (profile_id, referral_partner_profile_id);
CREATE INDEX IF NOT EXISTS idx_invoices_referral_partner
  ON public.customer_invoices (profile_id, referral_partner_profile_id);

ALTER TABLE public.referral_commission_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_commission_redemptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.referral_commission_agreements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.referral_commission_redemptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.referral_commission_agreements TO service_role;
GRANT ALL ON TABLE public.referral_commission_redemptions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.referral_commission_agreements_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.referral_commission_redemptions_id_seq TO service_role;

NOTIFY pgrst, 'reload schema';
