-- Tier 1: Harden RLS on sensitive multi-tenant tables.
-- App still uses service role on the server AFTER JWT + membership checks.
-- These policies block direct anon/authenticated client access without membership context.
--
-- IMPORTANT: Run only after app APIs enforce requireCompanyAccess.
-- Service role bypasses RLS (by design). Anon key must NEVER have broad write access.

-- Helper: no-op if table missing
DO $$
BEGIN
  -- quality_inspections
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='quality_inspections') THEN
    ALTER TABLE public.quality_inspections ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS quality_inspections_service_all ON public.quality_inspections;
    DROP POLICY IF EXISTS quality_inspections_deny_anon ON public.quality_inspections;
    -- Deny broad public access; service role bypasses RLS
    CREATE POLICY quality_inspections_deny_anon ON public.quality_inspections
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='haccp_plans') THEN
    ALTER TABLE public.haccp_plans ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS haccp_plans_deny_anon ON public.haccp_plans;
    CREATE POLICY haccp_plans_deny_anon ON public.haccp_plans
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='haccp_ccps') THEN
    ALTER TABLE public.haccp_ccps ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS haccp_ccps_deny_anon ON public.haccp_ccps;
    CREATE POLICY haccp_ccps_deny_anon ON public.haccp_ccps
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='haccp_monitoring_logs') THEN
    ALTER TABLE public.haccp_monitoring_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS haccp_logs_deny_anon ON public.haccp_monitoring_logs;
    CREATE POLICY haccp_logs_deny_anon ON public.haccp_monitoring_logs
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pm_projects') THEN
    ALTER TABLE public.pm_projects ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS pm_projects_deny_anon ON public.pm_projects;
    CREATE POLICY pm_projects_deny_anon ON public.pm_projects
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pm_tasks') THEN
    ALTER TABLE public.pm_tasks ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS pm_tasks_deny_anon ON public.pm_tasks;
    CREATE POLICY pm_tasks_deny_anon ON public.pm_tasks
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pm_milestones') THEN
    ALTER TABLE public.pm_milestones ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS pm_milestones_deny_anon ON public.pm_milestones;
    CREATE POLICY pm_milestones_deny_anon ON public.pm_milestones
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pm_timesheets') THEN
    ALTER TABLE public.pm_timesheets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS pm_timesheets_deny_anon ON public.pm_timesheets;
    CREATE POLICY pm_timesheets_deny_anon ON public.pm_timesheets
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pm_risks') THEN
    ALTER TABLE public.pm_risks ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS pm_risks_deny_anon ON public.pm_risks;
    CREATE POLICY pm_risks_deny_anon ON public.pm_risks
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='esg_report_snapshots') THEN
    ALTER TABLE public.esg_report_snapshots ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS esg_snapshots_deny_anon ON public.esg_report_snapshots;
    CREATE POLICY esg_snapshots_deny_anon ON public.esg_report_snapshots
      FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;

  -- Core trade tables — deny anon direct access if not already
  FOREACH t IN ARRAY ARRAY[
    'purchase_orders',
    'stock_levels',
    'stock_transfer_orders',
    'products',
    'bank_transactions',
    'journal_entries',
    'business_users'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_deny_anon', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
        t || '_deny_anon', t
      );
    END IF;
  END LOOP;
END $$;
