-- Stop signed-in users calling the two SECURITY DEFINER helpers over the
-- Data API. Row level security policies that call them keep working.
--
-- Supabase advisor lint 0029 (authenticated_security_definer_function_executable):
--   public.get_current_user_id()
--   public.user_has_access_to_profile(bigint)
-- Both are SECURITY DEFINER and executable by authenticated, so PostgREST
-- exposes them at /rest/v1/rpc/. On 25 Oct 2026 no policy, view, or other
-- function called them. A policy still runs as the signed-in role, so that
-- role needs EXECUTE on whatever function the policy names.
--
-- This migration copies both helpers into app_private, which is not an
-- exposed Data API schema. Policies that name the public functions are
-- rewritten to app_private before EXECUTE is revoked from authenticated,
-- anon, and PUBLIC. service_role keeps EXECUTE on the public functions.
-- anon and authenticated keep EXECUTE on the app_private copies so a policy
-- can still call them. Do not add app_private to the project's exposed
-- schemas.
--
-- Needs Craig's approval before it is applied to production. It changes
-- which database roles can call these helpers. It does not change Privy,
-- JWT verification, or the app's auth code.
--
-- 20261043 is not a calendar day. It sorts after 20261042.
--
-- DROP/CREATE POLICY takes ACCESS EXCLUSIVE. Production has no matching
-- policies, so the rewrite loop changes nothing there. lock_timeout still
-- bounds the wait on any other database.

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

DO $need_auth$
BEGIN
  IF to_regnamespace('auth') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION '20261043 requires auth.uid()';
  END IF;
END
$need_auth$;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
COMMENT ON SCHEMA app_private IS
  'Helpers for RLS. Not an exposed Data API schema. Do not add it to the API schemas.';

CREATE OR REPLACE FUNCTION app_private.get_current_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('request.jwt.claims', true)::json->>'user_id'
  )::text;
$$;

CREATE OR REPLACE FUNCTION app_private.user_has_access_to_profile(p_profile_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM business_users
    WHERE user_id = auth.uid()::text
      AND profile_id = p_profile_id
  );
$$;

REVOKE ALL ON FUNCTION app_private.get_current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.user_has_access_to_profile(bigint) FROM PUBLIC;

DO $usage$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT USAGE ON SCHEMA app_private TO anon;
    GRANT EXECUTE ON FUNCTION app_private.get_current_user_id() TO anon;
    GRANT EXECUTE ON FUNCTION app_private.user_has_access_to_profile(bigint) TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT USAGE ON SCHEMA app_private TO authenticated;
    GRANT EXECUTE ON FUNCTION app_private.get_current_user_id() TO authenticated;
    GRANT EXECUTE ON FUNCTION app_private.user_has_access_to_profile(bigint) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA app_private TO service_role;
    GRANT EXECUTE ON FUNCTION app_private.get_current_user_id() TO service_role;
    GRANT EXECUTE ON FUNCTION app_private.user_has_access_to_profile(bigint) TO service_role;
  END IF;
END
$usage$;

DO $rewrite$
DECLARE
  pol record;
  new_qual text;
  new_check text;
  role_list text;
  cmd text;
  permissive text;
  using_sql text;
  check_sql text;
  replaced boolean;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('v', 'm')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND (
        pg_get_viewdef(c.oid) ILIKE '%get_current_user_id%'
        OR pg_get_viewdef(c.oid) ILIKE '%user_has_access_to_profile%'
      )
  ) THEN
    RAISE EXCEPTION '20261043: a view calls get_current_user_id or user_has_access_to_profile';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'app_private')
      AND p.prokind = 'f'
      AND p.proname NOT IN ('get_current_user_id', 'user_has_access_to_profile')
      AND (
        p.prosrc ILIKE '%get_current_user_id%'
        OR p.prosrc ILIKE '%user_has_access_to_profile%'
      )
  ) THEN
    RAISE EXCEPTION '20261043: a function calls get_current_user_id or user_has_access_to_profile';
  END IF;

  FOR pol IN
    SELECT
      n.nspname,
      c.relname,
      p.polname,
      p.polcmd,
      p.polpermissive,
      p.polroles,
      pg_get_expr(p.polqual, p.polrelid) AS qual,
      pg_get_expr(p.polwithcheck, p.polrelid) AS chk
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
  LOOP
    new_qual := pol.qual;
    new_check := pol.chk;
    -- \m and \M are word boundaries, so my_get_current_user_id is left
    -- alone. public. is replaced first. A later pass covers an unqualified
    -- name and a name that is already app_private., without doubling it.
    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, '\mpublic\.user_has_access_to_profile\M', 'app_private.user_has_access_to_profile', 'g');
      new_qual := regexp_replace(new_qual, '\mpublic\.get_current_user_id\M', 'app_private.get_current_user_id', 'g');
      new_qual := regexp_replace(new_qual, '\m(app_private\.)?user_has_access_to_profile\M', 'app_private.user_has_access_to_profile', 'g');
      new_qual := regexp_replace(new_qual, '\m(app_private\.)?get_current_user_id\M', 'app_private.get_current_user_id', 'g');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, '\mpublic\.user_has_access_to_profile\M', 'app_private.user_has_access_to_profile', 'g');
      new_check := regexp_replace(new_check, '\mpublic\.get_current_user_id\M', 'app_private.get_current_user_id', 'g');
      new_check := regexp_replace(new_check, '\m(app_private\.)?user_has_access_to_profile\M', 'app_private.user_has_access_to_profile', 'g');
      new_check := regexp_replace(new_check, '\m(app_private\.)?get_current_user_id\M', 'app_private.get_current_user_id', 'g');
    END IF;
    replaced := new_qual IS DISTINCT FROM pol.qual OR new_check IS DISTINCT FROM pol.chk;
    IF NOT replaced THEN
      CONTINUE;
    END IF;

    cmd := CASE pol.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      ELSE 'ALL'
    END;
    permissive := CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END;
    -- oid 0 is PUBLIC. It can sit beside named roles. pg_roles has no row
    -- for 0, so a join on polroles would drop PUBLIC from a mixed list.
    -- An empty role list is PUBLIC as well.
    SELECT string_agg(part, ', ' ORDER BY sort, part)
      INTO role_list
    FROM (
      SELECT 0 AS sort, 'PUBLIC'::text AS part
      WHERE pol.polroles IS NULL
         OR cardinality(pol.polroles) = 0
         OR 0 = ANY (pol.polroles)
      UNION ALL
      SELECT 1, quote_ident(r.rolname)
      FROM pg_roles r
      WHERE r.oid = ANY (pol.polroles)
    ) parts;
    IF role_list IS NULL OR role_list = '' THEN
      role_list := 'PUBLIC';
    END IF;
    using_sql := CASE WHEN new_qual IS NULL THEN '' ELSE format(' USING (%s)', new_qual) END;
    check_sql := CASE WHEN new_check IS NULL THEN '' ELSE format(' WITH CHECK (%s)', new_check) END;

    EXECUTE format('DROP POLICY %I ON %I.%I', pol.polname, pol.nspname, pol.relname);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      pol.polname,
      pol.nspname,
      pol.relname,
      permissive,
      cmd,
      role_list,
      using_sql,
      check_sql
    );
  END LOOP;
