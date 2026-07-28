-- KZN NSNP Monitoring Tool (2026-27) — DBE/PEU field worker submissions
CREATE TABLE IF NOT EXISTS public.nsnp_monitoring_tools (
  id bigserial PRIMARY KEY,
  agency_profile_id bigint NOT NULL,
  school_profile_id bigint REFERENCES public.school_profiles(id) ON DELETE SET NULL,
  school_company_id bigint,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft', -- draft | submitted
  monitor_name text,
  tool_version text NOT NULL DEFAULT 'KZN-2026-27',
  form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  overall_kpi numeric(6,2),
  rkmp_score numeric(6,2),
  nehs_score numeric(6,2),
  gardens_score numeric(6,2),
  traffic_light text, -- green | yellow | red
  photo_urls text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsnp_monitoring_agency_date
  ON public.nsnp_monitoring_tools (agency_profile_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_nsnp_monitoring_school
  ON public.nsnp_monitoring_tools (school_profile_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_nsnp_monitoring_status
  ON public.nsnp_monitoring_tools (agency_profile_id, status);

COMMENT ON TABLE public.nsnp_monitoring_tools IS
  'DBE/PEU field-worker NSNP Monitoring Tool (KZN 2026-27 paper form digitised). Schools can view submitted visits.';
