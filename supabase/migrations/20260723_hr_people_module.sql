-- HR / People module: employees, cost-object allocation, leave, payroll.
-- World-class structure. Safe to re-run. Extends public.employees when present.

-- ── Expand employees (HR master) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employees (
  id bigserial PRIMARY KEY,
  profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id text,
  full_name text NOT NULL,
  email text,
  phone text,
  job_title text,
  department text,
  employment_type text DEFAULT 'full_time',
  status text NOT NULL DEFAULT 'active',
  start_date date,
  end_date date,
  manager_id bigint,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'employees'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employee_number text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS first_name text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS last_name text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS preferred_name text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS mobile text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS id_number text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS passport_number text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS nationality text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS date_of_birth date;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS gender text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS address_line1 text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS address_line2 text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS city text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS province text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS postal_code text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS country text DEFAULT 'ZA';
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_contact_name text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_contact_relation text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS probation_end_date date;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS work_email text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS cost_centre_code text;
    -- Primary cost objects
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS business_unit_id bigint;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS work_center_id bigint;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS work_station_id bigint;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS asset_id bigint;
    -- Compensation
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salary_basic numeric(18,2) DEFAULT 0;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salary_currency text DEFAULT 'ZAR';
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pay_frequency text DEFAULT 'monthly';
    -- monthly | biweekly | weekly | hourly
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS hourly_rate numeric(18,4) DEFAULT 0;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS tax_number text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS tax_status text DEFAULT 'standard';
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_name text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_account_number text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_branch_code text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_account_type text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS leave_balance_days numeric(8,2) DEFAULT 0;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS sick_balance_days numeric(8,2) DEFAULT 0;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS notes text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo_url text;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS onboarding_status text DEFAULT 'not_started';
    -- not_started | in_progress | complete
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS onboarding_checklist jsonb DEFAULT '[]'::jsonb;

    CREATE INDEX IF NOT EXISTS idx_employees_profile ON public.employees (profile_id);
    CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees (profile_id, status);
    CREATE INDEX IF NOT EXISTS idx_employees_bu ON public.employees (business_unit_id)
      WHERE business_unit_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_employees_number ON public.employees (profile_id, employee_number);
  END IF;
END $$;

COMMENT ON TABLE public.employees IS
  'HR employee master — personal, job, pay, and primary cost-object placement.';

-- ── Multi-way cost object allocations (BU / cell / station / asset) ──────────
CREATE TABLE IF NOT EXISTS public.hr_employee_allocations (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id bigint NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  business_unit_id bigint,
  work_center_id bigint,
  work_station_id bigint,
  asset_id bigint,
  allocation_pct numeric(8,4) NOT NULL DEFAULT 100,
  role_label text,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_alloc_emp
  ON public.hr_employee_allocations (employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_alloc_profile
  ON public.hr_employee_allocations (profile_id);
CREATE INDEX IF NOT EXISTS idx_hr_alloc_bu
  ON public.hr_employee_allocations (business_unit_id)
  WHERE business_unit_id IS NOT NULL;

COMMENT ON TABLE public.hr_employee_allocations IS
  'Allocate headcount / labour cost across BUs, work centres, stations, assets.';

-- ── Leave types & requests ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_leave_types (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  paid boolean NOT NULL DEFAULT true,
  annual_allowance_days numeric(8,2) DEFAULT 15,
  requires_approval boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, code)
);

CREATE INDEX IF NOT EXISTS idx_hr_leave_types_profile
  ON public.hr_leave_types (profile_id);

CREATE TABLE IF NOT EXISTS public.hr_leave_requests (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id bigint NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id bigint REFERENCES public.hr_leave_types(id) ON DELETE SET NULL,
  leave_type_code text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days numeric(8,2) NOT NULL DEFAULT 1,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  -- pending | approved | rejected | cancelled
  approved_by text,
  approved_at timestamptz,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_leave_req_profile
  ON public.hr_leave_requests (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_leave_req_emp
  ON public.hr_leave_requests (employee_id);

-- ── Performance reviews ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_performance_reviews (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id bigint NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewer_name text,
  period_label text,
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  overall_score numeric(4,2),
  rating text,
  -- exceeds | meets | developing | needs_improvement
  goals text,
  strengths text,
  improvements text,
  status text NOT NULL DEFAULT 'draft',
  -- draft | submitted | acknowledged
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_perf_profile
  ON public.hr_performance_reviews (profile_id);
CREATE INDEX IF NOT EXISTS idx_hr_perf_emp
  ON public.hr_performance_reviews (employee_id);

-- ── Payroll runs & lines ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_payroll_runs (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_year int NOT NULL,
  period_month int NOT NULL,
  period_label text,
  pay_date date,
  status text NOT NULL DEFAULT 'draft',
  -- draft | calculated | approved | paid | void
  currency text NOT NULL DEFAULT 'ZAR',
  employee_count int DEFAULT 0,
  total_gross numeric(18,2) DEFAULT 0,
  total_deductions numeric(18,2) DEFAULT 0,
  total_employer_cost numeric(18,2) DEFAULT 0,
  total_net numeric(18,2) DEFAULT 0,
  journal_entry_id bigint,
  notes text,
  created_by text,
  approved_by text,
  approved_at timestamptz,
  paid_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_hr_payrun_profile
  ON public.hr_payroll_runs (profile_id, period_year DESC, period_month DESC);

CREATE TABLE IF NOT EXISTS public.hr_payroll_lines (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payroll_run_id bigint NOT NULL REFERENCES public.hr_payroll_runs(id) ON DELETE CASCADE,
  employee_id bigint NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name text,
  employee_number text,
  business_unit_id bigint,
  work_center_id bigint,
  basic_pay numeric(18,2) NOT NULL DEFAULT 0,
  allowances numeric(18,2) NOT NULL DEFAULT 0,
  overtime numeric(18,2) NOT NULL DEFAULT 0,
  gross_pay numeric(18,2) NOT NULL DEFAULT 0,
  paye numeric(18,2) NOT NULL DEFAULT 0,
  uif_employee numeric(18,2) NOT NULL DEFAULT 0,
  uif_employer numeric(18,2) NOT NULL DEFAULT 0,
  other_deductions numeric(18,2) NOT NULL DEFAULT 0,
  total_deductions numeric(18,2) NOT NULL DEFAULT 0,
  net_pay numeric(18,2) NOT NULL DEFAULT 0,
  employer_cost numeric(18,2) NOT NULL DEFAULT 0,
  hours_worked numeric(10,2),
  currency text DEFAULT 'ZAR',
  cost_entry_id bigint,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_payline_run
  ON public.hr_payroll_lines (payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_hr_payline_emp
  ON public.hr_payroll_lines (employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_payline_bu
  ON public.hr_payroll_lines (business_unit_id)
  WHERE business_unit_id IS NOT NULL;

COMMENT ON TABLE public.hr_payroll_runs IS
  'Monthly (or period) payroll batch — calculate, approve, pay, optional GL post.';
COMMENT ON TABLE public.hr_payroll_lines IS
  'Per-employee payslip lines with cost object dims for BS/P&L allocation.';

-- ── Ensure training_records has employee link ────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'training_records'
  ) THEN
    ALTER TABLE public.training_records
      ADD COLUMN IF NOT EXISTS employee_id bigint;
    ALTER TABLE public.training_records
      ADD COLUMN IF NOT EXISTS course_name text;
    ALTER TABLE public.training_records
      ADD COLUMN IF NOT EXISTS provider text;
    ALTER TABLE public.training_records
      ADD COLUMN IF NOT EXISTS status text DEFAULT 'assigned';
    ALTER TABLE public.training_records
      ADD COLUMN IF NOT EXISTS completed_at timestamptz;
    ALTER TABLE public.training_records
      ADD COLUMN IF NOT EXISTS due_date date;
    ALTER TABLE public.training_records
      ADD COLUMN IF NOT EXISTS score numeric(6,2);
    ALTER TABLE public.training_records
      ADD COLUMN IF NOT EXISTS certificate_url text;
  END IF;
END $$;
