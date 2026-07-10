-- Align legacy bank_transactions (UUID id, tx_date) with accounting import/allocation.
-- Safe to re-run. Production previously only had tx_date / no bank_account_id.

SELECT public.sa_add_column('bank_transactions', 'bank_account_id', 'bigint');
SELECT public.sa_add_column('bank_transactions', 'txn_date', 'date');
SELECT public.sa_add_column('bank_transactions', 'reference', 'text');
SELECT public.sa_add_column('bank_transactions', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('bank_transactions', 'status', 'text', '''unreconciled''');
SELECT public.sa_add_column('bank_transactions', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('bank_transactions', 'matched_payment_id', 'bigint');
SELECT public.sa_add_column('bank_transactions', 'matched_journal_id', 'bigint');
SELECT public.sa_add_column('bank_transactions', 'updated_at', 'timestamptz', 'now()');

SELECT public.sa_create_index('idx_bank_txn_account', 'bank_transactions', 'bank_account_id');
SELECT public.sa_create_index('idx_bank_txn_status', 'bank_transactions', 'profile_id, status');

-- Backfill modern date column from legacy timestamp
UPDATE public.bank_transactions
SET txn_date = (tx_date AT TIME ZONE 'UTC')::date
WHERE txn_date IS NULL AND tx_date IS NOT NULL;

UPDATE public.bank_transactions
SET status = COALESCE(status, 'unreconciled')
WHERE status IS NULL;

UPDATE public.bank_transactions
SET allocation_status = COALESCE(allocation_status, 'unallocated')
WHERE allocation_status IS NULL;
