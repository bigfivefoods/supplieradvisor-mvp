-- Sales and CRM diary. One task row per follow-up, linked to the customer book and a deal.
-- Does not insert tasks. Paste the root copy RUN_THIS_FOR_CRM_TASKS.sql if you are rebuilding a database.

CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  customer_id BIGINT,
  opportunity_id BIGINT,
  title TEXT NOT NULL,
  notes TEXT,
  kind TEXT NOT NULL DEFAULT 'task',
  status TEXT NOT NULL DEFAULT 'open',
  due_on DATE NOT NULL,
  due_time TEXT,
  assignee_user_id TEXT,
  assignee_name TEXT,
  created_by TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_profile_due
  ON public.crm_tasks (profile_id, due_on, status);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_customer
  ON public.crm_tasks (profile_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_opportunity
  ON public.crm_tasks (profile_id, opportunity_id);

ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.crm_tasks FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.crm_tasks TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.crm_tasks_id_seq TO service_role;

NOTIFY pgrst, 'reload schema';
