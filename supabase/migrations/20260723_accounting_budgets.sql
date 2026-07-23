-- 12-month annual budget by chart of accounts line.
-- Safe to re-run. Used for plan vs actual in management accounts & reports.

CREATE TABLE IF NOT EXISTS public.accounting_budgets (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fiscal_year int NOT NULL, -- calendar year when the FY starts
  account_id bigint NOT NULL,
  -- Monthly amounts: FY periods 1–12 (m01 = first month of FY per accounting_settings.fiscal_year_start_month)
  m01 numeric(18,2) NOT NULL DEFAULT 0,
  m02 numeric(18,2) NOT NULL DEFAULT 0,
  m03 numeric(18,2) NOT NULL DEFAULT 0,
  m04 numeric(18,2) NOT NULL DEFAULT 0,
  m05 numeric(18,2) NOT NULL DEFAULT 0,
  m06 numeric(18,2) NOT NULL DEFAULT 0,
  m07 numeric(18,2) NOT NULL DEFAULT 0,
  m08 numeric(18,2) NOT NULL DEFAULT 0,
  m09 numeric(18,2) NOT NULL DEFAULT 0,
  m10 numeric(18,2) NOT NULL DEFAULT 0,
  m11 numeric(18,2) NOT NULL DEFAULT 0,
  m12 numeric(18,2) NOT NULL DEFAULT 0,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, fiscal_year, account_id)
);

CREATE INDEX IF NOT EXISTS idx_acct_budget_profile_year
  ON public.accounting_budgets (profile_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_acct_budget_account
  ON public.accounting_budgets (account_id);

COMMENT ON TABLE public.accounting_budgets IS
  'Annual 12-month budget per COA account. fiscal_year = year FY starts; m01–m12 = FY periods (not always Jan–Dec). FY start month lives on accounting_settings.fiscal_year_start_month.';

-- Optional: soft FK when chart_of_accounts exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chart_of_accounts'
  ) THEN
    BEGIN
      ALTER TABLE public.accounting_budgets
        DROP CONSTRAINT IF EXISTS accounting_budgets_account_id_fkey;
      ALTER TABLE public.accounting_budgets
        ADD CONSTRAINT accounting_budgets_account_id_fkey
        FOREIGN KEY (account_id)
        REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;
