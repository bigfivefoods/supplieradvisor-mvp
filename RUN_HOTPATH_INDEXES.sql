-- Hot-path indexes: hire/PWA customer lookup, team email match.
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
