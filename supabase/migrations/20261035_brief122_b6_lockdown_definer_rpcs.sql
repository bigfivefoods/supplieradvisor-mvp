-- Brief 122 B6. Revoke anon and PUBLIC EXECUTE on six SECURITY DEFINER
-- functions. authenticated keeps EXECUTE only on user_has_access_to_profile
-- and get_current_user_id. service_role keeps EXECUTE on all six.
--
-- Production history (read 19 Oct 2026 from supabase_migrations.schema_migrations
-- on project onkklullmgrdqoertngp):
--   version 20261019105955
--   name    brief122_b6_lockdown_definer_rpcs
-- Repo filename 20261035 sorts after the B5 file. 20261035 is not a calendar
-- day. See
-- docs/db/2026-10-19-production-rollout.md.
--
-- Idempotent. REVOKE of a privilege that is already absent does nothing.
-- A function that does not exist in this database is skipped: the three
-- sa_nsnp_* functions are created by earlier migrations, and
-- user_has_access_to_profile, get_current_user_id, rls_auto_enable and the
-- ensure_rls event trigger are present on production but are not created by
-- this repo. When rls_auto_enable exists, ensure_rls must still be enabled,
-- which is the production guard.
--
-- Re-running 20260905_nsnp_hotpath_indexes.sql or 20260906_nsnp_scale.sql
-- (or RUN_NSNP_HOTPATH.sql) grants authenticated EXECUTE again. Do not paste
-- those grants after this file. Ordered replay still ends here.

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $guard$
DECLARE r record; deps int;
BEGIN
  FOR r IN
    SELECT p.oid, p.oid::regprocedure::text AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        'sa_nsnp_agency_summary',
        'sa_nsnp_geo_rollup',
        'sa_nsnp_network_ops',
        'user_has_access_to_profile',
        'get_current_user_id',
        'rls_auto_enable'
      )
  LOOP
    SELECT (
      SELECT count(*) FROM pg_policy pol
      WHERE pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%' || (SELECT proname FROM pg_proc WHERE oid = r.oid) || '%'
         OR pg_get_expr(pol.polwithcheck, pol.polrelid) ILIKE '%' || (SELECT proname FROM pg_proc WHERE oid = r.oid) || '%'
    ) + (
      SELECT count(*) FROM pg_depend d
      WHERE d.refobjid = r.oid
        AND d.deptype = 'n'
        AND d.classid IN (
          'pg_policy'::regclass,
          'pg_trigger'::regclass,
          'pg_rewrite'::regclass,
          'pg_proc'::regclass,
          'pg_attrdef'::regclass,
          'pg_constraint'::regclass
        )
    ) + (
      SELECT count(*) FROM pg_trigger t
      WHERE t.tgfoid = r.oid AND NOT t.tgisinternal
    ) + (
      SELECT count(*) FROM pg_proc p2
      WHERE p2.oid <> r.oid
        AND p2.pronamespace NOT IN ('pg_catalog'::regnamespace, 'information_schema'::regnamespace)
        AND p2.prosrc ILIKE '%' || (SELECT proname FROM pg_proc WHERE oid = r.oid) || '%'
    ) + (
      SELECT count(*) FROM pg_views v
      WHERE v.schemaname NOT IN ('pg_catalog', 'information_schema')
        AND v.definition ILIKE '%' || (SELECT proname FROM pg_proc WHERE oid = r.oid) || '%'
    )
    INTO deps;
    IF deps > 0 THEN
      RAISE EXCEPTION 'B6 guard: % has % dependent policy/trigger/view/function references, aborting (nothing changed)', r.sig, deps;
    END IF;
  END LOOP;

  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_event_trigger
      WHERE evtname = 'ensure_rls' AND evtenabled = 'O'
    ) THEN
      RAISE EXCEPTION 'B6 guard: ensure_rls event trigger missing or disabled, aborting';
    END IF;
  END IF;
END
$guard$;

DO $revoke$
BEGIN
  IF to_regprocedure('public.sa_nsnp_agency_summary(bigint)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.sa_nsnp_agency_summary(bigint) FROM PUBLIC;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE EXECUTE ON FUNCTION public.sa_nsnp_agency_summary(bigint) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE EXECUTE ON FUNCTION public.sa_nsnp_agency_summary(bigint) FROM authenticated;
    END IF;
  ELSE
    RAISE NOTICE 'B6: public.sa_nsnp_agency_summary(bigint) is absent, nothing to revoke';
  END IF;

  IF to_regprocedure('public.sa_nsnp_geo_rollup(bigint)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.sa_nsnp_geo_rollup(bigint) FROM PUBLIC;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE EXECUTE ON FUNCTION public.sa_nsnp_geo_rollup(bigint) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE EXECUTE ON FUNCTION public.sa_nsnp_geo_rollup(bigint) FROM authenticated;
    END IF;
  ELSE
    RAISE NOTICE 'B6: public.sa_nsnp_geo_rollup(bigint) is absent, nothing to revoke';
  END IF;

  IF to_regprocedure('public.sa_nsnp_network_ops(bigint, date)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.sa_nsnp_network_ops(bigint, date) FROM PUBLIC;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE EXECUTE ON FUNCTION public.sa_nsnp_network_ops(bigint, date) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE EXECUTE ON FUNCTION public.sa_nsnp_network_ops(bigint, date) FROM authenticated;
    END IF;
  ELSE
    RAISE NOTICE 'B6: public.sa_nsnp_network_ops(bigint, date) is absent, nothing to revoke';
  END IF;

  IF to_regprocedure('public.user_has_access_to_profile(bigint)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.user_has_access_to_profile(bigint) FROM PUBLIC;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE EXECUTE ON FUNCTION public.user_has_access_to_profile(bigint) FROM anon;
    END IF;
  ELSE
    RAISE NOTICE 'B6: public.user_has_access_to_profile(bigint) is absent, nothing to revoke';
  END IF;

  IF to_regprocedure('public.get_current_user_id()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.get_current_user_id() FROM PUBLIC;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE EXECUTE ON FUNCTION public.get_current_user_id() FROM anon;
    END IF;
  ELSE
    RAISE NOTICE 'B6: public.get_current_user_id() is absent, nothing to revoke';
  END IF;

  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
    END IF;
  ELSE
    RAISE NOTICE 'B6: public.rls_auto_enable() is absent, nothing to revoke';
  END IF;
END
$revoke$;

DO $post$
DECLARE bad text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE NOTICE 'B6 post-assert skipped: anon, authenticated, or service_role is missing';
    RETURN;
  END IF;

  SELECT string_agg(
    p.oid::regprocedure::text
      || ' anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
      || ' auth=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
      || ' svc=' || has_function_privilege('service_role', p.oid, 'EXECUTE'),
    '; '
  )
  INTO bad
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname IN (
      'sa_nsnp_agency_summary',
      'sa_nsnp_geo_rollup',
      'sa_nsnp_network_ops',
      'user_has_access_to_profile',
      'get_current_user_id',
      'rls_auto_enable'
    )
    AND (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
      OR (
        p.proname IN ('sa_nsnp_agency_summary', 'sa_nsnp_geo_rollup', 'sa_nsnp_network_ops', 'rls_auto_enable')
        AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
      OR (
        p.proname IN ('user_has_access_to_profile', 'get_current_user_id')
        AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
    );
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'B6 post-assert failed: %', bad;
  END IF;
END
$post$;
