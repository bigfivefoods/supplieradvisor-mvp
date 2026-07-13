-- Public share tokens for container network map + metrics (embed on external sites)

CREATE TABLE IF NOT EXISTS public.container_network_shares (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  title TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  show_metrics BOOLEAN NOT NULL DEFAULT true,
  show_list BOOLEAN NOT NULL DEFAULT true,
  show_contractors BOOLEAN NOT NULL DEFAULT false,
  show_photos BOOLEAN NOT NULL DEFAULT false,
  brand_name TEXT,
  brand_url TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_container_network_shares_profile
  ON public.container_network_shares (profile_id);

CREATE INDEX IF NOT EXISTS idx_container_network_shares_token
  ON public.container_network_shares (token)
  WHERE is_active = true;

COMMENT ON TABLE public.container_network_shares IS
  'Public tokens to embed container map + network metrics on external websites (e.g. bigfivegroup.africa)';

DO $$
BEGIN
  ALTER TABLE public.container_network_shares ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS deny_anon_all ON public.container_network_shares;
  CREATE POLICY deny_anon_all ON public.container_network_shares
    FOR ALL TO anon USING (false) WITH CHECK (false);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'container_network_shares RLS skip: %', SQLERRM;
END $$;
