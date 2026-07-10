-- Manufacturing module: BOMs, production orders, MPS, MRP, work centers.
-- Safe to re-run. Depends on profiles + products (+ optional stock_levels).

-- ── Work centers (cells / lines / stations) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manufacturing_work_centers (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  capacity_hours_per_day numeric(10,2) DEFAULT 8,
  efficiency_pct numeric(6,2) DEFAULT 100,
  cost_per_hour numeric(14,4) DEFAULT 0,
  status text NOT NULL DEFAULT 'active', -- active | maintenance | offline
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, code)
);
SELECT public.sa_add_column('manufacturing_work_centers', 'profile_id', 'bigint');
SELECT public.sa_add_column('manufacturing_work_centers', 'code', 'text');
SELECT public.sa_add_column('manufacturing_work_centers', 'name', 'text');
SELECT public.sa_add_column('manufacturing_work_centers', 'description', 'text');
SELECT public.sa_add_column('manufacturing_work_centers', 'capacity_hours_per_day', 'numeric(10,2)', '8');
SELECT public.sa_add_column('manufacturing_work_centers', 'efficiency_pct', 'numeric(6,2)', '100');
SELECT public.sa_add_column('manufacturing_work_centers', 'cost_per_hour', 'numeric(14,4)', '0');
SELECT public.sa_add_column('manufacturing_work_centers', 'status', 'text', '''active''');
SELECT public.sa_add_column('manufacturing_work_centers', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_create_index('idx_mfg_wc_profile', 'manufacturing_work_centers', 'profile_id');

-- ── Bills of materials ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manufacturing_boms (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id bigint REFERENCES public.products(id) ON DELETE SET NULL,
  bom_number text NOT NULL,
  name text NOT NULL,
  revision text NOT NULL DEFAULT 'A',
  status text NOT NULL DEFAULT 'draft', -- draft | active | obsolete
  yield_pct numeric(8,4) DEFAULT 100,
  scrap_pct numeric(8,4) DEFAULT 0,
  lead_time_days int DEFAULT 1,
  effective_from date,
  effective_to date,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, bom_number, revision)
);
SELECT public.sa_add_column('manufacturing_boms', 'profile_id', 'bigint');
SELECT public.sa_add_column('manufacturing_boms', 'product_id', 'bigint');
SELECT public.sa_add_column('manufacturing_boms', 'bom_number', 'text');
SELECT public.sa_add_column('manufacturing_boms', 'name', 'text');
SELECT public.sa_add_column('manufacturing_boms', 'revision', 'text', '''A''');
SELECT public.sa_add_column('manufacturing_boms', 'status', 'text', '''draft''');
SELECT public.sa_add_column('manufacturing_boms', 'yield_pct', 'numeric(8,4)', '100');
SELECT public.sa_add_column('manufacturing_boms', 'scrap_pct', 'numeric(8,4)', '0');
SELECT public.sa_add_column('manufacturing_boms', 'lead_time_days', 'int', '1');
SELECT public.sa_add_column('manufacturing_boms', 'effective_from', 'date');
SELECT public.sa_add_column('manufacturing_boms', 'effective_to', 'date');
SELECT public.sa_add_column('manufacturing_boms', 'notes', 'text');
SELECT public.sa_add_column('manufacturing_boms', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_create_index('idx_mfg_boms_profile', 'manufacturing_boms', 'profile_id');
SELECT public.sa_create_index('idx_mfg_boms_product', 'manufacturing_boms', 'product_id');
SELECT public.sa_create_index('idx_mfg_boms_status', 'manufacturing_boms', 'profile_id, status');

CREATE TABLE IF NOT EXISTS public.manufacturing_bom_lines (
  id bigserial PRIMARY KEY,
  bom_id bigint NOT NULL REFERENCES public.manufacturing_boms(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  component_product_id bigint REFERENCES public.products(id) ON DELETE SET NULL,
  line_no int NOT NULL DEFAULT 10,
  qty_per numeric(18,6) NOT NULL DEFAULT 1,
  uom text DEFAULT 'ea',
  scrap_pct numeric(8,4) DEFAULT 0,
  operation_seq int DEFAULT 10,
  is_phantom boolean DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('manufacturing_bom_lines', 'bom_id', 'bigint');
SELECT public.sa_add_column('manufacturing_bom_lines', 'profile_id', 'bigint');
SELECT public.sa_add_column('manufacturing_bom_lines', 'component_product_id', 'bigint');
SELECT public.sa_add_column('manufacturing_bom_lines', 'line_no', 'int', '10');
SELECT public.sa_add_column('manufacturing_bom_lines', 'qty_per', 'numeric(18,6)', '1');
SELECT public.sa_add_column('manufacturing_bom_lines', 'uom', 'text', '''ea''');
SELECT public.sa_add_column('manufacturing_bom_lines', 'scrap_pct', 'numeric(8,4)', '0');
SELECT public.sa_add_column('manufacturing_bom_lines', 'operation_seq', 'int', '10');
SELECT public.sa_add_column('manufacturing_bom_lines', 'is_phantom', 'boolean', 'false');
SELECT public.sa_add_column('manufacturing_bom_lines', 'notes', 'text');
SELECT public.sa_create_index('idx_mfg_bom_lines_bom', 'manufacturing_bom_lines', 'bom_id');
SELECT public.sa_create_index('idx_mfg_bom_lines_component', 'manufacturing_bom_lines', 'component_product_id');

-- ── Production / work orders ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manufacturing_production_orders (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  product_id bigint REFERENCES public.products(id) ON DELETE SET NULL,
  bom_id bigint REFERENCES public.manufacturing_boms(id) ON DELETE SET NULL,
  work_center_id bigint REFERENCES public.manufacturing_work_centers(id) ON DELETE SET NULL,
  qty_planned numeric(18,4) NOT NULL DEFAULT 0,
  qty_completed numeric(18,4) NOT NULL DEFAULT 0,
  qty_scrapped numeric(18,4) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned',
  -- planned | released | in_progress | hold | complete | cancelled
  priority int NOT NULL DEFAULT 50, -- 1 highest … 100 lowest
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  mps_line_id bigint,
  customer_ref text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, order_number)
);
SELECT public.sa_add_column('manufacturing_production_orders', 'profile_id', 'bigint');
SELECT public.sa_add_column('manufacturing_production_orders', 'order_number', 'text');
SELECT public.sa_add_column('manufacturing_production_orders', 'product_id', 'bigint');
SELECT public.sa_add_column('manufacturing_production_orders', 'bom_id', 'bigint');
SELECT public.sa_add_column('manufacturing_production_orders', 'work_center_id', 'bigint');
SELECT public.sa_add_column('manufacturing_production_orders', 'qty_planned', 'numeric(18,4)', '0');
SELECT public.sa_add_column('manufacturing_production_orders', 'qty_completed', 'numeric(18,4)', '0');
SELECT public.sa_add_column('manufacturing_production_orders', 'qty_scrapped', 'numeric(18,4)', '0');
SELECT public.sa_add_column('manufacturing_production_orders', 'status', 'text', '''planned''');
SELECT public.sa_add_column('manufacturing_production_orders', 'priority', 'int', '50');
SELECT public.sa_add_column('manufacturing_production_orders', 'scheduled_start', 'timestamptz');
SELECT public.sa_add_column('manufacturing_production_orders', 'scheduled_end', 'timestamptz');
SELECT public.sa_add_column('manufacturing_production_orders', 'actual_start', 'timestamptz');
SELECT public.sa_add_column('manufacturing_production_orders', 'actual_end', 'timestamptz');
SELECT public.sa_add_column('manufacturing_production_orders', 'mps_line_id', 'bigint');
SELECT public.sa_add_column('manufacturing_production_orders', 'customer_ref', 'text');
SELECT public.sa_add_column('manufacturing_production_orders', 'notes', 'text');
SELECT public.sa_add_column('manufacturing_production_orders', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_create_index('idx_mfg_po_profile', 'manufacturing_production_orders', 'profile_id');
SELECT public.sa_create_index('idx_mfg_po_status', 'manufacturing_production_orders', 'profile_id, status');
SELECT public.sa_create_index('idx_mfg_po_product', 'manufacturing_production_orders', 'product_id');

-- ── Master Production Schedule ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manufacturing_mps_plans (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  horizon_weeks int NOT NULL DEFAULT 12,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft', -- draft | active | frozen | closed
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('manufacturing_mps_plans', 'profile_id', 'bigint');
SELECT public.sa_add_column('manufacturing_mps_plans', 'name', 'text');
SELECT public.sa_add_column('manufacturing_mps_plans', 'horizon_weeks', 'int', '12');
SELECT public.sa_add_column('manufacturing_mps_plans', 'start_date', 'date');
SELECT public.sa_add_column('manufacturing_mps_plans', 'status', 'text', '''draft''');
SELECT public.sa_add_column('manufacturing_mps_plans', 'notes', 'text');
SELECT public.sa_add_column('manufacturing_mps_plans', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_create_index('idx_mfg_mps_plans_profile', 'manufacturing_mps_plans', 'profile_id');

CREATE TABLE IF NOT EXISTS public.manufacturing_mps_lines (
  id bigserial PRIMARY KEY,
  plan_id bigint NOT NULL REFERENCES public.manufacturing_mps_plans(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id bigint REFERENCES public.products(id) ON DELETE SET NULL,
  week_start date NOT NULL,
  forecast_qty numeric(18,4) NOT NULL DEFAULT 0,
  firm_qty numeric(18,4) NOT NULL DEFAULT 0,
  demand_qty numeric(18,4) NOT NULL DEFAULT 0,
  supply_qty numeric(18,4) NOT NULL DEFAULT 0,
  available_qty numeric(18,4) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, product_id, week_start)
);
SELECT public.sa_add_column('manufacturing_mps_lines', 'plan_id', 'bigint');
SELECT public.sa_add_column('manufacturing_mps_lines', 'profile_id', 'bigint');
SELECT public.sa_add_column('manufacturing_mps_lines', 'product_id', 'bigint');
SELECT public.sa_add_column('manufacturing_mps_lines', 'week_start', 'date');
SELECT public.sa_add_column('manufacturing_mps_lines', 'forecast_qty', 'numeric(18,4)', '0');
SELECT public.sa_add_column('manufacturing_mps_lines', 'firm_qty', 'numeric(18,4)', '0');
SELECT public.sa_add_column('manufacturing_mps_lines', 'demand_qty', 'numeric(18,4)', '0');
SELECT public.sa_add_column('manufacturing_mps_lines', 'supply_qty', 'numeric(18,4)', '0');
SELECT public.sa_add_column('manufacturing_mps_lines', 'available_qty', 'numeric(18,4)', '0');
SELECT public.sa_add_column('manufacturing_mps_lines', 'notes', 'text');
SELECT public.sa_create_index('idx_mfg_mps_lines_plan', 'manufacturing_mps_lines', 'plan_id');
SELECT public.sa_create_index('idx_mfg_mps_lines_product', 'manufacturing_mps_lines', 'product_id');

-- ── MRP runs & net requirements ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manufacturing_mrp_runs (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  run_number text NOT NULL,
  status text NOT NULL DEFAULT 'running', -- running | complete | failed
  horizon_days int NOT NULL DEFAULT 90,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  summary jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, run_number)
);
SELECT public.sa_add_column('manufacturing_mrp_runs', 'profile_id', 'bigint');
SELECT public.sa_add_column('manufacturing_mrp_runs', 'run_number', 'text');
SELECT public.sa_add_column('manufacturing_mrp_runs', 'status', 'text', '''running''');
SELECT public.sa_add_column('manufacturing_mrp_runs', 'horizon_days', 'int', '90');
SELECT public.sa_add_column('manufacturing_mrp_runs', 'started_at', 'timestamptz');
SELECT public.sa_add_column('manufacturing_mrp_runs', 'completed_at', 'timestamptz');
SELECT public.sa_add_column('manufacturing_mrp_runs', 'summary', 'jsonb', '''{}''::jsonb');
SELECT public.sa_create_index('idx_mfg_mrp_runs_profile', 'manufacturing_mrp_runs', 'profile_id');

CREATE TABLE IF NOT EXISTS public.manufacturing_mrp_requirements (
  id bigserial PRIMARY KEY,
  run_id bigint NOT NULL REFERENCES public.manufacturing_mrp_runs(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id bigint REFERENCES public.products(id) ON DELETE SET NULL,
  requirement_date date,
  gross_req numeric(18,4) NOT NULL DEFAULT 0,
  on_hand numeric(18,4) NOT NULL DEFAULT 0,
  scheduled_receipts numeric(18,4) NOT NULL DEFAULT 0,
  net_req numeric(18,4) NOT NULL DEFAULT 0,
  planned_order_qty numeric(18,4) NOT NULL DEFAULT 0,
  action text NOT NULL DEFAULT 'none', -- none | make | buy | expedite
  source text, -- mps | production_order | safety_stock
  priority int DEFAULT 50,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('manufacturing_mrp_requirements', 'run_id', 'bigint');
SELECT public.sa_add_column('manufacturing_mrp_requirements', 'profile_id', 'bigint');
SELECT public.sa_add_column('manufacturing_mrp_requirements', 'product_id', 'bigint');
SELECT public.sa_add_column('manufacturing_mrp_requirements', 'requirement_date', 'date');
SELECT public.sa_add_column('manufacturing_mrp_requirements', 'gross_req', 'numeric(18,4)', '0');
SELECT public.sa_add_column('manufacturing_mrp_requirements', 'on_hand', 'numeric(18,4)', '0');
SELECT public.sa_add_column('manufacturing_mrp_requirements', 'scheduled_receipts', 'numeric(18,4)', '0');
SELECT public.sa_add_column('manufacturing_mrp_requirements', 'net_req', 'numeric(18,4)', '0');
SELECT public.sa_add_column('manufacturing_mrp_requirements', 'planned_order_qty', 'numeric(18,4)', '0');
SELECT public.sa_add_column('manufacturing_mrp_requirements', 'action', 'text', '''none''');
SELECT public.sa_add_column('manufacturing_mrp_requirements', 'source', 'text');
SELECT public.sa_add_column('manufacturing_mrp_requirements', 'priority', 'int', '50');
SELECT public.sa_add_column('manufacturing_mrp_requirements', 'notes', 'text');
SELECT public.sa_create_index('idx_mfg_mrp_req_run', 'manufacturing_mrp_requirements', 'run_id');
SELECT public.sa_create_index('idx_mfg_mrp_req_product', 'manufacturing_mrp_requirements', 'product_id');
