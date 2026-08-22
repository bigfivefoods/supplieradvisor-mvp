-- Hot-path indexes + gym movement library module.
-- Paste in the Supabase SQL editor. Safe to re-run.

CREATE INDEX IF NOT EXISTS idx_customers_profile_email
  ON public.customers (profile_id, lower(email))
  WHERE email IS NOT NULL AND length(trim(email)) > 3;

CREATE INDEX IF NOT EXISTS idx_business_users_active_email
  ON public.business_users (lower(email))
  WHERE status = 'active' AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_users_active_invited_email
  ON public.business_users (lower(invited_email))
  WHERE status = 'active' AND invited_email IS NOT NULL;

-- Allow gym movement library as its own module-store row (desk GET stays small).
CREATE OR REPLACE FUNCTION public.sa_assert_advisor_module(p_module text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_module IS NULL OR p_module NOT IN (
    'fitgraph',
    'fitgraph_lib',
    'physiograph',
    'medicalgraph',
    'psychiatrygraph',
    'dentalgraph',
    'hiregraph',
    'retailgraph',
    'fieldgraph',
    'quarrygraph'
  ) THEN
    RAISE EXCEPTION 'unknown advisor module';
  END IF;
END;
$$;
