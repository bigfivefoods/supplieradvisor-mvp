-- Joint customer / supplier projects (waterfall Gantt).
-- Safe to re-run. Extends pm_projects / pm_tasks when present.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pm_projects'
  ) THEN
    ALTER TABLE public.pm_projects ADD COLUMN IF NOT EXISTS customer_id bigint;
    ALTER TABLE public.pm_projects ADD COLUMN IF NOT EXISTS supplier_id bigint;
    CREATE INDEX IF NOT EXISTS idx_pm_projects_customer
      ON public.pm_projects (profile_id, customer_id)
      WHERE customer_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_pm_projects_supplier
      ON public.pm_projects (profile_id, supplier_id)
      WHERE supplier_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pm_tasks'
  ) THEN
    ALTER TABLE public.pm_tasks ADD COLUMN IF NOT EXISTS start_date date;
    ALTER TABLE public.pm_tasks ADD COLUMN IF NOT EXISTS depends_on bigint;
    ALTER TABLE public.pm_tasks ADD COLUMN IF NOT EXISTS phase_key text;
    CREATE INDEX IF NOT EXISTS idx_pm_tasks_phase
      ON public.pm_tasks (project_id, phase_key, sort_order);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
