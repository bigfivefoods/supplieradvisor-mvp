-- Accounting module: extend GL, AR/AP, bank, tax, fixed assets, entities, periods.
-- Safe to re-run. Depends on chart_of_accounts, journal_*, invoices, payments from world_class_schema.
-- Uses existing helpers sa_add_column / sa_create_index (p_columns) — do not redefine them
-- (CREATE OR REPLACE cannot rename parameters → 42P13).

-- ── Chart of accounts extras ─────────────────────────────────────────────────
SELECT public.sa_add_column('chart_of_accounts', 'subtype', 'text');
SELECT public.sa_add_column('chart_of_accounts', 'description', 'text');
SELECT public.sa_add_column('chart_of_accounts', 'is_system', 'boolean', 'false');
SELECT public.sa_add_column('chart_of_accounts', 'is_header', 'boolean', 'false');
SELECT public.sa_add_column('chart_of_accounts', 'tax_code', 'text');
SELECT public.sa_add_column('chart_of_accounts', 'normal_balance', 'text'); -- debit | credit
SELECT public.sa_add_column('chart_of_accounts', 'entity_id', 'bigint');
SELECT public.sa_add_column('chart_of_accounts', 'sort_order', 'int', '0');
SELECT public.sa_create_index('idx_coa_profile', 'chart_of_accounts', 'profile_id');
SELECT public.sa_create_index('idx_coa_code', 'chart_of_accounts', 'profile_id, code');

