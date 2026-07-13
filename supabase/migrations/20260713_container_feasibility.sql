-- Container regional deployment feasibility scenarios

CREATE TABLE IF NOT EXISTS public.container_feasibility_scenarios (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  name TEXT NOT NULL DEFAULT 'New site scenario',
  region_city TEXT,
  region_province TEXT,
  region_country TEXT DEFAULT 'South Africa',
  currency TEXT NOT NULL DEFAULT 'ZAR',
  notes TEXT,
  -- Full inputs JSON (flexible assumptions)
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Cached results snapshot for list views
  results JSONB,
  feasibility_score numeric(6,2),
  feasibility_band TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_container_feasibility_profile
  ON public.container_feasibility_scenarios (profile_id);

CREATE INDEX IF NOT EXISTS idx_container_feasibility_score
  ON public.container_feasibility_scenarios (profile_id, feasibility_score DESC);

COMMENT ON TABLE public.container_feasibility_scenarios IS
  'Region / site feasibility scenarios for container deployment (demand, capex, opex, income)';

DO $$
BEGIN
  ALTER TABLE public.container_feasibility_scenarios ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS deny_anon_all ON public.container_feasibility_scenarios;
  CREATE POLICY deny_anon_all ON public.container_feasibility_scenarios
    FOR ALL TO anon USING (false) WITH CHECK (false);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'feasibility RLS skip: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
