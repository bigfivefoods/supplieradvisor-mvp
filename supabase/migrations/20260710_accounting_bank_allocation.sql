-- Bank statement import + GL allocation for management accounts.
-- Safe to re-run. Uses existing sa_add_column / sa_create_index (do not redefine).

-- ── Import batches ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_import_batches (
  id bigserial PRIMARY KEY,
  profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_account_id bigint NOT NULL,
  source text NOT NULL DEFAULT 'csv', -- csv | ofx | manual
  filename text,
  format_hint text, -- fnb | rmb | universal | auto
  row_count int DEFAULT 0,
  imported_count int DEFAULT 0,
  skipped_count int DEFAULT 0,
  duplicate_count int DEFAULT 0,
  imported_by text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('bank_import_batches', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_bank_import_profile', 'bank_import_batches', 'profile_id');

-- ── Bank transaction allocation columns ──────────────────────────────────────
SELECT public.sa_add_column('bank_transactions', 'import_batch_id', 'bigint');
SELECT public.sa_add_column('bank_transactions', 'external_id', 'text'); -- hash for dedupe
SELECT public.sa_add_column('bank_transactions', 'balance_after', 'numeric(18,2)');
SELECT public.sa_add_column('bank_transactions', 'allocation_status', 'text', '''unallocated''');
-- unallocated | allocated | matched_invoice | excluded
SELECT public.sa_add_column('bank_transactions', 'gl_account_id', 'bigint');
SELECT public.sa_add_column('bank_transactions', 'counterparty_name', 'text');
SELECT public.sa_add_column('bank_transactions', 'category', 'text');
SELECT public.sa_add_column('bank_transactions', 'tax_code', 'text');
SELECT public.sa_add_column('bank_transactions', 'tax_amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('bank_transactions', 'matched_invoice_id', 'bigint');
SELECT public.sa_add_column('bank_transactions', 'allocated_at', 'timestamptz');
SELECT public.sa_add_column('bank_transactions', 'allocated_by', 'text');
SELECT public.sa_add_column('bank_transactions', 'notes', 'text');

SELECT public.sa_create_index('idx_bank_txn_alloc', 'bank_transactions', 'profile_id, allocation_status');
SELECT public.sa_create_index('idx_bank_txn_external', 'bank_transactions', 'profile_id, external_id');
SELECT public.sa_create_index('idx_bank_txn_batch', 'bank_transactions', 'import_batch_id');

-- Link bank account to a cash/bank GL account for journals
SELECT public.sa_add_column('bank_accounts', 'last_import_at', 'timestamptz');
SELECT public.sa_add_column('bank_accounts', 'import_format', 'text'); -- preferred: fnb | universal

-- RLS transitional
DO $$
DECLARE
  rt text;
  pol_select text;
  pol_write text;
BEGIN
  FOREACH rt IN ARRAY ARRAY['bank_import_batches']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=rt) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', rt);
      pol_select := rt || '_select_all';
      pol_write := rt || '_write_all';
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_select, rt);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true)', pol_select, rt);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_write, rt);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
        pol_write, rt
      );
    END IF;
  END LOOP;
END $$;
