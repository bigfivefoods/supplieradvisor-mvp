-- Lifetime complimentary access:
--   1) Founder companies (Big Five group + Vuka Fitness) by name
--   2) First 50 companies by created_at (founding partners)
-- Requires subscription columns from 20260712_company_subscription.sql

-- Ensure columns exist (idempotent)
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
SELECT public.sa_add_column('profiles', 'subscription_amount_zar', 'numeric(12,2)');
SELECT public.sa_add_column('profiles', 'subscription_plan', 'text', '''company_monthly''');

-- Founder companies by name (always lifetime)
UPDATE public.profiles
SET
  subscription_status = 'lifetime',
  subscription_plan = 'founder_lifetime',
  subscription_amount_zar = 0,
  subscription_starts_at = COALESCE(subscription_starts_at, created_at, now()),
  subscription_ends_at = NULL,
  subscription_trial_ends_at = COALESCE(subscription_trial_ends_at, now())
WHERE
  (
    trading_name ~* '^\s*big\s*five\s*(foods|direct|access)'
    OR legal_name ~* '^\s*big\s*five\s*(foods|direct|access)'
    OR trading_name ~* 'big\s*five\s*foods'
    OR legal_name ~* 'big\s*five\s*foods'
    OR trading_name ~* '^\s*vuka(\s+fitness)?\s*$'
    OR legal_name ~* '^\s*vuka(\s+fitness)?\s*$'
    OR trading_name ~* 'vuka\s*fitness'
    OR legal_name ~* 'easta?\s*africa\s*big\s*five'
  )
  AND COALESCE(subscription_status, 'none') IS DISTINCT FROM 'lifetime';

-- First 50 companies by created_at (founding partners) — skip if already lifetime founder
UPDATE public.profiles p
SET
  subscription_status = 'lifetime',
  subscription_plan = CASE
    WHEN p.subscription_plan = 'founder_lifetime' THEN 'founder_lifetime'
    ELSE 'founding_50'
  END,
  subscription_amount_zar = 0,
  subscription_starts_at = COALESCE(p.subscription_starts_at, p.created_at, now()),
  subscription_ends_at = NULL
FROM (
  SELECT id
  FROM public.profiles
  ORDER BY created_at ASC NULLS LAST, id ASC
  LIMIT 50
) earliest
WHERE p.id = earliest.id
  AND COALESCE(p.subscription_status, 'none') IS DISTINCT FROM 'lifetime';

-- Re-apply founder plan label for name matches (in case they were in first 50 as founding_50)
UPDATE public.profiles
SET subscription_plan = 'founder_lifetime'
WHERE
  (
    trading_name ~* 'big\s*five\s*(foods|direct|access)'
    OR legal_name ~* 'big\s*five\s*(foods|direct|access)'
    OR trading_name ~* 'vuka'
    OR legal_name ~* 'easta?\s*africa\s*big\s*five'
  )
  AND subscription_status = 'lifetime'
  AND COALESCE(subscription_plan, '') IS DISTINCT FROM 'founder_lifetime';