-- ── Journal extras ───────────────────────────────────────────────────────────
SELECT public.sa_add_column('journal_entries', 'entry_number', 'text');
SELECT public.sa_add_column('journal_entries', 'entity_id', 'bigint');
SELECT public.sa_add_column('journal_entries', 'period_id', 'bigint');
SELECT public.sa_add_column('journal_entries', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('journal_entries', 'posted_at', 'timestamptz');
SELECT public.sa_add_column('journal_entries', 'onchain_tx', 'text');
SELECT public.sa_add_column('journal_entries', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_create_index('idx_je_profile', 'journal_entries', 'profile_id');
SELECT public.sa_create_index('idx_je_date', 'journal_entries', 'profile_id, entry_date');

SELECT public.sa_add_column('journal_lines', 'profile_id', 'bigint');
SELECT public.sa_add_column('journal_lines', 'entity_id', 'bigint');
SELECT public.sa_add_column('journal_lines', 'counterparty', 'text');
SELECT public.sa_add_column('journal_lines', 'tax_code', 'text');
SELECT public.sa_add_column('journal_lines', 'project_id', 'bigint');
SELECT public.sa_create_index('idx_jl_entry', 'journal_lines', 'journal_entry_id');
SELECT public.sa_create_index('idx_jl_account', 'journal_lines', 'account_id');

-- ── Invoices extras ──────────────────────────────────────────────────────────
SELECT public.sa_add_column('invoices', 'customer_id', 'bigint');
SELECT public.sa_add_column('invoices', 'supplier_id', 'bigint');
SELECT public.sa_add_column('invoices', 'order_id', 'bigint');
SELECT public.sa_add_column('invoices', 'items', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('invoices', 'tax_rate', 'numeric(8,4)', '15');
SELECT public.sa_add_column('invoices', 'entity_id', 'bigint');
SELECT public.sa_add_column('invoices', 'paid_at', 'timestamptz');
SELECT public.sa_add_column('invoices', 'bill_to_email', 'text');
SELECT public.sa_add_column('invoices', 'billing_address', 'text');
SELECT public.sa_create_index('idx_invoices_direction', 'invoices', 'profile_id, direction');
SELECT public.sa_create_index('idx_invoices_status', 'invoices', 'profile_id, status');

-- ── Payments extras ──────────────────────────────────────────────────────────
SELECT public.sa_add_column('payments', 'counterparty_name', 'text');
SELECT public.sa_add_column('payments', 'bank_account_id', 'bigint');
SELECT public.sa_add_column('payments', 'entity_id', 'bigint');
SELECT public.sa_add_column('payments', 'notes', 'text');
SELECT public.sa_create_index('idx_payments_profile', 'payments', 'profile_id');
SELECT public.sa_create_index('idx_payments_invoice', 'payments', 'invoice_id');

-- ── Legal entities ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accounting_entities (
  id bigserial PRIMARY KEY,
  profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  legal_name text,
  country text DEFAULT 'ZA',
  currency text DEFAULT 'ZAR',
  tax_number text,
  registration_number text,
  is_primary boolean DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  address text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('accounting_entities', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_acc_entities_profile', 'accounting_entities', 'profile_id');

-- ── Accounting periods ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accounting_periods (
  id bigserial PRIMARY KEY,
  profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  entity_id bigint,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open', -- open | closed | locked
  fiscal_year int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('accounting_periods', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_acc_periods_profile', 'accounting_periods', 'profile_id');

-- ── Accounting settings (one row per company) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accounting_settings (
  id bigserial PRIMARY KEY,
  profile_id bigint UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_currency text DEFAULT 'ZAR',
  fiscal_year_start_month int DEFAULT 3, -- SA often Mar (1=Jan)
  default_tax_rate numeric(8,4) DEFAULT 15,
  invoice_prefix_ar text DEFAULT 'INV',
  invoice_prefix_ap text DEFAULT 'BILL',
  journal_prefix text DEFAULT 'JE',
  next_ar_number int DEFAULT 1001,
  next_ap_number int DEFAULT 1001,
  next_journal_number int DEFAULT 1,
  lock_date date,
  require_balanced_journals boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('accounting_settings', 'profile_id', 'bigint');

-- ── Bank accounts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id bigserial PRIMARY KEY,
  profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  entity_id bigint,
  gl_account_id bigint,
  name text NOT NULL,
  bank_name text,
  account_number text,
  account_type text DEFAULT 'current', -- current | savings | credit | crypto | wallet | gateway
  currency text DEFAULT 'ZAR',
  opening_balance numeric(18,2) DEFAULT 0,
  current_balance numeric(18,2) DEFAULT 0,
  is_default boolean DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  provider text, -- yoco | stripe | manual | crypto
  wallet_address text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('bank_accounts', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_bank_accounts_profile', 'bank_accounts', 'profile_id');

-- ── Bank transactions (for reconciliation) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id bigserial PRIMARY KEY,
  profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_account_id bigint NOT NULL,
  txn_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  reference text,
  amount numeric(18,2) NOT NULL DEFAULT 0, -- signed: +in, -out
  currency text DEFAULT 'ZAR',
  status text NOT NULL DEFAULT 'unreconciled', -- unreconciled | reconciled | excluded
  matched_payment_id bigint,
  matched_journal_id bigint,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('bank_transactions', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_bank_txn_profile', 'bank_transactions', 'profile_id');
SELECT public.sa_create_index('idx_bank_txn_account', 'bank_transactions', 'bank_account_id');
SELECT public.sa_create_index('idx_bank_txn_status', 'bank_transactions', 'profile_id, status');

-- ── Tax rates / codes ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tax_rates (
  id bigserial PRIMARY KEY,
  profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  rate numeric(8,4) NOT NULL DEFAULT 0,
  country text DEFAULT 'ZA',
  tax_type text DEFAULT 'vat', -- vat | sales | withholding | other
  is_default boolean DEFAULT false,
  is_recoverable boolean DEFAULT true,
  gl_account_id bigint,
  status text NOT NULL DEFAULT 'active',
  effective_from date,
  effective_to date,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('tax_rates', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_tax_rates_profile', 'tax_rates', 'profile_id');

-- ── Fixed assets ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id bigserial PRIMARY KEY,
  profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  entity_id bigint,
  asset_code text,
  name text NOT NULL,
  category text DEFAULT 'equipment', -- equipment | vehicles | buildings | furniture | software | other
  purchase_date date,
  purchase_cost numeric(18,2) DEFAULT 0,
  residual_value numeric(18,2) DEFAULT 0,
  useful_life_months int DEFAULT 60,
  depreciation_method text DEFAULT 'straight_line', -- straight_line | reducing_balance
  depreciation_rate numeric(8,4),
  accumulated_depreciation numeric(18,2) DEFAULT 0,
  book_value numeric(18,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'active', -- active | disposed | fully_depreciated
  disposal_date date,
  disposal_proceeds numeric(18,2),
  gl_asset_account_id bigint,
  gl_depr_account_id bigint,
  gl_expense_account_id bigint,
  location text,
  serial_number text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('fixed_assets', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_fixed_assets_profile', 'fixed_assets', 'profile_id');

-- ── RLS transitional (open policies; app-layer membership is authoritative) ──
DO $$
DECLARE
  rt text;
  pol_select text;
  pol_write text;
BEGIN
  FOREACH rt IN ARRAY ARRAY[
    'accounting_entities','accounting_periods','accounting_settings',
    'bank_accounts','bank_transactions','tax_rates','fixed_assets'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=rt) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', rt);
      pol_select := rt || '_select_all';
      pol_write := rt || '_write_all';
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_select, rt);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true)', pol_select, rt);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_write, rt);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
        pol_write, rt
      );
    END IF;
  END LOOP;
END $$;