END
$rewrite$;

DO $revoke$
BEGIN
  IF to_regprocedure('public.get_current_user_id()') IS NULL THEN
    CREATE FUNCTION public.get_current_user_id()
    RETURNS text
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path TO public
    AS $body$
      SELECT COALESCE(
        current_setting('request.jwt.claims', true)::json->>'sub',
        current_setting('request.jwt.claims', true)::json->>'user_id'
      )::text;
    $body$;
  END IF;
  IF to_regprocedure('public.user_has_access_to_profile(bigint)') IS NULL THEN
    CREATE FUNCTION public.user_has_access_to_profile(p_profile_id bigint)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path TO public
    AS $body$
      SELECT EXISTS (
        SELECT 1
        FROM business_users
        WHERE user_id = auth.uid()::text
          AND profile_id = p_profile_id
      );
    $body$;
  END IF;

  REVOKE ALL ON FUNCTION public.get_current_user_id() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.user_has_access_to_profile(bigint) FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.get_current_user_id() FROM anon;
    REVOKE ALL ON FUNCTION public.user_has_access_to_profile(bigint) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.get_current_user_id() FROM authenticated;
    REVOKE ALL ON FUNCTION public.user_has_access_to_profile(bigint) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.get_current_user_id() TO service_role;
    GRANT EXECUTE ON FUNCTION public.user_has_access_to_profile(bigint) TO service_role;
  END IF;
END
$revoke$;

COMMENT ON FUNCTION public.get_current_user_id() IS
  'SECURITY DEFINER helper. Not callable by anon or authenticated. Policies use app_private.get_current_user_id().';
COMMENT ON FUNCTION public.user_has_access_to_profile(bigint) IS
  'SECURITY DEFINER helper. Not callable by anon or authenticated. Policies use app_private.user_has_access_to_profile(bigint).';

DO $assert$
DECLARE bad text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE NOTICE '20261043 assert skipped: roles are missing';
    RETURN;
  END IF;

  SELECT string_agg(item, '; ')
  INTO bad
  FROM (
    SELECT 'public.get_current_user_id auth=' || has_function_privilege('authenticated', 'public.get_current_user_id()', 'EXECUTE') AS item
    WHERE has_function_privilege('authenticated', 'public.get_current_user_id()', 'EXECUTE')
       OR has_function_privilege('anon', 'public.get_current_user_id()', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.get_current_user_id()', 'EXECUTE')
    UNION ALL
    SELECT 'public.user_has_access_to_profile auth=' || has_function_privilege('authenticated', 'public.user_has_access_to_profile(bigint)', 'EXECUTE')
    WHERE has_function_privilege('authenticated', 'public.user_has_access_to_profile(bigint)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.user_has_access_to_profile(bigint)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.user_has_access_to_profile(bigint)', 'EXECUTE')
    UNION ALL
    SELECT 'app_private.get_current_user_id missing auth execute'
    WHERE NOT has_function_privilege('authenticated', 'app_private.get_current_user_id()', 'EXECUTE')
    UNION ALL
    SELECT 'app_private.user_has_access_to_profile missing auth execute'
    WHERE NOT has_function_privilege('authenticated', 'app_private.user_has_access_to_profile(bigint)', 'EXECUTE')
  ) s;

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '20261043 assert failed: %', bad;
  END IF;
END
$assert$;
