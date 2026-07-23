-- Manufacturing cost structure: business units, work stations, assets, expense allocation.
-- Safe to re-run. Depends on profiles + manufacturing_work_centers (20260710).

-- ── Business units (org / plant / division — cost centre parents) ─────────────
CREATE TABLE IF NOT EXISTS public.manufacturing_business_units (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  parent_id bigint REFERENCES public.manufacturing_business_units(id) ON DELETE SET NULL,
  cost_centre_code text,
  currency text NOT NULL DEFAULT 'ZAR',
  budget_monthly numeric(18,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'active', -- active | inactive
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, code)
);

CREATE INDEX IF NOT EXISTS idx_mfg_bu_profile
  ON public.manufacturing_business_units (profile_id);
CREATE INDEX IF NOT EXISTS idx_mfg_bu_parent
  ON public.manufacturing_business_units (profile_id, parent_id);

COMMENT ON TABLE public.manufacturing_business_units IS
  'Manufacturing business units / plants / cost-centre parents.';

-- ── Work stations (finer than work centres; line, bay, cell position) ────────
CREATE TABLE IF NOT EXISTS public.manufacturing_work_stations (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_center_id bigint REFERENCES public.manufacturing_work_centers(id) ON DELETE SET NULL,
  business_unit_id bigint REFERENCES public.manufacturing_business_units(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  station_type text DEFAULT 'station', -- station | line | bay | cell | lab
  capacity_hours_per_day numeric(10,2) DEFAULT 8,
  cost_per_hour numeric(14,4) DEFAULT 0,
  status text NOT NULL DEFAULT 'active', -- active | maintenance | offline
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, code)
);

CREATE INDEX IF NOT EXISTS idx_mfg_ws_profile
  ON public.manufacturing_work_stations (profile_id);
CREATE INDEX IF NOT EXISTS idx_mfg_ws_center
  ON public.manufacturing_work_stations (work_center_id);
CREATE INDEX IF NOT EXISTS idx_mfg_ws_bu
  ON public.manufacturing_work_stations (business_unit_id);

COMMENT ON TABLE public.manufacturing_work_stations IS
  'Work stations under work centres / business units.';

-- Link existing work centres to business units
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manufacturing_work_centers'
  ) THEN
    ALTER TABLE public.manufacturing_work_centers
      ADD COLUMN IF NOT EXISTS business_unit_id bigint
        REFERENCES public.manufacturing_business_units(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_mfg_wc_bu
      ON public.manufacturing_work_centers (business_unit_id);
  END IF;
END $$;

-- ── Assets (machines, tools, vehicles, fixtures) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.manufacturing_assets (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  asset_type text NOT NULL DEFAULT 'equipment',
  -- equipment | tool | vehicle | fixture | building | other
  serial_number text,
  manufacturer text,
  model text,
  purchase_date date,
  purchase_cost numeric(18,2) DEFAULT 0,
  residual_value numeric(18,2) DEFAULT 0,
  useful_life_months int DEFAULT 60,
  depreciation_method text DEFAULT 'straight_line',
  -- straight_line | none
  currency text NOT NULL DEFAULT 'ZAR',
  monthly_running_cost numeric(18,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  -- active | maintenance | disposed | idle
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, code)
);

CREATE INDEX IF NOT EXISTS idx_mfg_assets_profile
  ON public.manufacturing_assets (profile_id);
CREATE INDEX IF NOT EXISTS idx_mfg_assets_status
  ON public.manufacturing_assets (profile_id, status);

COMMENT ON TABLE public.manufacturing_assets IS
  'Manufacturing assets for cost allocation to BUs / centres / stations.';

-- ── Asset allocations (where the asset lives / is used) ──────────────────────
CREATE TABLE IF NOT EXISTS public.manufacturing_asset_allocations (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_id bigint NOT NULL REFERENCES public.manufacturing_assets(id) ON DELETE CASCADE,
  business_unit_id bigint REFERENCES public.manufacturing_business_units(id) ON DELETE SET NULL,
  work_center_id bigint REFERENCES public.manufacturing_work_centers(id) ON DELETE SET NULL,
  work_station_id bigint REFERENCES public.manufacturing_work_stations(id) ON DELETE SET NULL,
  allocation_pct numeric(8,4) NOT NULL DEFAULT 100,
  -- share of asset cost to this placement (sum can exceed 100 for multi-use tracking)
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfg_asset_alloc_asset
  ON public.manufacturing_asset_allocations (asset_id);
CREATE INDEX IF NOT EXISTS idx_mfg_asset_alloc_profile
  ON public.manufacturing_asset_allocations (profile_id);
CREATE INDEX IF NOT EXISTS idx_mfg_asset_alloc_bu
  ON public.manufacturing_asset_allocations (business_unit_id);

COMMENT ON TABLE public.manufacturing_asset_allocations IS
  'Assign assets to business units, work centres, and/or work stations.';

-- ── Cost / expense entries (allocated to cost objects) ───────────────────────
CREATE TABLE IF NOT EXISTS public.manufacturing_cost_entries (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  category text NOT NULL DEFAULT 'operating',
  -- operating | labour | energy | maintenance | depreciation | materials | overhead | other
  description text,
  reference text,
  -- Cost objects (at least one should be set)
  business_unit_id bigint REFERENCES public.manufacturing_business_units(id) ON DELETE SET NULL,
  work_center_id bigint REFERENCES public.manufacturing_work_centers(id) ON DELETE SET NULL,
  work_station_id bigint REFERENCES public.manufacturing_work_stations(id) ON DELETE SET NULL,
  asset_id bigint REFERENCES public.manufacturing_assets(id) ON DELETE SET NULL,
  production_order_id bigint,
  -- optional link if column exists elsewhere; soft FK
  is_recurring boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfg_cost_profile_date
  ON public.manufacturing_cost_entries (profile_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_mfg_cost_bu
  ON public.manufacturing_cost_entries (business_unit_id);
CREATE INDEX IF NOT EXISTS idx_mfg_cost_wc
  ON public.manufacturing_cost_entries (work_center_id);
CREATE INDEX IF NOT EXISTS idx_mfg_cost_ws
  ON public.manufacturing_cost_entries (work_station_id);
CREATE INDEX IF NOT EXISTS idx_mfg_cost_asset
  ON public.manufacturing_cost_entries (asset_id);

COMMENT ON TABLE public.manufacturing_cost_entries IS
  'Expenses allocated to business units, work centres, stations, or assets (cost centres).';
