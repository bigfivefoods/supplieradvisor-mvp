-- Production index build for 26 Oct 2026. Scratch or production psql only.
-- Do not wrap this file in a transaction. CREATE INDEX CONCURRENTLY cannot
-- run inside one (SQLSTATE 25001). psql's default autocommit runs one
-- statement at a time. Run them in this order, and wait for each to finish
-- before the next. Do not run them together.
--
-- After the pageview index succeeds, mark 20261040 applied.
-- After the six foreign-key indexes succeed, mark 20261044 applied.
-- The repair commands are in docs/db/2026-10-25-database-rollout.md.
-- This file does not run those commands.

-- 1. site_insights_events. Supports the explore report's pageview lookup.
CREATE INDEX CONCURRENTLY IF NOT EXISTS site_insights_events_pageview_vid_ts_idx
  ON public.site_insights_events (site, vid, ts)
  WHERE kind = 'pageview' AND vid IS NOT NULL;

-- 2. industries.parent_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_industries_parent_id
  ON public.industries (parent_id);

-- 3. nsnp_isp_sla.school_profile_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nsnp_isp_sla_school_profile_id
  ON public.nsnp_isp_sla (school_profile_id);

-- 4. nsnp_prize_awards.period_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nsnp_prize_awards_period_id
  ON public.nsnp_prize_awards (period_id);

-- 5. nsnp_prize_certificates.period_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nsnp_prize_certificates_period_id
  ON public.nsnp_prize_certificates (period_id);

-- 6. onchain_attestations.attested_by
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onchain_attestations_attested_by
  ON public.onchain_attestations (attested_by);

-- 7. products.category_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_id
  ON public.products (category_id);
