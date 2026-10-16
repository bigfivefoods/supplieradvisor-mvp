-- Brief 118: re-assert the six public.profiles columns that supabase/migrations/20260710_company_profile_docs.sql
-- declares (and registration, company profile and the customer-invite claim write) but live is missing.
-- Additive and idempotent: nullable, no default, IF NOT EXISTS. No data is changed.
-- SET LOCAL lock_timeout needs a transaction (Supabase CLI and the SQL editor are fine; plain psql -f is not).
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS region        text,
  ADD COLUMN IF NOT EXISTS sub_industries text[],
  ADD COLUMN IF NOT EXISTS latitude      double precision,
  ADD COLUMN IF NOT EXISTS longitude     double precision,
  ADD COLUMN IF NOT EXISTS lat           double precision,
  ADD COLUMN IF NOT EXISTS lng           double precision;

DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(c, ', ') INTO missing
  FROM unnest(ARRAY['region','sub_industries','latitude','longitude','lat','lng']) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = c
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'profiles columns still missing: %', missing;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
