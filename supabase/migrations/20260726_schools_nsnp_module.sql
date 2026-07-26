-- =============================================================================
-- Schools / NSNP module (Phases A–E)
-- Each school = company profile with own kitchen, learners, staff, ISP procurement
-- Platform-owned approved brand list · prize engine · feeding & attendance
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sa_add_column(p_table text, p_column text, p_type text, p_default text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = p_column
  ) THEN
    IF p_default IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', p_table, p_column, p_type);
    ELSE
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s DEFAULT %s', p_table, p_column, p_type, p_default);
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sa_add_column %.% skip: %', p_table, p_column, SQLERRM;
END;
$$;

-- ── Platform NSNP approved brands ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nsnp_approved_brands (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  slug text,
  manufacturer text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nsnp_brands_name_lower
  ON public.nsnp_approved_brands (lower(name));

-- ── Platform NSNP approved products (strict catalogue) ──────────────────────
CREATE TABLE IF NOT EXISTS public.nsnp_approved_products (
  id bigserial PRIMARY KEY,
  brand_id bigint REFERENCES public.nsnp_approved_brands(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'commodity',
  name text NOT NULL,
  brand_name text NOT NULL,
  sku text,
  pack_size text,
  uom text DEFAULT 'kg',
  barcode text,
  province text,
  energy_kcal numeric(10,2),
  protein_g numeric(10,2),
  fortification_flags text[] DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  effective_from date,
  effective_to date,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsnp_products_active ON public.nsnp_approved_products (active);
CREATE INDEX IF NOT EXISTS idx_nsnp_products_brand ON public.nsnp_approved_products (brand_id);
CREATE INDEX IF NOT EXISTS idx_nsnp_products_category ON public.nsnp_approved_products (category);

-- ── School profile extension (1:1 with company profiles) ────────────────────
CREATE TABLE IF NOT EXISTS public.school_profiles (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL UNIQUE,
  emis_number text,
  school_name text NOT NULL,
  school_type text DEFAULT 'public', -- public | independent | special
  phase text, -- primary | secondary | combined | special
  province text,
  district text,
  circuit text,
  quintile int,
  urban_rural text,
  address text,
  city text,
  postal_code text,
  lat double precision,
  lng double precision,
  principal_name text,
  principal_email text,
  principal_phone text,
  nsnp_coordinator_name text,
  nsnp_coordinator_email text,
  kitchen_warehouse_id bigint,
  has_on_site_kitchen boolean NOT NULL DEFAULT true,
  feeding_breakfast boolean DEFAULT false,
  feeding_lunch boolean DEFAULT true,
  feeding_snack boolean DEFAULT false,
  learner_count_enrolled int DEFAULT 0,
  learner_count_nsnp_eligible int DEFAULT 0,
  learner_count_verified int DEFAULT 0,
  staff_count int DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_profiles_province ON public.school_profiles (province);
CREATE INDEX IF NOT EXISTS idx_school_profiles_district ON public.school_profiles (district);
CREATE INDEX IF NOT EXISTS idx_school_profiles_emis ON public.school_profiles (emis_number);

-- ── Learners ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_learners (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL, -- company id for RLS convenience
  external_id text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  grade text,
  class_name text,
  gender text,
  nsnp_eligible boolean NOT NULL DEFAULT true,
  special_diet text,
  guardian_name text,
  guardian_phone text,
  verification_status text NOT NULL DEFAULT 'draft',
  -- draft | school_verified | attested | flagged | left
  verified_at timestamptz,
  verified_by text,
  status text NOT NULL DEFAULT 'active', -- active | transferred | left | inactive
  import_batch_id bigint,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_learners_school ON public.school_learners (school_profile_id);
CREATE INDEX IF NOT EXISTS idx_school_learners_profile ON public.school_learners (profile_id);
CREATE INDEX IF NOT EXISTS idx_school_learners_grade ON public.school_learners (school_profile_id, grade);
CREATE INDEX IF NOT EXISTS idx_school_learners_verify ON public.school_learners (verification_status);

-- ── Staff / teachers ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_staff (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL,
  external_id text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role text NOT NULL DEFAULT 'teacher',
  -- principal | deputy | nsnp_coordinator | kitchen_manager | teacher | clerk | other
  email text,
  phone text,
  phase text,
  id_number_last4 text,
  verification_status text NOT NULL DEFAULT 'draft',
  verified_at timestamptz,
  verified_by text,
  status text NOT NULL DEFAULT 'active',
  import_batch_id bigint,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_staff_school ON public.school_staff (school_profile_id);

-- ── Import batches ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_import_batches (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL,
  kind text NOT NULL, -- learners | staff
  file_name text,
  row_count int DEFAULT 0,
  success_count int DEFAULT 0,
  error_count int DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── ISP (Independent Service Provider) NSNP profile ─────────────────────────
CREATE TABLE IF NOT EXISTS public.nsnp_isp_profiles (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL UNIQUE, -- ISP company
  trading_name text,
  provinces text[] DEFAULT '{}',
  food_handling_cert boolean DEFAULT false,
  compliance_status text NOT NULL DEFAULT 'pending',
  -- pending | compliant | suspended | revoked
  approved_product_ids bigint[] DEFAULT '{}',
  delivery_otifef_pct numeric(6,2) DEFAULT 0,
  approved_brand_pct numeric(6,2) DEFAULT 100,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── School ↔ ISP trading links ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_isp_links (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  school_company_id bigint NOT NULL,
  isp_profile_id bigint NOT NULL, -- company id of ISP
  status text NOT NULL DEFAULT 'active', -- active | blocked | pending
  preferred boolean DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_profile_id, isp_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_school_isp_links_school ON public.school_isp_links (school_profile_id);
CREATE INDEX IF NOT EXISTS idx_school_isp_links_isp ON public.school_isp_links (isp_profile_id);

-- ── Kitchen stock (lightweight NSNP stock — also link warehouses) ───────────
CREATE TABLE IF NOT EXISTS public.school_kitchen_stock (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL,
  approved_product_id bigint REFERENCES public.nsnp_approved_products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  brand_name text NOT NULL,
  qty_on_hand numeric(14,3) NOT NULL DEFAULT 0,
  uom text DEFAULT 'kg',
  lot_number text,
  expiry_date date,
  last_received_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_kitchen_stock_school ON public.school_kitchen_stock (school_profile_id);

-- ── Kitchen receipts (GRN) — brand compliance gate ──────────────────────────
CREATE TABLE IF NOT EXISTS public.school_kitchen_receipts (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL,
  isp_profile_id bigint,
  receipt_number text,
  received_at date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'posted', -- draft | posted | rejected
  compliance_ok boolean NOT NULL DEFAULT true,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{approved_product_id, product_name, brand_name, qty, uom, lot, expiry, approved:bool}]
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_receipts_school ON public.school_kitchen_receipts (school_profile_id);

-- ── School NSNP purchase orders (channel-restricted) ────────────────────────
CREATE TABLE IF NOT EXISTS public.school_purchase_orders (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL,
  isp_profile_id bigint,
  po_number text,
  status text NOT NULL DEFAULT 'draft',
  -- draft | submitted | confirmed | partially_received | received | cancelled
  order_date date DEFAULT CURRENT_DATE,
  expected_date date,
  total_amount numeric(14,2) DEFAULT 0,
  currency text DEFAULT 'ZAR',
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{approved_product_id, product_name, brand_name, qty, unit_price, uom}]
  compliance_ok boolean NOT NULL DEFAULT true,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_pos_school ON public.school_purchase_orders (school_profile_id);

-- ── Daily feeding log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_feeding_days (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL,
  feed_date date NOT NULL,
  meal_type text NOT NULL DEFAULT 'lunch', -- breakfast | lunch | snack
  menu_name text,
  planned_meals int DEFAULT 0,
  served_meals int DEFAULT 0,
  waste_meals int DEFAULT 0,
  learners_present int DEFAULT 0,
  notes text,
  ingredients jsonb DEFAULT '[]'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_profile_id, feed_date, meal_type)
);

CREATE INDEX IF NOT EXISTS idx_school_feeding_date ON public.school_feeding_days (school_profile_id, feed_date);

-- ── Daily attendance (aggregate by grade optional) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.school_attendance_days (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL,
  attendance_date date NOT NULL,
  grade text, -- null = whole school total
  enrolled int DEFAULT 0,
  present int DEFAULT 0,
  absent int DEFAULT 0,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_attendance_date
  ON public.school_attendance_days (school_profile_id, attendance_date);

-- ── Menu cycles (simple) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_menu_cycles (
  id bigserial PRIMARY KEY,
  school_profile_id bigint REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  profile_id bigint, -- null = platform template
  name text NOT NULL,
  cycle_days int DEFAULT 7,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{day:1, meal_type, dish, approved_product_ids:[]}]
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Compliance documents / incidents ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_compliance_events (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL,
  kind text NOT NULL, -- hygiene | training | incident | document | monitor_visit
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  severity text,
  event_date date DEFAULT CURRENT_DATE,
  body text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Prize periods & scores ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nsnp_prize_periods (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  period_type text NOT NULL DEFAULT 'quarterly', -- quarterly | annual
  year int NOT NULL,
  quarter int, -- 1-4 for quarterly
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL DEFAULT 'open', -- open | closed | awarded
  prize_description text,
  rules jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nsnp_prize_scores (
  id bigserial PRIMARY KEY,
  period_id bigint NOT NULL REFERENCES public.nsnp_prize_periods(id) ON DELETE CASCADE,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL,
  approved_brand_pct numeric(6,2) DEFAULT 0,
  zero_nonapproved_score numeric(6,2) DEFAULT 0,
  menu_adherence_pct numeric(6,2) DEFAULT 0,
  feeding_completeness_pct numeric(6,2) DEFAULT 0,
  stock_discipline_pct numeric(6,2) DEFAULT 0,
  data_quality_pct numeric(6,2) DEFAULT 0,
  total_score numeric(6,2) DEFAULT 0,
  rank_national int,
  rank_province int,
  rank_district int,
  province text,
  district text,
  quintile int,
  breakdown jsonb DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, school_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_nsnp_prize_scores_period ON public.nsnp_prize_scores (period_id, total_score DESC);

CREATE TABLE IF NOT EXISTS public.nsnp_prize_awards (
  id bigserial PRIMARY KEY,
  period_id bigint NOT NULL REFERENCES public.nsnp_prize_periods(id) ON DELETE CASCADE,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  place int,
  award_title text,
  award_value text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Seed starter approved brands / products (South Africa NSNP-style) ───────
INSERT INTO public.nsnp_approved_brands (name, slug, manufacturer, notes)
SELECT v.name, v.slug, v.manufacturer, v.notes
FROM (VALUES
  ('Ace', 'ace', 'Tiger Brands', 'Maize meal — example approved brand'),
  ('Iwisa', 'iwisa', 'Premier FMCG', 'Maize meal — example approved brand'),
  ('White Star', 'white-star', 'Pioneer Foods', 'Maize meal — example approved brand'),
  ('SASKO', 'sasko', 'Pioneer Foods', 'Flour / bread — example'),
  ('Sunfoil', 'sunfoil', 'Willowton', 'Cooking oil — example'),
  ('Bokomo', 'bokomo', 'Pioneer Foods', 'Cereals — example'),
  ('Rainbow', 'rainbow', 'RCL Foods', 'Protein — example'),
  ('Generic Fortified', 'generic-fortified', 'NSNP Generic', 'Fortified commodities where brand-neutral allowed')
) AS v(name, slug, manufacturer, notes)
WHERE NOT EXISTS (SELECT 1 FROM public.nsnp_approved_brands b WHERE lower(b.name) = lower(v.name));

INSERT INTO public.nsnp_approved_products (brand_id, category, name, brand_name, pack_size, uom, energy_kcal, protein_g)
SELECT b.id, v.category, v.pname, b.name, v.pack_size, v.uom, v.kcal, v.protein
FROM public.nsnp_approved_brands b
JOIN (VALUES
  ('ace', 'maize_meal', 'Super Maize Meal 12.5kg', '12.5kg', 'kg', 350.0, 8.0),
  ('iwisa', 'maize_meal', 'Iwisa Maize Meal 12.5kg', '12.5kg', 'kg', 350.0, 8.0),
  ('white-star', 'maize_meal', 'White Star Super Maize Meal 12.5kg', '12.5kg', 'kg', 350.0, 8.0),
  ('sunfoil', 'oil', 'Sunfoil Cooking Oil 5L', '5L', 'L', 884.0, 0.0),
  ('sasko', 'flour', 'SASKO Cake Wheat Flour 10kg', '10kg', 'kg', 364.0, 10.0),
  ('bokomo', 'cereal', 'Bokomo Oats 1kg', '1kg', 'kg', 379.0, 13.0),
  ('rainbow', 'protein', 'Rainbow Chicken IQF 2kg', '2kg', 'kg', 165.0, 31.0),
  ('generic-fortified', 'beans', 'Fortified Sugar Beans 5kg', '5kg', 'kg', 333.0, 23.0),
  ('generic-fortified', 'rice', 'Fortified Rice 10kg', '10kg', 'kg', 360.0, 7.0),
  ('generic-fortified', 'vegetables', 'Frozen Mixed Vegetables 1kg', '1kg', 'kg', 65.0, 2.5)
) AS v(slug, category, pname, pack_size, uom, kcal, protein) ON b.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.nsnp_approved_products p
  WHERE lower(p.name) = lower(v.pname) AND lower(p.brand_name) = lower(b.name)
);

-- Soft columns on profiles for org type
SELECT public.sa_add_column('profiles', 'org_type', 'text');
-- org_type: business | school | nsnp_isp | district | ...

COMMENT ON TABLE public.school_profiles IS 'NSNP school registry — one kitchen per school company';
COMMENT ON TABLE public.nsnp_approved_products IS 'Strict NSNP approved product/brand catalogue';
COMMENT ON TABLE public.nsnp_prize_scores IS 'Headmaster prize scorecard snapshots';
