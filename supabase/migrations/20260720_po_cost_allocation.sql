-- Purchase order cost allocation → manufacturing cost objects + journal dimensions.
-- Raise POs against business units, work centres, stations, assets; post GL with dims.
-- Safe to re-run.

-- ── purchase_orders: cost object FKs + allocation tracking ───────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
  ) THEN
    ALTER TABLE public.purchase_orders
      ADD COLUMN IF NOT EXISTS business_unit_id bigint;
    ALTER TABLE public.purchase_orders
      ADD COLUMN IF NOT EXISTS work_center_id bigint;
    ALTER TABLE public.purchase_orders
      ADD COLUMN IF NOT EXISTS work_station_id bigint;
    ALTER TABLE public.purchase_orders
      ADD COLUMN IF NOT EXISTS asset_id bigint;
    ALTER TABLE public.purchase_orders
      ADD COLUMN IF NOT EXISTS cost_category text DEFAULT 'materials';
    -- operating | labour | energy | maintenance | depreciation | materials | overhead | other
    ALTER TABLE public.purchase_orders
      ADD COLUMN IF NOT EXISTS cost_allocations jsonb DEFAULT '[]'::jsonb;
    -- optional multi-split: [{business_unit_id, work_center_id, work_station_id, asset_id, pct, amount?}]
    ALTER TABLE public.purchase_orders
      ADD COLUMN IF NOT EXISTS gl_account_id bigint;
    ALTER TABLE public.purchase_orders
      ADD COLUMN IF NOT EXISTS cost_entry_id bigint;
    ALTER TABLE public.purchase_orders
      ADD COLUMN IF NOT EXISTS cost_journal_entry_id bigint;
    ALTER TABLE public.purchase_orders
      ADD COLUMN IF NOT EXISTS cost_allocated_at timestamptz;

    CREATE INDEX IF NOT EXISTS idx_po_cost_bu
      ON public.purchase_orders (business_unit_id)
      WHERE business_unit_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_po_cost_wc
      ON public.purchase_orders (work_center_id)
      WHERE work_center_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_po_cost_ws
      ON public.purchase_orders (work_station_id)
      WHERE work_station_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_po_cost_asset
      ON public.purchase_orders (asset_id)
      WHERE asset_id IS NOT NULL;
  END IF;
END $$;

-- Soft FKs when manufacturing tables exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manufacturing_business_units'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'business_unit_id'
  ) THEN
    BEGIN
      ALTER TABLE public.purchase_orders
        DROP CONSTRAINT IF EXISTS purchase_orders_business_unit_id_fkey;
      ALTER TABLE public.purchase_orders
        ADD CONSTRAINT purchase_orders_business_unit_id_fkey
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
      ALTER TABLE public.purchase_orders
        DROP CONSTRAINT IF EXISTS purchase_orders_work_center_id_fkey;
      ALTER TABLE public.purchase_orders
        ADD CONSTRAINT purchase_orders_work_center_id_fkey
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
      ALTER TABLE public.purchase_orders
        DROP CONSTRAINT IF EXISTS purchase_orders_work_station_id_fkey;
      ALTER TABLE public.purchase_orders
        ADD CONSTRAINT purchase_orders_work_station_id_fkey
        FOREIGN KEY (work_station_id)
        REFERENCES public.manufacturing_work_stations(id) ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manufacturing_assets'
  ) THEN
    BEGIN
      ALTER TABLE public.purchase_orders
        DROP CONSTRAINT IF EXISTS purchase_orders_asset_id_fkey;
      ALTER TABLE public.purchase_orders
        ADD CONSTRAINT purchase_orders_asset_id_fkey
        FOREIGN KEY (asset_id)
        REFERENCES public.manufacturing_assets(id) ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

COMMENT ON COLUMN public.purchase_orders.business_unit_id IS
  'Cost allocation: manufacturing business unit / plant.';
COMMENT ON COLUMN public.purchase_orders.work_center_id IS
  'Cost allocation: work centre / cell.';
COMMENT ON COLUMN public.purchase_orders.work_station_id IS
  'Cost allocation: work station / line position.';
COMMENT ON COLUMN public.purchase_orders.asset_id IS
  'Cost allocation: manufacturing asset (machine, tool, etc.).';
COMMENT ON COLUMN public.purchase_orders.cost_allocations IS
  'Optional multi-way split of PO cost across cost objects (pct or amount).';
COMMENT ON COLUMN public.purchase_orders.cost_allocated_at IS
  'When PO total was posted to manufacturing_cost_entries + GL.';

-- ── manufacturing_cost_entries ← purchase_order ──────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manufacturing_cost_entries'
  ) THEN
    ALTER TABLE public.manufacturing_cost_entries
      ADD COLUMN IF NOT EXISTS purchase_order_id bigint;
    CREATE INDEX IF NOT EXISTS idx_mfg_cost_po
      ON public.manufacturing_cost_entries (purchase_order_id)
      WHERE purchase_order_id IS NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.manufacturing_cost_entries.purchase_order_id IS
  'Source purchase order when cost was raised from procurement.';

-- ── journal_lines: cost dimensions for GL reporting ──────────────────────────
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

    CREATE INDEX IF NOT EXISTS idx_jl_bu
      ON public.journal_lines (business_unit_id)
      WHERE business_unit_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_jl_wc
      ON public.journal_lines (work_center_id)
      WHERE work_center_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_jl_asset
      ON public.journal_lines (asset_id)
      WHERE asset_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_jl_po
      ON public.journal_lines (purchase_order_id)
      WHERE purchase_order_id IS NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.journal_lines.business_unit_id IS
  'Cost dimension: business unit for P&L / cost centre reports.';
COMMENT ON COLUMN public.journal_lines.work_center_id IS
  'Cost dimension: work centre.';
COMMENT ON COLUMN public.journal_lines.work_station_id IS
  'Cost dimension: work station.';
COMMENT ON COLUMN public.journal_lines.asset_id IS
  'Cost dimension: manufacturing asset.';
COMMENT ON COLUMN public.journal_lines.purchase_order_id IS
  'Source PO when line originates from procurement allocation.';
