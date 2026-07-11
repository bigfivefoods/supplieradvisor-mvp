-- HACCP + Project Management suite tables (idempotent)

-- ─── HACCP ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS haccp_plans (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  product_scope TEXT,
  process_step TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  version INT NOT NULL DEFAULT 1,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_haccp_plans_profile ON haccp_plans (profile_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS haccp_ccps (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  plan_id BIGINT NOT NULL REFERENCES haccp_plans(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  hazard TEXT,
  control_measure TEXT,
  critical_limit TEXT,
  monitoring_method TEXT,
  corrective_action TEXT,
  frequency TEXT,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_haccp_ccps_plan ON haccp_ccps (plan_id);

CREATE TABLE IF NOT EXISTS haccp_monitoring_logs (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  plan_id BIGINT,
  ccp_id BIGINT,
  lot_number TEXT,
  measured_value TEXT,
  within_limit BOOLEAN,
  result TEXT NOT NULL DEFAULT 'ok',
  operator_name TEXT,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_haccp_logs_profile ON haccp_monitoring_logs (profile_id, recorded_at DESC);

-- ─── Project Management ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pm_projects (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
  priority TEXT DEFAULT 'medium',
  owner_name TEXT,
  budget NUMERIC,
  currency TEXT DEFAULT 'ZAR',
  start_date DATE,
  target_date DATE,
  progress INT DEFAULT 0,
  health TEXT DEFAULT 'green',
  tags JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_projects_profile ON pm_projects (profile_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS pm_tasks (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  project_id BIGINT NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog',
  column_key TEXT NOT NULL DEFAULT 'backlog',
  assignee TEXT,
  priority TEXT DEFAULT 'medium',
  estimate_hours NUMERIC,
  sort_order INT DEFAULT 0,
  due_date DATE,
  labels JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_project ON pm_tasks (project_id, column_key, sort_order);

CREATE TABLE IF NOT EXISTS pm_milestones (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  project_id BIGINT NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
  done BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_milestones_project ON pm_milestones (project_id);

CREATE TABLE IF NOT EXISTS pm_timesheets (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  project_id BIGINT,
  task_id BIGINT,
  user_name TEXT,
  work_date DATE NOT NULL,
  hours NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  billable BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_timesheets_profile ON pm_timesheets (profile_id, work_date DESC);

CREATE TABLE IF NOT EXISTS pm_risks (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  project_id BIGINT,
  title TEXT NOT NULL,
  description TEXT,
  likelihood INT DEFAULT 3,
  impact INT DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'open',
  mitigation TEXT,
  owner_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_risks_profile ON pm_risks (profile_id);

-- ─── ESG pack snapshots (optional cache) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS esg_report_snapshots (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  period_start DATE,
  period_end DATE,
  pack JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_esg_snapshots_profile ON esg_report_snapshots (profile_id, created_at DESC);
