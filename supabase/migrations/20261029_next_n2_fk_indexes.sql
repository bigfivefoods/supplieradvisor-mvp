-- Next hardening N2. The seven foreign-key indexes built on production
-- on 19 Oct 2026, 13:37–13:38 SAST.
--
-- Production built each index with CREATE INDEX CONCURRENTLY, one statement
-- at a time, outside a transaction. Those statements are not rows in
-- supabase_migrations.schema_migrations. This file is the repo copy.
--
-- CONCURRENTLY is omitted on purpose. Supabase migration tooling applies a
-- file inside one transaction, and CREATE INDEX CONCURRENTLY cannot run
-- there (SQLSTATE 25001). CREATE INDEX IF NOT EXISTS is legal in a
-- transaction. Where the index already exists it does nothing, so this file
-- does not rebuild production's indexes.
--
-- Repo filename 20261029 sorts after 20261028_next_n1_function_search_path.sql.
-- See docs/db/2026-10-19-production-rollout.md.
--
-- A table that is not in this database is skipped with a notice. These seven
-- tables are not all created by supabase/migrations; they do exist on
-- production.
--
-- Not created. Production left these six foreign keys unindexed:
--   nsnp_prize_awards.period_id
--   nsnp_prize_certificates.period_id
--   nsnp_isp_sla.school_profile_id
--   products.category_id
--   industries.parent_id
--   onchain_attestations.attested_by

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $n2$
DECLARE
  spec text;
  index_name text;
  table_name text;
  column_name text;
BEGIN
  FOREACH spec IN ARRAY ARRAY[
    'idx_site_traffic_daily_company_id|site_traffic_daily|company_id',
    'idx_site_traffic_sites_company_id|site_traffic_sites|company_id',
    'idx_site_insights_portal_activity_company_id|site_insights_portal_activity|company_id',
    'idx_fg_portal_invites_company_id|fg_portal_invites|company_id',
    'idx_fg_portal_sessions_company_id|fg_portal_sessions|company_id',
    'idx_recover_portal_otps_company_id|recover_portal_otps|company_id',
    'idx_nsnp_prize_awards_school_profile_id|nsnp_prize_awards|school_profile_id'
  ]
  LOOP
    index_name := split_part(spec, '|', 1);
    table_name := split_part(spec, '|', 2);
    column_name := split_part(spec, '|', 3);
    IF to_regclass('public.' || table_name) IS NULL THEN
      RAISE NOTICE 'N2 skip missing public.%', table_name;
      CONTINUE;
    END IF;
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)',
      index_name, table_name, column_name
    );
  END LOOP;
END
$n2$;
