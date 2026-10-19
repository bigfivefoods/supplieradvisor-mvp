-- Next hardening N4. Drop the two business_users backup tables.
-- Applied on production 19 Oct 2026, 14:20 SAST.
--
-- Production history (read 19 Oct 2026 from supabase_migrations.schema_migrations
-- on project onkklullmgrdqoertngp):
--   version 20261019122057
--   name    next_n4_drop_business_users_backups
-- Repo filename 20261031 sorts after 20261030_next_n3_policy_consolidation.sql.
-- See docs/db/2026-10-19-production-rollout.md.
--
-- Production dropped public.business_users_backup and
-- public.business_users_final_backup. It did not move them to another schema.
-- public.business_users stays. These two backup tables are not created by
-- repo SQL. DROP TABLE IF EXISTS is a no-op when they are already gone.

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DROP TABLE IF EXISTS public.business_users_backup;
DROP TABLE IF EXISTS public.business_users_final_backup;
