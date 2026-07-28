-- PEU visit planning + field pack enhancements

SELECT public.sa_add_column('nsnp_peu_visits', 'notify_school', 'boolean');
SELECT public.sa_add_column('nsnp_peu_visits', 'notified_at', 'timestamptz');
SELECT public.sa_add_column('nsnp_peu_visits', 'plan_id', 'bigint');
SELECT public.sa_add_column('nsnp_peu_visits', 'planned_date', 'date');
SELECT public.sa_add_column('nsnp_peu_visits', 'visit_type', 'text');
SELECT public.sa_add_column('nsnp_peu_visits', 'findings_summary', 'text');
SELECT public.sa_add_column('nsnp_peu_visits', 'riad_ids', 'jsonb');
SELECT public.sa_add_column('nsnp_peu_visits', 'arrived_at', 'timestamptz');
SELECT public.sa_add_column('nsnp_peu_visits', 'departed_at', 'timestamptz');
SELECT public.sa_add_column('nsnp_peu_visits', 'circuit', 'text');
SELECT public.sa_add_column('nsnp_peu_visits', 'district', 'text');
SELECT public.sa_add_column('nsnp_peu_visits', 'metadata', 'jsonb');

CREATE TABLE IF NOT EXISTS public.nsnp_peu_visit_plans (
  id bigserial PRIMARY KEY,
  agency_profile_id bigint NOT NULL,
  plan_date date NOT NULL,
  title text,
  visitor_name text,
  circuit text,
  district text,
  notes text,
  notify_schools boolean DEFAULT false,
  status text NOT NULL DEFAULT 'planned',
  -- planned | in_progress | completed | cancelled
  school_ids jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsnp_peu_plans_agency_date
  ON public.nsnp_peu_visit_plans (agency_profile_id, plan_date);

CREATE INDEX IF NOT EXISTS idx_nsnp_peu_visits_status
  ON public.nsnp_peu_visits (agency_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_nsnp_peu_visits_planned_date
  ON public.nsnp_peu_visits (agency_profile_id, planned_date);

COMMENT ON TABLE public.nsnp_peu_visit_plans IS
  'PEU day plans — multiple schools scheduled per day';
COMMENT ON COLUMN public.nsnp_peu_visits.notify_school IS
  'When true, school sees the planned visit on their dashboard';
