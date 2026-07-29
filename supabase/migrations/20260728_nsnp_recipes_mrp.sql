-- NSNP Recipe BOM + category budgets (DBE programme planning → school/SP MPS & MRP)

CREATE TABLE IF NOT EXISTS public.nsnp_recipes (
  id bigserial PRIMARY KEY,
  agency_profile_id bigint NOT NULL,
  name text NOT NULL,
  meal_type text NOT NULL DEFAULT 'lunch', -- breakfast | lunch
  dish_code text,
  description text,
  -- BOM base: quantities are per 1 learner portion
  portion_learners numeric(10,2) NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsnp_recipes_agency
  ON public.nsnp_recipes (agency_profile_id, active);

CREATE TABLE IF NOT EXISTS public.nsnp_recipe_lines (
  id bigserial PRIMARY KEY,
  recipe_id bigint NOT NULL REFERENCES public.nsnp_recipes(id) ON DELETE CASCADE,
  approved_product_id bigint REFERENCES public.nsnp_approved_products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  brand_name text,
  category text,
  -- qty of product required per portion_learners (usually per 1 learner)
  qty_per_portion numeric(14,6) NOT NULL,
  uom text NOT NULL DEFAULT 'kg',
  wastage_pct numeric(6,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsnp_recipe_lines_recipe
  ON public.nsnp_recipe_lines (recipe_id);
CREATE INDEX IF NOT EXISTS idx_nsnp_recipe_lines_product
  ON public.nsnp_recipe_lines (approved_product_id);

-- DBE budget by product category (for MPS cost estimates)
CREATE TABLE IF NOT EXISTS public.nsnp_category_budgets (
  id bigserial PRIMARY KEY,
  agency_profile_id bigint NOT NULL,
  category text NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  budget_amount_zar numeric(14,2) NOT NULL DEFAULT 0,
  unit_price_zar numeric(14,4), -- optional default R/unit for MRP costing
  uom text DEFAULT 'kg',
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsnp_category_budgets_agency
  ON public.nsnp_category_budgets (agency_profile_id, period_from, period_to);

-- Published planning period (locks MPS assumptions)
CREATE TABLE IF NOT EXISTS public.nsnp_mps_plans (
  id bigserial PRIMARY KEY,
  agency_profile_id bigint NOT NULL,
  name text NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  -- default: weekdays Mon–Fri
  include_weekends boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft', -- draft | published
  -- optional override: map day+meal → recipe_id (else use menu dish match / active recipes)
  schedule jsonb DEFAULT '[]'::jsonb,
  notes text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsnp_mps_plans_agency
  ON public.nsnp_mps_plans (agency_profile_id, status, period_from);

COMMENT ON TABLE public.nsnp_recipes IS
  'DBE recipe BOM: approved products + qty per learner portion for MPS/MRP planning.';
COMMENT ON TABLE public.nsnp_recipe_lines IS
  'BOM lines for nsnp_recipes — product usage per portion.';
COMMENT ON TABLE public.nsnp_category_budgets IS
  'DBE budget envelope by catalogue category for a planning period.';
COMMENT ON TABLE public.nsnp_mps_plans IS
  'Published MPS planning windows for programme-level meal counts and MRP explode.';
