-- Link manufacturing cost structure to Chart of Accounts / journals / fixed assets.
-- Safe to re-run.

-- Cost entries → GL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manufacturing_cost_entries'
  ) THEN
    ALTER TABLE public.manufacturing_cost_entries
      ADD COLUMN IF NOT EXISTS gl_account_id bigint;
    ALTER TABLE public.manufacturing_cost_entries
      ADD COLUMN IF NOT EXISTS journal_entry_id bigint;
    CREATE INDEX IF NOT EXISTS idx_mfg_cost_journal
      ON public.manufacturing_cost_entries (journal_entry_id)
      WHERE journal_entry_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_mfg_cost_gl
      ON public.manufacturing_cost_entries (gl_account_id)
      WHERE gl_account_id IS NOT NULL;
  END IF;
END $$;

-- Cost object default GL expense accounts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manufacturing_business_units'
  ) THEN
    ALTER TABLE public.manufacturing_business_units
      ADD COLUMN IF NOT EXISTS gl_expense_account_id bigint;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manufacturing_work_centers'
  ) THEN
    ALTER TABLE public.manufacturing_work_centers
      ADD COLUMN IF NOT EXISTS gl_expense_account_id bigint;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manufacturing_work_stations'
  ) THEN
    ALTER TABLE public.manufacturing_work_stations
      ADD COLUMN IF NOT EXISTS gl_expense_account_id bigint;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manufacturing_assets'
  ) THEN
    ALTER TABLE public.manufacturing_assets
      ADD COLUMN IF NOT EXISTS gl_asset_account_id bigint;
    ALTER TABLE public.manufacturing_assets
      ADD COLUMN IF NOT EXISTS gl_depr_account_id bigint;
    ALTER TABLE public.manufacturing_assets
      ADD COLUMN IF NOT EXISTS gl_expense_account_id bigint;
    ALTER TABLE public.manufacturing_assets
      ADD COLUMN IF NOT EXISTS fixed_asset_id bigint;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manufacturing_production_orders'
  ) THEN
    ALTER TABLE public.manufacturing_production_orders
      ADD COLUMN IF NOT EXISTS labor_journal_entry_id bigint;
  END IF;
END $$;

COMMENT ON COLUMN public.manufacturing_cost_entries.journal_entry_id IS
  'Posted GL journal_entries.id for this manufacturing cost.';
COMMENT ON COLUMN public.manufacturing_cost_entries.gl_account_id IS
  'Debit expense/COGS account used on the journal.';
