-- Company SaaS subscription (R499/mo · 30-day free trial · Paystack)
-- Columns on public.profiles (company = profile)

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

SELECT public.sa_add_column('profiles', 'subscription_status', 'text', '''none''');
SELECT public.sa_add_column('profiles', 'subscription_trial_ends_at', 'timestamptz');
SELECT public.sa_add_column('profiles', 'subscription_starts_at', 'timestamptz');
SELECT public.sa_add_column('profiles', 'subscription_ends_at', 'timestamptz');
SELECT public.sa_add_column('profiles', 'subscription_paystack_ref', 'text');
SELECT public.sa_add_column('profiles', 'subscription_paystack_customer_code', 'text');
SELECT public.sa_add_column('profiles', 'subscription_paystack_auth_code', 'text');
SELECT public.sa_add_column('profiles', 'subscription_amount_zar', 'numeric(12,2)');
SELECT public.sa_add_column('profiles', 'subscription_plan', 'text', '''company_monthly''');

CREATE INDEX IF NOT EXISTS idx_profiles_sub_status
  ON public.profiles(subscription_status);

CREATE INDEX IF NOT EXISTS idx_profiles_sub_ref
  ON public.profiles(subscription_paystack_ref)
  WHERE subscription_paystack_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_sub_ends
  ON public.profiles(subscription_ends_at)
  WHERE subscription_ends_at IS NOT NULL;
