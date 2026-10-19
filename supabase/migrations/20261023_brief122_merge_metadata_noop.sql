-- Brief 122 B4. Skip the profiles rewrite inside sa_merge_profile_metadata
-- when the patch does not change any stored value.
--
-- Staging measurement (not re-run by this file): saving a module store goes
-- lib/business/company-data.ts saveModuleSlice() into
-- sa_put_module_store(p_company_id, p_module, p_data, p_indexes, p_public_token,
-- p_if_updated_at). That RPC takes pg_advisory_xact_lock, locks and rewrites
-- company_module_stores, and, only when index keys are passed, calls
-- sa_merge_profile_metadata(p_company_id, idx). sa_module_index_patch keeps
-- only keys named <module>_*_token / <module>_*_tokens, so only the token
-- index is mirrored into profiles.metadata. The previous body always ran
-- UPDATE profiles SET metadata = metadata || patch, updated_at = now(),
-- even when nothing changed. Postgres wrote a new version of the 135-column
-- row and touched up to 47 indexes (3,401 WAL bytes per call, against 901
-- for a HOT-eligible update).
--
-- ApparelAdvisor® and ConstructionAdvisor® public token routes
-- (app/api/public/apparelgraph/route.ts, app/api/public/constructiongraph/route.ts),
-- lib/advisors/member-pwa.ts, and the 19 partial indexes
-- idx_profiles_*_public_token / idx_profiles_*_tokens read that mirror.
-- A real token change must still be written.
--
-- Equality is per key:
--   (metadata -> k) IS NOT DISTINCT FROM (patch -> k)
-- for each key in the patch. jsonb containment (@>) is the wrong test: a
-- smaller *_tokens map is contained in the stored map, so removing a token
-- would be skipped.
--
-- Null, jsonb null, and {} write nothing and do not bump profiles.updated_at.
-- A token-only patch that does change a value updates metadata and does not
-- set updated_at. A patch that includes any other key still sets
-- updated_at = now(), including sa_put_company_chrome.
--
-- Signature, SECURITY DEFINER, search_path, and the service_role-only
-- EXECUTE grant stay as they were in 20260821_saas_db_harden.sql.
-- sa_put_module_store and sa_module_index_patch are unchanged.
-- This file is the migration. Applying it to a database is a separate approval.

CREATE OR REPLACE FUNCTION public.sa_merge_profile_metadata(
  p_company_id integer,
  p_patch jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  patch jsonb := CASE
    WHEN p_patch IS NULL OR jsonb_typeof(p_patch) = 'null' THEN '{}'::jsonb
    ELSE p_patch
  END;
  token_only boolean;
BEGIN
  IF p_company_id IS NULL OR p_company_id <= 0 THEN
    RAISE EXCEPTION 'company id required';
  END IF;

  IF patch = '{}'::jsonb THEN
    RETURN;
  END IF;

  IF jsonb_typeof(patch) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'metadata patch must be a json object';
  END IF;

  SELECT COALESCE(bool_and(
    e.k LIKE '%\_token' ESCAPE '\'
    OR e.k LIKE '%\_tokens' ESCAPE '\'
  ), false)
  INTO token_only
  FROM jsonb_each(patch) AS e(k, v);

  -- (metadata -> k) IS NOT DISTINCT FROM (patch -> k) for every patch key.
  -- Not containment: a removed token inside a *_tokens map must still write.
  IF token_only THEN
    UPDATE public.profiles AS p
    SET metadata = COALESCE(p.metadata, '{}'::jsonb) || patch
    WHERE p.id = p_company_id
      AND NOT (
        SELECT COALESCE(bool_and(
          (COALESCE(p.metadata, '{}'::jsonb) -> e.k) IS NOT DISTINCT FROM (patch -> e.k)
        ), true)
        FROM jsonb_each(patch) AS e(k, v)
      );
  ELSE
    UPDATE public.profiles AS p
    SET
      metadata = COALESCE(p.metadata, '{}'::jsonb) || patch,
      updated_at = now()
    WHERE p.id = p_company_id
      AND NOT (
        SELECT COALESCE(bool_and(
          (COALESCE(p.metadata, '{}'::jsonb) -> e.k) IS NOT DISTINCT FROM (patch -> e.k)
        ), true)
        FROM jsonb_each(patch) AS e(k, v)
      );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.sa_merge_profile_metadata(integer, jsonb) IS
  'Merge patch keys into profiles.metadata. Skips the UPDATE when every patch key already holds an equal value, compared per key with IS NOT DISTINCT FROM. Token-only writes do not bump updated_at.';

REVOKE ALL ON FUNCTION public.sa_merge_profile_metadata(integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sa_merge_profile_metadata(integer, jsonb) TO service_role;

-- Rollback: restore the previous body from 20260821_saas_db_harden.sql.
-- Keep the REVOKE / GRANT above. Do not grant anon, authenticated, or PUBLIC.
--
-- CREATE OR REPLACE FUNCTION public.sa_merge_profile_metadata(
--   p_company_id integer,
--   p_patch jsonb
-- ) RETURNS void
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $$
-- BEGIN
--   IF p_company_id IS NULL OR p_company_id <= 0 THEN
--     RAISE EXCEPTION 'company id required';
--   END IF;
--   UPDATE public.profiles
--   SET
--     metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_patch, '{}'::jsonb),
--     updated_at = now()
--   WHERE id = p_company_id;
-- END;
-- $$;
--
-- COMMENT ON FUNCTION public.sa_merge_profile_metadata(integer, jsonb) IS
--   'Atomic metadata merge: only keys in the patch are overwritten. Concurrent module writes no longer clobber each other.';

NOTIFY pgrst, 'reload schema';
