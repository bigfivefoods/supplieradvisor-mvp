-- Sales contractor portal subscription columns (idempotent)
-- R199/month · 6-month prepaid term via Paystack

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

SELECT public.sa_add_column('sales_contractor_agreements', 'subscription_status', 'text', '''none''');
SELECT public.sa_add_column('sales_contractor_agreements', 'subscription_starts_at', 'timestamptz');
SELECT public.sa_add_column('sales_contractor_agreements', 'subscription_ends_at', 'timestamptz');
SELECT public.sa_add_column('sales_contractor_agreements', 'subscription_paystack_ref', 'text');
SELECT public.sa_add_column('sales_contractor_agreements', 'subscription_amount_zar', 'numeric(12,2)');
SELECT public.sa_add_column('sales_contractor_agreements', 'subscription_term_months', 'int', '6');

CREATE INDEX IF NOT EXISTS idx_sca_sub_status
  ON public.sales_contractor_agreements(profile_id, subscription_status);
CREATE INDEX IF NOT EXISTS idx_sca_sub_ref
  ON public.sales_contractor_agreements(subscription_paystack_ref)
  WHERE subscription_paystack_ref IS NOT NULL;
