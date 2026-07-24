-- World-class Sustainability / ESG suite.
-- Extends carbon_entries & sustainability_certificates; adds targets, resources, initiatives, materiality.
-- Safe to re-run.

-- ── GHG inventory entries (Scopes 1 / 2 / 3) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.esg_emissions (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- GHG Protocol scopes
  scope text NOT NULL DEFAULT '1',
  -- 1 | 2 | 3
  category text NOT NULL,
  -- e.g. stationary_combustion, purchased_electricity, upstream_transport
  activity_label text,
  activity_amount numeric(18,4),
  activity_unit text,
  -- kWh | litres | km | tonnes | m3 | hours | other
  emission_factor numeric(18,8),
  factor_unit text,
  -- kgCO2e per activity unit
  factor_source text,
  amount_kgco2e numeric(18,4) NOT NULL DEFAULT 0,
  period_start date,
  period_end date,
  facility_name text,
  country text,
  is_estimate boolean DEFAULT true,
  data_quality text DEFAULT 'estimated',
  -- measured | calculated | estimated | spend_based
  notes text,
  source_ref text,
  -- shipment id, invoice ref, meter, etc.
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esg_emissions_profile
  ON public.esg_emissions (profile_id, scope, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_esg_emissions_period
  ON public.esg_emissions (profile_id, period_end DESC);

COMMENT ON TABLE public.esg_emissions IS
  'GHG inventory line items by scope/category (GHG Protocol-aligned). Estimates labelled honestly.';

-- ── Reduce targets (SBTi-style pathways, informal) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.esg_targets (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  metric text NOT NULL DEFAULT 'ghg_total',
  -- ghg_total | ghg_scope1 | ghg_scope2 | ghg_scope3 | water | waste | energy | renewable_pct | other
  unit text DEFAULT 'tCO2e',
  baseline_year int,
  baseline_value numeric(18,4),
  target_year int,
  target_value numeric(18,4),
  reduction_pct numeric(8,2),
  -- e.g. 42 for 42% reduction
  pathway text DEFAULT 'absolute',
  -- absolute | intensity
  status text NOT NULL DEFAULT 'active',
  -- draft | active | achieved | missed | retired
  framework text,
  -- SBTi | NetZero | internal | CSRD | other
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esg_targets_profile
  ON public.esg_targets (profile_id, status);

COMMENT ON TABLE public.esg_targets IS
  'Climate and resource reduction targets with baseline and horizon years.';

-- ── Water / waste / energy resource metrics ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.esg_resources (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  -- water | waste | energy
  category text NOT NULL,
  -- withdrawal | discharge | recycled | landfill | recycled_waste | hazardous | electricity | fuel | renewable
  amount numeric(18,4) NOT NULL DEFAULT 0,
  unit text NOT NULL,
  -- m3 | litres | kWh | MWh | tonnes | kg
  period_start date,
  period_end date,
  facility_name text,
  notes text,
  is_estimate boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esg_resources_profile
  ON public.esg_resources (profile_id, resource_type, period_start DESC);

COMMENT ON TABLE public.esg_resources IS
  'Water, waste, and energy operational metrics for ESG resource stewardship.';

-- ── Certificates (extend existing table if present) ──────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sustainability_certificates'
  ) THEN
    ALTER TABLE public.sustainability_certificates
      ADD COLUMN IF NOT EXISTS certificate_type text DEFAULT 'other';
    ALTER TABLE public.sustainability_certificates
      ADD COLUMN IF NOT EXISTS scope_notes text;
    ALTER TABLE public.sustainability_certificates
      ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;
    ALTER TABLE public.sustainability_certificates
      ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
    ALTER TABLE public.sustainability_certificates
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
    ALTER TABLE public.sustainability_certificates
      ADD COLUMN IF NOT EXISTS created_by text;
  ELSE
    CREATE TABLE public.sustainability_certificates (
      id bigserial PRIMARY KEY,
      profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
      name text NOT NULL,
      standard text,
      issuer text,
      issued_at date,
      expires_at date,
      file_url text,
      status text DEFAULT 'active',
      certificate_type text DEFAULT 'other',
      scope_notes text,
      verified boolean DEFAULT false,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sust_certs_profile
  ON public.sustainability_certificates (profile_id, status);

-- ── ESG initiatives / action plans ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.esg_initiatives (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  pillar text DEFAULT 'environment',
  -- environment | social | governance
  status text NOT NULL DEFAULT 'planned',
  -- planned | in_progress | completed | on_hold | cancelled
  owner_name text,
  target_id bigint,
  project_id bigint,
  -- soft links
  sdg_goal int,
  start_date date,
  target_date date,
  estimated_impact text,
  progress int DEFAULT 0,
  -- 0–100
  health text DEFAULT 'green',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esg_initiatives_profile
  ON public.esg_initiatives (profile_id, status);

COMMENT ON TABLE public.esg_initiatives IS
  'Sustainability improvement initiatives; optional link to targets, PM projects, SDGs.';

-- ── Materiality topics (double materiality lite) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.esg_materiality (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic text NOT NULL,
  pillar text DEFAULT 'environment',
  -- environment | social | governance
  impact_score int DEFAULT 3,
  -- 1–5 impact materiality
  financial_score int DEFAULT 3,
  -- 1–5 financial materiality
  priority text DEFAULT 'medium',
  -- low | medium | high | critical
  notes text,
  framework_tags text[] DEFAULT '{}',
  -- GRI | ISSB | CSRD | SASB etc.
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esg_materiality_profile
  ON public.esg_materiality (profile_id);

COMMENT ON TABLE public.esg_materiality IS
  'Double-materiality lite: impact vs financial score per ESG topic.';

-- Soft-extend legacy carbon_entries if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'carbon_entries'
  ) THEN
    ALTER TABLE public.carbon_entries ADD COLUMN IF NOT EXISTS scope text DEFAULT '3';
    ALTER TABLE public.carbon_entries ADD COLUMN IF NOT EXISTS facility_name text;
    ALTER TABLE public.carbon_entries ADD COLUMN IF NOT EXISTS data_quality text DEFAULT 'estimated';
  END IF;
END $$;
