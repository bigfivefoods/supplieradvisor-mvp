-- B2C consumer wallet — personal profile + linked brand memberships
-- (hire portals, gym members, clinic patients, etc.) keyed by platform user id.

CREATE TABLE IF NOT EXISTS public.platform_b2c_profiles (
  user_id text PRIMARY KEY,
  email text,
  full_name text,
  phone text,
  photo_url text,
  memberships jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_b2c_profiles_email
  ON public.platform_b2c_profiles (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_b2c_profiles_updated
  ON public.platform_b2c_profiles (updated_at DESC);

COMMENT ON TABLE public.platform_b2c_profiles IS
  'B2C consumer wallet: Privy user id → profile + linked hire/gym/clinic memberships.';
