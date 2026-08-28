-- Brief 10 — list/hot-path indexes. Safe to re-run.

SET statement_timeout = 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'sa_lock_table' AND pg_function_is_visible(oid)
  ) THEN
    PERFORM public.sa_lock_table('customers');
    PERFORM public.sa_lock_table('srm_suppliers');
    PERFORM public.sa_lock_table('invoices');
    PERFORM public.sa_lock_table('journal_lines');
    PERFORM public.sa_lock_table('opportunities');
    PERFORM public.sa_lock_table('business_connections');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'sa_lock_table skip: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS customers_profile_trading_name
  ON customers (profile_id, trading_name);

CREATE INDEX IF NOT EXISTS srm_suppliers_profile_updated_desc
  ON srm_suppliers (profile_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS invoices_profile_direction_status_issue
  ON invoices (profile_id, direction, status, issue_date);

CREATE INDEX IF NOT EXISTS journal_lines_profile_account
  ON journal_lines (profile_id, account_id);

CREATE INDEX IF NOT EXISTS opportunities_profile_updated
  ON opportunities (profile_id, updated_at);

CREATE INDEX IF NOT EXISTS business_connections_requester_updated
  ON business_connections (requester_profile_id, updated_at);
