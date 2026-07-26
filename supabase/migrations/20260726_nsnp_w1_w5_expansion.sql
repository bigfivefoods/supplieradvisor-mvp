-- =============================================================================
-- NSNP W1–W5 expansion
-- Serve-day alerts · PEU visits · nutrition norms · claims · ISP SLA
-- Fair prizes · multi-org members · audit packs · transparency
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

-- Member type on school_profiles (school | hospital | ecd | shelter | other)
SELECT public.sa_add_column('school_profiles', 'member_type', 'text', '''school''');
SELECT public.sa_add_column('school_profiles', 'emis_snapshot', 'jsonb');
SELECT public.sa_add_column('school_profiles', 'emis_attested_at', 'timestamptz');
SELECT public.sa_add_column('school_agency_links', 'member_type', 'text', '''school''');

-- PEU / monitor field visits (W1)
CREATE TABLE IF NOT EXISTS public.nsnp_peu_visits (
  id bigserial PRIMARY KEY,
  agency_profile_id bigint NOT NULL,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  school_company_id bigint,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  visitor_name text,
  visitor_user_id text,
  status text NOT NULL DEFAULT 'completed', -- planned | completed | cancelled
  lat double precision,
  lng double precision,
  hygiene_score numeric(5,2),
  stock_score numeric(5,2),
  menu_score numeric(5,2),
  feeding_score numeric(5,2),
  overall_score numeric(5,2),
  checklist jsonb DEFAULT '{}'::jsonb,
  -- {hygiene: bool, stock_matches_menu: bool, learners_vs_meals: bool, kitchen_ok: bool, notes...}
  notes text,
  photo_urls text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsnp_peu_visits_school ON public.nsnp_peu_visits (school_profile_id);
CREATE INDEX IF NOT EXISTS idx_nsnp_peu_visits_agency ON public.nsnp_peu_visits (agency_profile_id);
CREATE INDEX IF NOT EXISTS idx_nsnp_peu_visits_date ON public.nsnp_peu_visits (visit_date);

-- Programme alerts (W1 / W3)
CREATE TABLE IF NOT EXISTS public.nsnp_alerts (
  id bigserial PRIMARY KEY,
  school_profile_id bigint REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  agency_profile_id bigint,
  profile_id bigint,
  severity text NOT NULL DEFAULT 'warn', -- info | warn | critical
  code text NOT NULL,
  title text NOT NULL,
  body text,
  status text NOT NULL DEFAULT 'open', -- open | ack | resolved
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_nsnp_alerts_school ON public.nsnp_alerts (school_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_nsnp_alerts_agency ON public.nsnp_alerts (agency_profile_id, status);

-- Nutrition norms (W2) — per meal type targets
CREATE TABLE IF NOT EXISTS public.nsnp_nutrition_norms (
  id bigserial PRIMARY KEY,
  agency_profile_id bigint, -- null = national default
  meal_type text NOT NULL DEFAULT 'lunch',
  phase text, -- primary | secondary | null=all
  min_energy_kcal numeric(10,2) NOT NULL DEFAULT 450,
  min_protein_g numeric(10,2) NOT NULL DEFAULT 15,
  min_veg_servings numeric(6,2) DEFAULT 1,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.nsnp_nutrition_norms (agency_profile_id, meal_type, phase, min_energy_kcal, min_protein_g, notes)
SELECT NULL, 'lunch', 'primary', 450, 15, 'National default NSNP-style lunch primary'
WHERE NOT EXISTS (
  SELECT 1 FROM public.nsnp_nutrition_norms n
  WHERE n.agency_profile_id IS NULL AND n.meal_type = 'lunch' AND n.phase = 'primary'
);

INSERT INTO public.nsnp_nutrition_norms (agency_profile_id, meal_type, phase, min_energy_kcal, min_protein_g, notes)
SELECT NULL, 'lunch', 'secondary', 550, 18, 'National default NSNP-style lunch secondary'
WHERE NOT EXISTS (
  SELECT 1 FROM public.nsnp_nutrition_norms n
  WHERE n.agency_profile_id IS NULL AND n.meal_type = 'lunch' AND n.phase = 'secondary'
);

INSERT INTO public.nsnp_nutrition_norms (agency_profile_id, meal_type, phase, min_energy_kcal, min_protein_g, notes)
SELECT NULL, 'breakfast', NULL, 300, 8, 'National default breakfast'
WHERE NOT EXISTS (
  SELECT 1 FROM public.nsnp_nutrition_norms n
  WHERE n.agency_profile_id IS NULL AND n.meal_type = 'breakfast'
);

-- Claim / funding snapshots (W2)
CREATE TABLE IF NOT EXISTS public.nsnp_claim_packs (
  id bigserial PRIMARY KEY,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL,
  agency_profile_id bigint,
  period_from date NOT NULL,
  period_to date NOT NULL,
  school_days int DEFAULT 0,
  days_fed int DEFAULT 0,
  meals_served int DEFAULT 0,
  learners_avg_present numeric(12,2) DEFAULT 0,
  food_spend numeric(14,2) DEFAULT 0,
  cost_per_meal numeric(12,4) DEFAULT 0,
  budget_allocated numeric(14,2),
  claim_amount numeric(14,2),
  nutrition_pass_pct numeric(6,2),
  approved_brand_pct numeric(6,2),
  status text NOT NULL DEFAULT 'draft', -- draft | submitted | approved | paid
  pack_json jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsnp_claims_school ON public.nsnp_claim_packs (school_profile_id);

-- ISP SLA snapshots (W3)
CREATE TABLE IF NOT EXISTS public.nsnp_isp_sla (
  id bigserial PRIMARY KEY,
  school_profile_id bigint REFERENCES public.school_profiles(id) ON DELETE SET NULL,
  school_company_id bigint,
  isp_profile_id bigint NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  deliveries int DEFAULT 0,
  on_time int DEFAULT 0,
  in_full int DEFAULT 0,
  approved_brand_ok int DEFAULT 0,
  short_supply int DEFAULT 0,
  wrong_brand int DEFAULT 0,
  otifef_pct numeric(6,2) DEFAULT 0,
  compliance_pct numeric(6,2) DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsnp_isp_sla_isp ON public.nsnp_isp_sla (isp_profile_id);

-- Prize certificates (W4)
CREATE TABLE IF NOT EXISTS public.nsnp_prize_certificates (
  id bigserial PRIMARY KEY,
  period_id bigint REFERENCES public.nsnp_prize_periods(id) ON DELETE SET NULL,
  school_profile_id bigint NOT NULL REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL,
  band text, -- national | province | district | quintile
  band_key text,
  rank int,
  total_score numeric(6,2),
  certificate_code text,
  title text,
  body text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_nsnp_certs_school ON public.nsnp_prize_certificates (school_profile_id);

-- Audit pack hashes (W5)
CREATE TABLE IF NOT EXISTS public.nsnp_audit_packs (
  id bigserial PRIMARY KEY,
  school_profile_id bigint REFERENCES public.school_profiles(id) ON DELETE CASCADE,
  agency_profile_id bigint,
  profile_id bigint NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  content_hash text NOT NULL,
  pack_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_token text,
  is_public boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsnp_audit_school ON public.nsnp_audit_packs (school_profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nsnp_audit_public_token
  ON public.nsnp_audit_packs (public_token) WHERE public_token IS NOT NULL;

-- Serve-day log convenience columns on feeding
SELECT public.sa_add_column('school_feeding_days', 'nutrition_energy_kcal', 'numeric(10,2)');
SELECT public.sa_add_column('school_feeding_days', 'nutrition_protein_g', 'numeric(10,2)');
SELECT public.sa_add_column('school_feeding_days', 'nutrition_pass', 'boolean');
SELECT public.sa_add_column('school_feeding_days', 'cost_amount', 'numeric(12,2)');
SELECT public.sa_add_column('school_feeding_days', 'serve_day_complete', 'boolean', 'false');

COMMENT ON TABLE public.nsnp_peu_visits IS 'PEU/monitor field visits for NSNP W1';
COMMENT ON TABLE public.nsnp_claim_packs IS 'School claim/funding packs W2';
COMMENT ON TABLE public.nsnp_audit_packs IS 'Audit evidence packs with content hash W5';
