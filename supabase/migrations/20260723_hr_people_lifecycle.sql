-- HR lifecycle: disciplinary, performance ratings, positions, organogram helpers.
-- Safe to re-run. Complements 20260723_hr_people_module.sql.

-- ── Extra employee organogram / placement fields ─────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'employees'
  ) THEN
    ALTER TABLE public.employees
      ADD COLUMN IF NOT EXISTS reports_to_employee_id bigint;
    -- alias: manager_id already exists; keep both in sync in app
    ALTER TABLE public.employees
      ADD COLUMN IF NOT EXISTS position_title text;
    ALTER TABLE public.employees
      ADD COLUMN IF NOT EXISTS position_level text;
    -- executive | senior | mid | junior | entry | contractor
    ALTER TABLE public.employees
      ADD COLUMN IF NOT EXISTS headcount_type text DEFAULT 'permanent';
    -- permanent | temporary | contractor | intern
    ALTER TABLE public.employees
      ADD COLUMN IF NOT EXISTS fte numeric(6,3) DEFAULT 1;
    ALTER TABLE public.employees
      ADD COLUMN IF NOT EXISTS last_performance_rating text;
    ALTER TABLE public.employees
      ADD COLUMN IF NOT EXISTS last_performance_score numeric(4,2);
    ALTER TABLE public.employees
      ADD COLUMN IF NOT EXISTS last_review_date date;
    ALTER TABLE public.employees
      ADD COLUMN IF NOT EXISTS disciplinary_status text DEFAULT 'clear';
    -- clear | verbal | written | final | suspension | dismissal_pending
    CREATE INDEX IF NOT EXISTS idx_employees_manager
      ON public.employees (manager_id)
      WHERE manager_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_employees_reports_to
      ON public.employees (reports_to_employee_id)
      WHERE reports_to_employee_id IS NOT NULL;
  END IF;
END $$;

-- ── Disciplinary cases ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_disciplinary_cases (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id bigint NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  case_number text,
  case_type text NOT NULL DEFAULT 'misconduct',
  -- misconduct | performance | attendance | policy | safety | other
  severity text NOT NULL DEFAULT 'verbal',
  -- verbal | written | final | suspension | dismissal
  title text NOT NULL,
  description text,
  incident_date date,
  raised_date date NOT NULL DEFAULT CURRENT_DATE,
  raised_by text,
  status text NOT NULL DEFAULT 'open',
  -- open | investigation | hearing | sanction | closed | withdrawn
  outcome text,
  -- none | counselling | verbal_warning | written_warning | final_warning | suspension | dismissal
  hearing_date date,
  sanction_start date,
  sanction_end date,
  appeal_deadline date,
  business_unit_id bigint,
  work_center_id bigint,
  related_policy text,
  notes text,
  documents jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_disc_profile
  ON public.hr_disciplinary_cases (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_disc_emp
  ON public.hr_disciplinary_cases (employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_disc_bu
  ON public.hr_disciplinary_cases (business_unit_id)
  WHERE business_unit_id IS NOT NULL;

COMMENT ON TABLE public.hr_disciplinary_cases IS
  'Disciplinary / corrective process records for employees.';

CREATE TABLE IF NOT EXISTS public.hr_disciplinary_events (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  case_id bigint NOT NULL REFERENCES public.hr_disciplinary_cases(id) ON DELETE CASCADE,
  event_date timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL DEFAULT 'note',
  -- note | investigation | hearing | sanction | appeal | close
  summary text NOT NULL,
  actor_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_disc_events_case
  ON public.hr_disciplinary_events (case_id);

-- ── Continuous performance ratings (beyond formal reviews) ───────────────────
CREATE TABLE IF NOT EXISTS public.hr_performance_ratings (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id bigint NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  rated_by_employee_id bigint,
  rated_by_name text,
  rating_date date NOT NULL DEFAULT CURRENT_DATE,
  period_label text,
  overall_score numeric(4,2) NOT NULL,
  -- 1.00 – 5.00
  rating_label text,
  -- exceeds | meets | developing | needs_improvement
  quality_score numeric(4,2),
  delivery_score numeric(4,2),
  teamwork_score numeric(4,2),
  leadership_score numeric(4,2),
  comments text,
  is_official boolean NOT NULL DEFAULT false,
  -- official cycle vs continuous feedback
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_rating_emp
  ON public.hr_performance_ratings (employee_id, rating_date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_rating_profile
  ON public.hr_performance_ratings (profile_id);

COMMENT ON TABLE public.hr_performance_ratings IS
  'Point-in-time performance ratings (official cycle or continuous).';

-- ── Recognition / awards (optional people aspect) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_recognition (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id bigint NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  given_by text,
  title text NOT NULL,
  category text DEFAULT 'kudos',
  -- kudos | award | promotion | milestone
  notes text,
  recognition_date date NOT NULL DEFAULT CURRENT_DATE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_recog_emp
  ON public.hr_recognition (employee_id);
