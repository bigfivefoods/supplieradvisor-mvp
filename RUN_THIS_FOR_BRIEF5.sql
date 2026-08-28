-- Brief 5: IFRS 15 — 2140 Customer deposits is a current contract liability.
-- Safe to re-run. Paste twin: RUN_THIS_FOR_BRIEF5.sql
-- No journal rewrite. Does not recode 4100 history (the app recodes on invoice issue).

SET statement_timeout = 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'sa_lock_table' AND pg_function_is_visible(oid)
  ) THEN
    PERFORM public.sa_lock_table('chart_of_accounts');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'sa_lock_table chart_of_accounts skip: %', SQLERRM;
END $$;

-- Label existing 2140 as IFRS 15 contract liability (current, not AP).
UPDATE public.chart_of_accounts c
SET
  name = 'Customer deposits',
  account_type = 'liability',
  subtype = 'current',
  normal_balance = 'credit',
  is_header = false,
  description = 'IFRS 15 contract liability: cash received before a sales invoice is issued. Applied to AR when the invoice is recognised. Current — presented next to trade payables, not mixed into AP leaves.',
  updated_at = now()
WHERE c.code = '2140';

-- Sit 2140 under 2100 Current liabilities when that header exists.
UPDATE public.chart_of_accounts c
SET parent_id = p.id, updated_at = now()
FROM public.chart_of_accounts p
WHERE c.code = '2140'
  AND p.profile_id = c.profile_id
  AND p.code = '2100'
  AND c.parent_id IS DISTINCT FROM p.id;
