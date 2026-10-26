-- Supporting index for site_insights_explore's first-seen lookup.
--
-- Production built earlier foreign-key indexes with CREATE INDEX CONCURRENTLY,
-- one statement at a time, outside a transaction. This file is the repo copy
-- for fresh databases and CI. CONCURRENTLY cannot run inside the Supabase
-- CLI transaction (SQLSTATE 25001), so this statement is plain
-- CREATE INDEX IF NOT EXISTS. It locks site_insights_events until the
-- transaction commits, including when the index already exists.
--
-- On production, build it with CREATE INDEX CONCURRENTLY first, then mark
-- this version applied. Do not execute this file there. The statement is in
-- docs/db/2026-10-25-indexes-concurrently.sql. See
-- docs/db/2026-10-25-database-rollout.md.
--
-- 20261040 is not a calendar day. It sorts after
-- 20261039_next_n4_drop_business_users_backups.sql.

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

DO $idx$
BEGIN
  IF to_regclass('public.site_insights_events') IS NULL THEN
    RAISE NOTICE '20261040 skip missing public.site_insights_events';
    RETURN;
  END IF;
  EXECUTE $sql$
    CREATE INDEX IF NOT EXISTS site_insights_events_pageview_vid_ts_idx
      ON public.site_insights_events (site, vid, ts)
      WHERE kind = 'pageview' AND vid IS NOT NULL
  $sql$;
END
$idx$;
