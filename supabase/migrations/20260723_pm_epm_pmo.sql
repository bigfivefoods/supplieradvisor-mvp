-- EPM / PMO: programmes, DMAIC gates, SDG projects, RIAD link.
-- Safe to re-run. Extends pm_projects when present.

-- ── Programmes (portfolio aggregation) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_programmes (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text,
  status text NOT NULL DEFAULT 'active',
  -- active | on_hold | completed | cancelled
  owner_name text,
  sponsor_name text,
  budget numeric(18,2),
  currency text DEFAULT 'ZAR',
  start_date date,
  target_date date,
  health text DEFAULT 'green',
  -- green | amber | red
  strategic_theme text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_programmes_profile
  ON public.pm_programmes (profile_id, status);

COMMENT ON TABLE public.pm_programmes IS
  'PMO programmes — aggregate related projects under a strategic outcome.';

-- ── Extend pm_projects ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pm_projects'
  ) THEN
    ALTER TABLE public.pm_projects ADD COLUMN IF NOT EXISTS programme_id bigint;
    ALTER TABLE public.pm_projects ADD COLUMN IF NOT EXISTS methodology text DEFAULT 'standard';
    -- standard | dmaic | sdg | hybrid
    ALTER TABLE public.pm_projects ADD COLUMN IF NOT EXISTS methodology_gate text;
    -- DMAIC: define | measure | analyze | improve | control
    ALTER TABLE public.pm_projects ADD COLUMN IF NOT EXISTS project_type text DEFAULT 'initiative';
    -- initiative | process_improvement | sdg | capital | digital | other
    ALTER TABLE public.pm_projects ADD COLUMN IF NOT EXISTS sdg_goal int;
    -- 1–17
    ALTER TABLE public.pm_projects ADD COLUMN IF NOT EXISTS sdg_targets jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE public.pm_projects ADD COLUMN IF NOT EXISTS problem_statement text;
    ALTER TABLE public.pm_projects ADD COLUMN IF NOT EXISTS goal_statement text;
    ALTER TABLE public.pm_projects ADD COLUMN IF NOT EXISTS charter_date date;
    ALTER TABLE public.pm_projects ADD COLUMN IF NOT EXISTS gate_entered_at timestamptz;
    ALTER TABLE public.pm_projects ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;

    BEGIN
      ALTER TABLE public.pm_projects
        DROP CONSTRAINT IF EXISTS pm_projects_programme_id_fkey;
      ALTER TABLE public.pm_projects
        ADD CONSTRAINT pm_projects_programme_id_fkey
        FOREIGN KEY (programme_id)
        REFERENCES public.pm_programmes(id) ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    CREATE INDEX IF NOT EXISTS idx_pm_projects_programme
      ON public.pm_projects (programme_id)
      WHERE programme_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_pm_projects_method
      ON public.pm_projects (profile_id, methodology, methodology_gate);
    CREATE INDEX IF NOT EXISTS idx_pm_projects_sdg
      ON public.pm_projects (profile_id, sdg_goal)
      WHERE sdg_goal IS NOT NULL;
  END IF;
END $$;

-- ── Gate / phase transition audit (DMAIC stage-gates) ───────────────────────
CREATE TABLE IF NOT EXISTS public.pm_gate_transitions (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id bigint NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  from_gate text,
  to_gate text NOT NULL,
  note text,
  checklist jsonb DEFAULT '[]'::jsonb,
  approved_by text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_gate_project
  ON public.pm_gate_transitions (project_id, created_at DESC);

COMMENT ON TABLE public.pm_gate_transitions IS
  'DMAIC / stage-gate transitions with optional checklist evidence.';

-- ── Project ↔ RIAD link ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_project_riads (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id bigint NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  riad_log_id bigint,
  -- soft link when riad_logs.id is bigint
  title text NOT NULL,
  riad_type text NOT NULL DEFAULT 'risk',
  -- risk | issue | action | decision
  status text NOT NULL DEFAULT 'open',
  severity text DEFAULT 'medium',
  rpn int,
  description text,
  owner_name text,
  due_date date,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_riad_project
  ON public.pm_project_riads (project_id, status);
CREATE INDEX IF NOT EXISTS idx_pm_riad_profile
  ON public.pm_project_riads (profile_id, status);

COMMENT ON TABLE public.pm_project_riads IS
  'Project-scoped RIAD (Risks, Issues, Actions, Decisions) log.';

-- Optional soft FK to riad_logs when table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'riad_logs'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pm_project_riads'
  ) THEN
    BEGIN
      ALTER TABLE public.pm_project_riads
        DROP CONSTRAINT IF EXISTS pm_project_riads_riad_log_id_fkey;
      ALTER TABLE public.pm_project_riads
        ADD CONSTRAINT pm_project_riads_riad_log_id_fkey
        FOREIGN KEY (riad_log_id)
        REFERENCES public.riad_logs(id) ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;
