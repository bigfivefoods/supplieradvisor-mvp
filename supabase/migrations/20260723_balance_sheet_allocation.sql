-- Balance sheet allocation: fixed assets & liabilities linked to cost objects + GL capitalisation.
-- Ensures PPE, inventory, AP, accruals etc. land on BS with dimensions. Safe to re-run.

-- ── fixed_assets: cost objects + capitalisation tracking ─────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fixed_assets'
  ) THEN
    ALTER TABLE public.fixed_assets
      ADD COLUMN IF NOT EXISTS business_unit_id bigint;
    ALTER TABLE public.fixed_assets
      ADD COLUMN IF NOT EXISTS work_center_id bigint;
    ALTER TABLE public.fixed_assets
      ADD COLUMN IF NOT EXISTS work_station_id bigint;
    ALTER TABLE public.fixed_assets
      ADD COLUMN IF NOT EXISTS manufacturing_asset_id bigint;
    ALTER TABLE public.fixed_assets
      ADD COLUMN IF NOT EXISTS capitalization_journal_id bigint;
    ALTER TABLE public.fixed_assets
      ADD COLUMN IF NOT EXISTS capitalized_at timestamptz;
    ALTER TABLE public.fixed_assets
      ADD COLUMN IF NOT EXISTS last_depreciation_journal_id bigint;
    ALTER TABLE public.fixed_assets
      ADD COLUMN IF NOT EXISTS code text;
    -- alias some codebases use `code` instead of asset_code
    CREATE INDEX IF NOT EXISTS idx_fa_bu
      ON public.fixed_assets (business_unit_id)
      WHERE business_unit_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_fa_wc
      ON public.fixed_assets (work_center_id)
      WHERE work_center_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_fa_mfg
      ON public.fixed_assets (manufacturing_asset_id)
      WHERE manufacturing_asset_id IS NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.fixed_assets.business_unit_id IS
  'Cost allocation for BS / depreciation — manufacturing business unit.';
COMMENT ON COLUMN public.fixed_assets.capitalization_journal_id IS
  'GL journal that capitalised purchase cost onto PPE (balance sheet).';
COMMENT ON COLUMN public.fixed_assets.capitalized_at IS
  'When asset was posted to balance sheet (Dr PPE / Cr AP or equity).';

-- Soft FKs to manufacturing cost objects
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manufacturing_business_units'
  ) THEN
    BEGIN
      ALTER TABLE public.fixed_assets
        DROP CONSTRAINT IF EXISTS fixed_assets_business_unit_id_fkey;
      ALTER TABLE public.fixed_assets
        ADD CONSTRAINT fixed_assets_business_unit_id_fkey
        FOREIGN KEY (business_unit_id)
        REFERENCES public.manufacturing_business_units(id) ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manufacturing_work_centers'
  ) THEN
    BEGIN
      ALTER TABLE public.fixed_assets
        DROP CONSTRAINT IF EXISTS fixed_assets_work_center_id_fkey;
      ALTER TABLE public.fixed_assets
        ADD CONSTRAINT fixed_assets_work_center_id_fkey
        FOREIGN KEY (work_center_id)
        REFERENCES public.manufacturing_work_centers(id) ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manufacturing_work_stations'
  ) THEN
    BEGIN
      ALTER TABLE public.fixed_assets
        DROP CONSTRAINT IF EXISTS fixed_assets_work_station_id_fkey;
      ALTER TABLE public.fixed_assets
        ADD CONSTRAINT fixed_assets_work_station_id_fkey
        FOREIGN KEY (work_station_id)
        REFERENCES public.manufacturing_work_stations(id) ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

-- ── Optional liability register (loans, deposits, other BS liabilities) ──────
CREATE TABLE IF NOT EXISTS public.accounting_liabilities (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text,
  name text NOT NULL,
  liability_type text NOT NULL DEFAULT 'other',
  -- payable | loan | deposit | accrued | lease | tax | other
  is_current boolean NOT NULL DEFAULT true,
  principal numeric(18,2) NOT NULL DEFAULT 0,
  outstanding numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  counterparty text,
  start_date date,
  maturity_date date,
  interest_rate_pct numeric(8,4),
  gl_liability_account_id bigint,
  business_unit_id bigint,
  work_center_id bigint,
  work_station_id bigint,
  asset_id bigint,
  purchase_order_id bigint,
  capitalization_journal_id bigint,
  capitalized_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  -- active | settled | written_off
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acct_liab_profile
  ON public.accounting_liabilities (profile_id);
CREATE INDEX IF NOT EXISTS idx_acct_liab_status
  ON public.accounting_liabilities (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_acct_liab_bu
  ON public.accounting_liabilities (business_unit_id)
  WHERE business_unit_id IS NOT NULL;

COMMENT ON TABLE public.accounting_liabilities IS
  'Register of loans, deposits, and other liabilities allocated to BS + cost objects.';

-- ── journal_lines already have cost dims (20260720_po_cost_allocation) ───────
-- Ensure columns exist if that migration was skipped
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'journal_lines'
  ) THEN
    ALTER TABLE public.journal_lines
      ADD COLUMN IF NOT EXISTS business_unit_id bigint;
    ALTER TABLE public.journal_lines
      ADD COLUMN IF NOT EXISTS work_center_id bigint;
    ALTER TABLE public.journal_lines
      ADD COLUMN IF NOT EXISTS work_station_id bigint;
    ALTER TABLE public.journal_lines
      ADD COLUMN IF NOT EXISTS asset_id bigint;
    ALTER TABLE public.journal_lines
      ADD COLUMN IF NOT EXISTS purchase_order_id bigint;
    ALTER TABLE public.journal_lines
      ADD COLUMN IF NOT EXISTS fixed_asset_id bigint;
    ALTER TABLE public.journal_lines
      ADD COLUMN IF NOT EXISTS liability_id bigint;
  END IF;
END $$;

COMMENT ON COLUMN public.journal_lines.fixed_asset_id IS
  'Link journal line to fixed_assets register for BS allocation.';
COMMENT ON COLUMN public.journal_lines.liability_id IS
  'Link journal line to accounting_liabilities register for BS allocation.';
