-- Sprints A–E: activity events, agency tariffs, claim audit, period locks,
-- survey rate limit, privacy, RLS baseline for schools/nsnp tables

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

-- Activity / soft notifications
CREATE TABLE IF NOT EXISTS public.nsnp_activity_events (
  id bigserial PRIMARY KEY,
  company_id bigint NOT NULL,
  target_company_id bigint,
  school_profile_id bigint,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  href text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nsnp_events_company
  ON public.nsnp_activity_events (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nsnp_events_target
  ON public.nsnp_activity_events (target_company_id, created_at DESC);

-- Agency meal tariff (ZAR per meal)
SELECT public.sa_add_column('nsnp_agency_profiles', 'meal_tariff_zar', 'numeric(10,2)');
SELECT public.sa_add_column('nsnp_agency_profiles', 'meal_tariff_breakfast_zar', 'numeric(10,2)');
SELECT public.sa_add_column('nsnp_agency_profiles', 'meal_tariff_lunch_zar', 'numeric(10,2)');
SELECT public.sa_add_column('nsnp_agency_profiles', 'claims_locked', 'boolean');

-- Claim audit trail
SELECT public.sa_add_column('nsnp_claim_packs', 'audit_log', 'jsonb');
SELECT public.sa_add_column('nsnp_claim_packs', 'period_locked', 'boolean');
SELECT public.sa_add_column('nsnp_claim_packs', 'tariff_zar', 'numeric(10,2)');
SELECT public.sa_add_column('nsnp_claim_packs', 'reviewed_by', 'text');

-- School privacy
SELECT public.sa_add_column('school_profiles', 'privacy_mode', 'boolean');

-- Delivery OTIF
SELECT public.sa_add_column('school_nsnp_deliveries', 'otif', 'boolean');
SELECT public.sa_add_column('school_nsnp_deliveries', 'otif_notes', 'text');

-- Survey rate limit (IP + token bucket)
CREATE TABLE IF NOT EXISTS public.school_survey_rate_limits (
  id bigserial PRIMARY KEY,
  token_hash text NOT NULL,
  client_key text NOT NULL,
  hits int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_hash, client_key)
);

-- PEU visit enrich
SELECT public.sa_add_column('nsnp_peu_visits', 'accuracy_m', 'numeric(10,2)');
SELECT public.sa_add_column('nsnp_peu_visits', 'offline_synced', 'boolean');

-- Claim period locks (agency)
CREATE TABLE IF NOT EXISTS public.nsnp_claim_period_locks (
  id bigserial PRIMARY KEY,
  agency_profile_id bigint NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  locked boolean NOT NULL DEFAULT true,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  notes text,
  UNIQUE (agency_profile_id, period_from, period_to)
);

-- ── RLS baseline: deny anon; service role / authenticated app uses service role BFF ──
-- Enable RLS so direct PostgREST anon cannot read learner PII.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'school_profiles',
    'school_learners',
    'school_staff',
    'school_kitchen_stock',
    'school_kitchen_receipts',
    'school_purchase_orders',
    'school_feeding_days',
    'school_attendance_days',
    'school_menu_cycles',
    'school_compliance_events',
    'school_agency_links',
    'school_isp_links',
    'school_food_surveys',
    'school_food_survey_responses',
    'school_maintenance_items',
    'school_nsnp_deliveries',
    'school_nsnp_delivery_files',
    'school_nsnp_order_files',
    'nsnp_agency_profiles',
    'nsnp_isp_profiles',
    'nsnp_claim_packs',
    'nsnp_prize_scores',
    'nsnp_peu_visits',
    'nsnp_audit_packs',
    'nsnp_activity_events',
    'nsnp_alerts',
    'nsnp_claim_period_locks',
    'school_survey_rate_limits'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      -- Revoke direct anon access; BFF uses service role
      BEGIN
        EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'revoke anon % skip: %', t, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE public.nsnp_activity_events IS 'NSNP soft notifications and audit feed';
COMMENT ON TABLE public.nsnp_claim_period_locks IS 'Agency locks claim periods against re-submit';
COMMENT ON TABLE public.school_survey_rate_limits IS 'Public survey anti-abuse windows';
