-- SHEQ Phase A: ISO 45001 incidents + hazards, ISO 9001-style NCR/CAPA
-- Idempotent. Service-role APIs; deny-anon RLS when available.

-- ─── Incidents (ISO 45001) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sheq_incidents (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  public_ref TEXT,
  incident_type TEXT NOT NULL DEFAULT 'near_miss',
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  site_name TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reported_by TEXT,
  injured_person TEXT,
  immediate_action TEXT,
  root_cause TEXT,
  investigation_notes TEXT,
  closed_at TIMESTAMPTZ,
  ncr_id BIGINT,
  capa_id BIGINT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sheq_incidents_profile
  ON sheq_incidents (profile_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_sheq_incidents_status
  ON sheq_incidents (profile_id, status);

-- ─── Hazards / risks (ISO 45001 HIRARC lite) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS sheq_hazards (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  location TEXT,
  description TEXT,
  likelihood INT DEFAULT 3,
  severity INT DEFAULT 3,
  risk_score INT DEFAULT 9,
  residual_likelihood INT,
  residual_severity INT,
  residual_risk_score INT,
  controls TEXT,
  residual_controls TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  owner_name TEXT,
  review_due DATE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sheq_hazards_profile
  ON sheq_hazards (profile_id, status);

-- ─── Nonconformances (NCR) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sheq_ncrs (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  public_ref TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  domain TEXT NOT NULL DEFAULT 'quality',
  status TEXT NOT NULL DEFAULT 'open',
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  lot_number TEXT,
  product_id BIGINT,
  inspection_id BIGINT,
  incident_id BIGINT,
  raised_by TEXT,
  raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  containment TEXT,
  disposition TEXT,
  closed_at TIMESTAMPTZ,
  capa_id BIGINT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sheq_ncrs_profile
  ON sheq_ncrs (profile_id, raised_at DESC);
CREATE INDEX IF NOT EXISTS idx_sheq_ncrs_status
  ON sheq_ncrs (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_sheq_ncrs_inspection
  ON sheq_ncrs (profile_id, inspection_id)
  WHERE inspection_id IS NOT NULL;

-- ─── CAPA ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sheq_capas (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  public_ref TEXT,
  ncr_id BIGINT,
  incident_id BIGINT,
  title TEXT NOT NULL,
  description TEXT,
  root_cause TEXT,
  corrective_action TEXT,
  preventive_action TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  owner_name TEXT,
  due_date DATE,
  effectiveness_check TEXT,
  effectiveness_result TEXT,
  verified_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sheq_capas_profile
  ON sheq_capas (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sheq_capas_status
  ON sheq_capas (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_sheq_capas_ncr
  ON sheq_capas (ncr_id)
  WHERE ncr_id IS NOT NULL;

-- Soft FKs (no hard FK to quality_inspections — optional table)
COMMENT ON TABLE sheq_incidents IS 'ISO 45001 OH&S incidents and near-misses';
COMMENT ON TABLE sheq_hazards IS 'ISO 45001 hazard identification & risk assessment (HIRARC lite)';
COMMENT ON TABLE sheq_ncrs IS 'Nonconformance records (quality, safety, environment, food safety)';
COMMENT ON TABLE sheq_capas IS 'Corrective and preventive actions linked to NCR/incidents';

-- Deny-anon RLS when table exists (service role bypasses)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sheq_incidents','sheq_hazards','sheq_ncrs','sheq_capas']
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS deny_anon_all ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY deny_anon_all ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
        t
      );
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'RLS sheq % skip: %', t, SQLERRM;
    END;
  END LOOP;
END $$;
