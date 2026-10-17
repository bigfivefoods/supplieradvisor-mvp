-- Deletes rows for batch s1 only.
BEGIN;

CREATE TEMP TABLE loadtest_profile_ids ON COMMIT DROP AS
SELECT id FROM public.profiles WHERE metadata->>'loadtest' = 's1';

DELETE FROM public.journal_lines
WHERE profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.journal_entries
WHERE metadata->>'loadtest' = 's1'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.bank_transactions
WHERE metadata->>'loadtest' = 's1'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.bank_accounts
WHERE metadata->>'loadtest' = 's1'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.activity_log
WHERE metadata->>'loadtest' = 's1'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.stock_levels
WHERE profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.customer_invoices
WHERE notes = 'loadtest:s1'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.purchase_orders
WHERE metadata->>'loadtest' = 's1'
   OR buyer_profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.chart_of_accounts
WHERE metadata->>'loadtest' = 's1'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.products
WHERE metadata->>'loadtest' = 's1'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.customers
WHERE metadata->>'loadtest' = 's1'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.company_module_stores
WHERE data->>'loadtest' = 's1'
   OR company_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.business_connections
WHERE metadata->>'loadtest' = 's1'
   OR requester_profile_id IN (SELECT id FROM loadtest_profile_ids)
   OR requestee_profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.business_users
WHERE metadata->>'loadtest' = 's1'
   OR profile_id IN (SELECT id FROM loadtest_profile_ids);

DELETE FROM public.profiles
WHERE metadata->>'loadtest' = 's1';

COMMIT;

SELECT 'profiles' AS table_name, count(*) AS remaining
FROM public.profiles WHERE metadata->>'loadtest' = 's1';
