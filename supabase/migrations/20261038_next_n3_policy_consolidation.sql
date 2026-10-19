-- Next hardening N3. Drop the eight no-op deny policies on products,
-- stock_levels, stock_movements and warehouses, and scope each allow-all
-- policy to service_role. Applied on production 19 Oct 2026, 13:39 SAST.
--
-- Production history (read 19 Oct 2026 from supabase_migrations.schema_migrations
-- on project onkklullmgrdqoertngp):
--   version 20261019113922
--   name    next_n3_policy_consolidation
-- Repo filename 20261038 sorts after 20261037_next_n2_fk_indexes.sql.
-- 20261038 is not a calendar day.
-- See docs/db/2026-10-19-production-rollout.md.
--
-- Permissive policies are OR-ed, so sa_deny_* USING (false) did nothing next
-- to *_all USING (true). Production dropped the deny policies and changed
-- each allow policy TO service_role.
--
-- Idempotent. DROP POLICY IF EXISTS. ALTER POLICY runs only when the allow
-- policy exists. A missing table is skipped. Other tables' sa_deny_* policies
-- are left alone.
--
-- 20260709_inventory_world_class.sql now creates the four allow policies
-- TO service_role. sa_lock_table no longer recreates sa_deny_* on these four
-- tables; it recreates the service_role allow policy instead.

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $n3$
DECLARE
  table_name text;
  allow_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['products', 'stock_levels', 'stock_movements', 'warehouses']
  LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN
      RAISE NOTICE 'N3 skip missing public.%', table_name;
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS sa_deny_anon ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS sa_deny_authenticated ON public.%I', table_name);
    allow_name := table_name || '_all';
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name AND policyname = allow_name
    ) THEN
      EXECUTE format('ALTER POLICY %I ON public.%I TO service_role', allow_name, table_name);
    ELSE
      RAISE NOTICE 'N3 skip missing policy % on public.%', allow_name, table_name;
    END IF;
  END LOOP;
END
$n3$;
