-- Indexes for the six foreign keys the performance advisor still reports
-- as unindexed on production (observed 25 Oct 2026):
--   industries.parent_id
--   nsnp_isp_sla.school_profile_id
--   nsnp_prize_awards.period_id
--   nsnp_prize_certificates.period_id
--   onchain_attestations.attested_by
--   products.category_id
--
-- Production must build each one with CREATE INDEX CONCURRENTLY, one
-- statement at a time, outside a transaction. Those statements are in
-- docs/db/2026-10-25-indexes-concurrently.sql. This file is the repo copy
-- for a fresh database. CONCURRENTLY cannot run inside the CLI transaction
-- (SQLSTATE 25001). CREATE INDEX IF NOT EXISTS is legal here and still
-- locks each table until commit, including when the index already exists.
-- Do not execute this file on production. Mark 20261044 applied after the
-- six CONCURRENTLY statements. See docs/db/2026-10-25-database-rollout.md.
--
-- A missing table is skipped. These tables are not all created by
-- supabase/migrations; they exist on production.
--
-- 20261044 is not a calendar day. It sorts after 20261043.
-- None of the 723 advisor "unused" indexes are dropped here.

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

DO $fk$
DECLARE
  spec text;
  index_name text;
  table_name text;
  column_name text;
BEGIN
  FOREACH spec IN ARRAY ARRAY[
    'idx_industries_parent_id|industries|parent_id',
    'idx_nsnp_isp_sla_school_profile_id|nsnp_isp_sla|school_profile_id',
    'idx_nsnp_prize_awards_period_id|nsnp_prize_awards|period_id',
    'idx_nsnp_prize_certificates_period_id|nsnp_prize_certificates|period_id',
    'idx_onchain_attestations_attested_by|onchain_attestations|attested_by',
    'idx_products_category_id|products|category_id'
  ]
  LOOP
    index_name := split_part(spec, '|', 1);
    table_name := split_part(spec, '|', 2);
    column_name := split_part(spec, '|', 3);
    IF to_regclass('public.' || table_name) IS NULL THEN
      RAISE NOTICE '20261044 skip missing public.%', table_name;
      CONTINUE;
    END IF;
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)',
      index_name, table_name, column_name
    );
  END LOOP;
END
$fk$;
