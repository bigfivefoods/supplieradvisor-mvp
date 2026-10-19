-- Next hardening N4. Drop the two business_users backup tables.
-- Applied on production 19 Oct 2026, 14:20 SAST.
--
-- Production history (read 19 Oct 2026 from supabase_migrations.schema_migrations
-- on project onkklullmgrdqoertngp):
--   version 20261019122057
--   name    next_n4_drop_business_users_backups
-- Repo filename 20261039 sorts after 20261038_next_n3_policy_consolidation.sql.
-- 20261039 is not a calendar day. See docs/db/2026-10-19-production-rollout.md.
--
-- Production dropped public.business_users_backup and
-- public.business_users_final_backup. It did not move them to another schema.
-- public.business_users stays. These two backup tables are not created by
-- repo SQL.
--
-- The drop runs only when both tables are already absent, or both existing
-- tables are empty, or the session has set
-- brief122.acknowledge_business_users_backup_drop = on.
-- If either table still has rows and that setting is not on, this file
-- raises and drops nothing. Do not execute it on production: mark version
-- 20261039 applied with migration repair. See the docs file.

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $n4$
DECLARE
  rel text;
  nrows bigint;
  nonempty text := '';
  acknowledge text := current_setting('brief122.acknowledge_business_users_backup_drop', true);
BEGIN
  IF to_regclass('public.business_users_backup') IS NULL
     AND to_regclass('public.business_users_final_backup') IS NULL THEN
    RAISE NOTICE 'N4 skip: both backup tables are already absent';
    RETURN;
  END IF;

  FOREACH rel IN ARRAY ARRAY['business_users_backup', 'business_users_final_backup']
  LOOP
    IF to_regclass('public.' || rel) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('SELECT count(*) FROM public.%I', rel) INTO nrows;
    IF nrows > 0 THEN
      nonempty := nonempty || rel || '=' || nrows::text || ' ';
    END IF;
  END LOOP;

  IF nonempty <> '' AND coalesce(acknowledge, '') IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION
      'N4 refusing to drop business_users backup tables that still have rows (%). Set brief122.acknowledge_business_users_backup_drop to on to acknowledge the drop.',
      btrim(nonempty);
  END IF;

  IF nonempty <> '' THEN
    RAISE NOTICE
      'N4 dropping non-empty backup tables because brief122.acknowledge_business_users_backup_drop=on (%)',
      btrim(nonempty);
  END IF;

  EXECUTE 'DROP TABLE IF EXISTS public.business_users_backup';
  EXECUTE 'DROP TABLE IF EXISTS public.business_users_final_backup';
END
$n4$;
