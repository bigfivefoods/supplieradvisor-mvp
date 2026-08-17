-- Faster, safer company load:
-- 1) Slim workspace chrome (modules / packaging / sidenav) off the giant metadata blob
-- 2) One jsonb row per Advisor module so a gym save cannot clobber a clinic
-- 3) Atomic metadata merge (metadata || patch) instead of read-whole-write-whole
-- 4) Indexes for membership + public token lookups
--
-- App uses service role after JWT + membership checks. Anon has no access.
-- Safe to re-run.

-- ── Tables ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_module_stores (
  company_id integer NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_token text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, module)
);

CREATE INDEX IF NOT EXISTS idx_company_module_stores_public_token
  ON public.company_module_stores (public_token)
  WHERE public_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_company_module_stores_updated
  ON public.company_module_stores (updated_at DESC);

COMMENT ON TABLE public.company_module_stores IS
  'Per-module Advisor stores (fitgraph, dentalgraph, …). Replaces reading the whole profiles.metadata blob.';

CREATE TABLE IF NOT EXISTS public.company_workspace (
  company_id integer PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  chrome jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.company_workspace IS
  'Slim company chrome for dashboard boot: enabled_modules, packaging, sidenav order.';

-- ── RLS (service role bypasses; deny anon) ────────────────

ALTER TABLE public.company_module_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_workspace ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_module_stores_deny_anon ON public.company_module_stores;
CREATE POLICY company_module_stores_deny_anon ON public.company_module_stores
  FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS company_workspace_deny_anon ON public.company_workspace;
CREATE POLICY company_workspace_deny_anon ON public.company_workspace
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- ── Membership lookup ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_business_users_company_user_active
  ON public.business_users (profile_id, user_id)
  WHERE status = 'active';

-- Public / portal token maps live as small root keys on metadata
CREATE INDEX IF NOT EXISTS idx_profiles_fitgraph_public_token
  ON public.profiles ((metadata->>'fitgraph_public_token'))
  WHERE metadata ? 'fitgraph_public_token';

CREATE INDEX IF NOT EXISTS idx_profiles_hiregraph_public_token
  ON public.profiles ((metadata->>'hiregraph_public_token'))
  WHERE metadata ? 'hiregraph_public_token';

-- ── RPCs ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sa_merge_profile_metadata(
  p_company_id integer,
  p_patch jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_company_id IS NULL OR p_company_id <= 0 THEN
    RAISE EXCEPTION 'company id required';
  END IF;
  UPDATE public.profiles
  SET
    metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_patch, '{}'::jsonb),
    updated_at = now()
  WHERE id = p_company_id;
END;
$$;

COMMENT ON FUNCTION public.sa_merge_profile_metadata(integer, jsonb) IS
  'Atomic metadata merge: only keys in the patch are overwritten. Concurrent module writes no longer clobber each other.';

CREATE OR REPLACE FUNCTION public.sa_get_profile_metadata_keys(
  p_company_id integer,
  p_keys text[]
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_object_agg(k, p.metadata -> k)
      FROM unnest(COALESCE(p_keys, ARRAY[]::text[])) AS k
    ),
    '{}'::jsonb
  )
  FROM public.profiles p
  WHERE p.id = p_company_id;
$$;

CREATE OR REPLACE FUNCTION public.sa_get_company_chrome(p_company_id integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws jsonb;
  keys text[] := ARRAY[
    'enabled_modules',
    'user_sidebar_orders',
    'os_entity_type',
    'os_sector',
    'os_industry',
    'os_industries',
    'os_business_type_id',
    'os_business_type_ids',
    'industry_packs',
    'industry_modules',
    'setup_status',
    'setup_path'
  ];
BEGIN
  SELECT chrome INTO ws
  FROM public.company_workspace
  WHERE company_id = p_company_id;

  IF ws IS NOT NULL AND ws <> '{}'::jsonb THEN
    RETURN ws;
  END IF;

  RETURN public.sa_get_profile_metadata_keys(p_company_id, keys);
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_put_company_chrome(
  p_company_id integer,
  p_chrome jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_workspace (company_id, chrome, updated_at)
  VALUES (p_company_id, COALESCE(p_chrome, '{}'::jsonb), now())
  ON CONFLICT (company_id) DO UPDATE
    SET
      chrome = COALESCE(public.company_workspace.chrome, '{}'::jsonb)
        || COALESCE(EXCLUDED.chrome, '{}'::jsonb),
      updated_at = now();

  PERFORM public.sa_merge_profile_metadata(p_company_id, COALESCE(p_chrome, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_get_module_store(
  p_company_id integer,
  p_module text
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data jsonb;
BEGIN
  SELECT data INTO row_data
  FROM public.company_module_stores
  WHERE company_id = p_company_id AND module = p_module;

  IF row_data IS NOT NULL THEN
    RETURN jsonb_build_object(p_module, row_data);
  END IF;

  RETURN public.sa_get_profile_metadata_keys(
    p_company_id,
    ARRAY[p_module]
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_put_module_store(
  p_company_id integer,
  p_module text,
  p_data jsonb,
  p_indexes jsonb DEFAULT '{}'::jsonb,
  p_public_token text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_module_stores (
    company_id, module, data, public_token, updated_at
  )
  VALUES (
    p_company_id,
    p_module,
    COALESCE(p_data, '{}'::jsonb),
    NULLIF(trim(COALESCE(p_public_token, '')), ''),
    now()
  )
  ON CONFLICT (company_id, module) DO UPDATE
    SET
      data = EXCLUDED.data,
      public_token = EXCLUDED.public_token,
      updated_at = now();

  PERFORM public.sa_merge_profile_metadata(
    p_company_id,
    jsonb_build_object(p_module, COALESCE(p_data, '{}'::jsonb))
      || COALESCE(p_indexes, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sa_merge_profile_metadata(integer, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_get_profile_metadata_keys(integer, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_get_company_chrome(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_put_company_chrome(integer, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_get_module_store(integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.sa_merge_profile_metadata(integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_get_profile_metadata_keys(integer, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_get_company_chrome(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_put_company_chrome(integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_get_module_store(integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sa_put_module_store(integer, text, jsonb, jsonb, text) TO service_role;
