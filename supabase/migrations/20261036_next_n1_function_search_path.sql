-- Next hardening N1. Pin search_path on the 13 functions production set
-- on 19 Oct 2026, 13:36 SAST.
--
-- Production history (read 19 Oct 2026 from supabase_migrations.schema_migrations
-- on project onkklullmgrdqoertngp):
--   version 20261019113636
--   name    next_n1_function_search_path
-- Repo filename 20261036 sorts after 20261035_brief122_b6_lockdown_definer_rpcs.sql.
-- 20261036 is not a calendar day. The production 14-digit version cannot be
-- the filename. See
-- docs/db/2026-10-19-production-rollout.md.
--
-- ALTER FUNCTION has no IF EXISTS. A function that is not in this database
-- is skipped. record_onchain_attestation, sa_title_person_name,
-- site_insights_channel and update_updated_at_column exist on production and
-- are not created by this repo.
--
-- CREATE OR REPLACE without a SET clause clears proconfig. Older copies of
-- these functions now include SET search_path = public, pg_temp, so replaying
-- them does not make the path mutable again. This file still sets the path
-- on functions that already exist.

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $n1$
DECLARE
  sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'public.record_onchain_attestation()',
    'public.sa_add_column(text,text,text,text)',
    'public.sa_add_fk(text,text,text,text,text)',
    'public.sa_brief35_recode_party_gl(integer)',
    'public.sa_brief36_recode_member_rev(integer)',
    'public.sa_create_index(text,text,text)',
    'public.sa_merge_module_store_data(jsonb,jsonb)',
    'public.sa_module_store_array_has_id_object(jsonb)',
    'public.sa_module_store_is_tombstone(jsonb)',
    'public.sa_title_person_name(text)',
    'public.set_updated_at()',
    'public.site_insights_channel(text,text,text)',
    'public.update_updated_at_column()'
  ]
  LOOP
    IF to_regprocedure(sig) IS NULL THEN
      RAISE NOTICE 'N1 skip missing %', sig;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', sig);
  END LOOP;
END
$n1$;
