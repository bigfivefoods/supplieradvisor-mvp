-- Lock company rollup functions to the service role.
-- Paste this whole file into the Supabase SQL editor. Safe to re-run.
-- They take a company id and do not check the caller, so anon and
-- authenticated must not be able to execute them.
-- The Next.js API calls these with the service role after a membership check.

SET statement_timeout = 0;

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'sa_accounting_kpi_rollup',
        'sa_customers_hub_summary',
        'sa_suppliers_hub_summary',
        'sa_containers_hub_summary',
        'sa_dashboard_home_rollup'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      fn.proname,
      fn.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
      fn.proname,
      fn.args
    );
  END LOOP;
END $$;
