-- Full CRM sales lifecycle: quotes, orders, invoices, loyalty, claims, contracts
-- Safe / idempotent

CREATE OR REPLACE FUNCTION public.sa_add_column(p_table text, p_column text, p_type text, p_default text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=p_table
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=p_table AND column_name=p_column
  ) THEN
    IF p_default IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', p_table, p_column, p_type);
    ELSE
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s DEFAULT %s', p_table, p_column, p_type, p_default);
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sa_add_column %.% skip: %', p_table, p_column, SQLERRM;
END;
$$;

-- ── Quotes ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_quotes (
  id bigserial PRIMARY KEY,
  profile_id bigint,
  customer_id bigint,
  opportunity_id bigint,
  quote_number text,
  status text NOT NULL DEFAULT 'draft',
  -- draft | sent | accepted | rejected | expired | converted
  currency text DEFAULT 'ZAR',
  subtotal numeric(18,2) DEFAULT 0,
  tax_rate numeric(8,4) DEFAULT 15,
  tax_amount numeric(18,2) DEFAULT 0,
  total_amount numeric(18,2) DEFAULT 0,
  valid_until date,
  customer_name text,
  contact_name text,
  contact_email text,
  contact_phone text,
  billing_address text,
  notes text,
  terms text,
  items jsonb DEFAULT '[]'::jsonb,
  order_id bigint,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('customer_quotes', 'profile_id', 'bigint');
SELECT public.sa_add_column('customer_quotes', 'customer_id', 'bigint');
SELECT public.sa_add_column('customer_quotes', 'opportunity_id', 'bigint');
SELECT public.sa_add_column('customer_quotes', 'quote_number', 'text');
SELECT public.sa_add_column('customer_quotes', 'status', 'text', '''draft''');
SELECT public.sa_add_column('customer_quotes', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('customer_quotes', 'subtotal', 'numeric(18,2)', '0');
SELECT public.sa_add_column('customer_quotes', 'tax_rate', 'numeric(8,4)', '15');
SELECT public.sa_add_column('customer_quotes', 'tax_amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('customer_quotes', 'total_amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('customer_quotes', 'valid_until', 'date');
SELECT public.sa_add_column('customer_quotes', 'customer_name', 'text');
SELECT public.sa_add_column('customer_quotes', 'contact_name', 'text');
SELECT public.sa_add_column('customer_quotes', 'contact_email', 'text');
SELECT public.sa_add_column('customer_quotes', 'contact_phone', 'text');
SELECT public.sa_add_column('customer_quotes', 'billing_address', 'text');
SELECT public.sa_add_column('customer_quotes', 'notes', 'text');
SELECT public.sa_add_column('customer_quotes', 'terms', 'text');
SELECT public.sa_add_column('customer_quotes', 'items', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('customer_quotes', 'order_id', 'bigint');
SELECT public.sa_add_column('customer_quotes', 'created_by', 'text');

-- ── Sales orders ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id bigserial PRIMARY KEY,
  profile_id bigint,
  customer_id bigint,
  order_number text,
  status text NOT NULL DEFAULT 'draft',
  currency text DEFAULT 'ZAR',
  subtotal numeric(18,2) DEFAULT 0,
  tax_amount numeric(18,2) DEFAULT 0,
  total_amount numeric(18,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('sales_orders', 'profile_id', 'bigint');
SELECT public.sa_add_column('sales_orders', 'customer_id', 'bigint');
SELECT public.sa_add_column('sales_orders', 'quote_id', 'bigint');
SELECT public.sa_add_column('sales_orders', 'opportunity_id', 'bigint');
SELECT public.sa_add_column('sales_orders', 'order_number', 'text');
SELECT public.sa_add_column('sales_orders', 'status', 'text', '''draft''');
-- draft | confirmed | processing | shipped | fulfilled | cancelled | invoiced
SELECT public.sa_add_column('sales_orders', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('sales_orders', 'subtotal', 'numeric(18,2)', '0');
SELECT public.sa_add_column('sales_orders', 'tax_rate', 'numeric(8,4)', '15');
SELECT public.sa_add_column('sales_orders', 'tax_amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('sales_orders', 'total_amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('sales_orders', 'promised_date', 'date');
SELECT public.sa_add_column('sales_orders', 'shipped_date', 'date');
SELECT public.sa_add_column('sales_orders', 'customer_name', 'text');
SELECT public.sa_add_column('sales_orders', 'contact_name', 'text');
SELECT public.sa_add_column('sales_orders', 'contact_email', 'text');
SELECT public.sa_add_column('sales_orders', 'contact_phone', 'text');
SELECT public.sa_add_column('sales_orders', 'shipping_address', 'text');
SELECT public.sa_add_column('sales_orders', 'notes', 'text');
SELECT public.sa_add_column('sales_orders', 'items', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('sales_orders', 'invoice_id', 'bigint');
SELECT public.sa_add_column('sales_orders', 'created_by', 'text');
SELECT public.sa_add_column('sales_orders', 'metadata', 'jsonb', '''{}''::jsonb');

-- ── Invoices ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_invoices (
  id bigserial PRIMARY KEY,
  profile_id bigint,
  customer_id bigint,
  order_id bigint,
  quote_id bigint,
  invoice_number text,
  status text NOT NULL DEFAULT 'draft',
  -- draft | sent | paid | partial | overdue | void
  currency text DEFAULT 'ZAR',
  subtotal numeric(18,2) DEFAULT 0,
  tax_rate numeric(8,4) DEFAULT 15,
  tax_amount numeric(18,2) DEFAULT 0,
  total_amount numeric(18,2) DEFAULT 0,
  amount_paid numeric(18,2) DEFAULT 0,
  issue_date date,
  due_date date,
  paid_at timestamptz,
  customer_name text,
  contact_name text,
  contact_email text,
  billing_address text,
  notes text,
  items jsonb DEFAULT '[]'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('customer_invoices', 'profile_id', 'bigint');
SELECT public.sa_add_column('customer_invoices', 'customer_id', 'bigint');
SELECT public.sa_add_column('customer_invoices', 'order_id', 'bigint');
SELECT public.sa_add_column('customer_invoices', 'quote_id', 'bigint');
SELECT public.sa_add_column('customer_invoices', 'invoice_number', 'text');
SELECT public.sa_add_column('customer_invoices', 'status', 'text', '''draft''');
SELECT public.sa_add_column('customer_invoices', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('customer_invoices', 'subtotal', 'numeric(18,2)', '0');
SELECT public.sa_add_column('customer_invoices', 'tax_rate', 'numeric(8,4)', '15');
SELECT public.sa_add_column('customer_invoices', 'tax_amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('customer_invoices', 'total_amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('customer_invoices', 'amount_paid', 'numeric(18,2)', '0');
SELECT public.sa_add_column('customer_invoices', 'issue_date', 'date');
SELECT public.sa_add_column('customer_invoices', 'due_date', 'date');
SELECT public.sa_add_column('customer_invoices', 'paid_at', 'timestamptz');
SELECT public.sa_add_column('customer_invoices', 'customer_name', 'text');
SELECT public.sa_add_column('customer_invoices', 'contact_name', 'text');
SELECT public.sa_add_column('customer_invoices', 'contact_email', 'text');
SELECT public.sa_add_column('customer_invoices', 'billing_address', 'text');
SELECT public.sa_add_column('customer_invoices', 'notes', 'text');
SELECT public.sa_add_column('customer_invoices', 'items', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('customer_invoices', 'created_by', 'text');

-- Also extend invoices table if it already exists under that name
SELECT public.sa_add_column('invoices', 'customer_id', 'bigint');
SELECT public.sa_add_column('invoices', 'order_id', 'bigint');
SELECT public.sa_add_column('invoices', 'items', 'jsonb', '''[]''::jsonb');

-- ── Loyalty ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
  id bigserial PRIMARY KEY,
  profile_id bigint,
  customer_id bigint NOT NULL,
  points_balance numeric(18,2) NOT NULL DEFAULT 0,
  lifetime_earned numeric(18,2) NOT NULL DEFAULT 0,
  lifetime_redeemed numeric(18,2) NOT NULL DEFAULT 0,
  tier text DEFAULT 'bronze', -- bronze | silver | gold | platinum
  status text DEFAULT 'active',
  enrolled_at timestamptz DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('loyalty_accounts', 'profile_id', 'bigint');
SELECT public.sa_add_column('loyalty_accounts', 'customer_id', 'bigint');
SELECT public.sa_add_column('loyalty_accounts', 'points_balance', 'numeric(18,2)', '0');
SELECT public.sa_add_column('loyalty_accounts', 'lifetime_earned', 'numeric(18,2)', '0');
SELECT public.sa_add_column('loyalty_accounts', 'lifetime_redeemed', 'numeric(18,2)', '0');
SELECT public.sa_add_column('loyalty_accounts', 'tier', 'text', '''bronze''');
SELECT public.sa_add_column('loyalty_accounts', 'status', 'text', '''active''');

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id bigserial PRIMARY KEY,
  profile_id bigint,
  loyalty_account_id bigint,
  customer_id bigint,
  txn_type text NOT NULL DEFAULT 'earn', -- earn | redeem | adjust | expire
  points numeric(18,2) NOT NULL DEFAULT 0,
  balance_after numeric(18,2) DEFAULT 0,
  reference_type text,
  reference_id text,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('loyalty_transactions', 'profile_id', 'bigint');
SELECT public.sa_add_column('loyalty_transactions', 'loyalty_account_id', 'bigint');
SELECT public.sa_add_column('loyalty_transactions', 'customer_id', 'bigint');
SELECT public.sa_add_column('loyalty_transactions', 'txn_type', 'text', '''earn''');
SELECT public.sa_add_column('loyalty_transactions', 'points', 'numeric(18,2)', '0');
SELECT public.sa_add_column('loyalty_transactions', 'balance_after', 'numeric(18,2)', '0');
SELECT public.sa_add_column('loyalty_transactions', 'reference_type', 'text');
SELECT public.sa_add_column('loyalty_transactions', 'reference_id', 'text');
SELECT public.sa_add_column('loyalty_transactions', 'notes', 'text');

-- ── Claims ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_claims (
  id bigserial PRIMARY KEY,
  profile_id bigint,
  customer_id bigint,
  order_id bigint,
  invoice_id bigint,
  claim_number text,
  claim_type text DEFAULT 'quality', -- quality | short_delivery | damage | pricing | other
  status text NOT NULL DEFAULT 'open',
  -- open | investigating | approved | rejected | resolved | closed
  priority text DEFAULT 'medium',
  title text,
  description text,
  amount_claimed numeric(18,2) DEFAULT 0,
  amount_approved numeric(18,2) DEFAULT 0,
  currency text DEFAULT 'ZAR',
  resolution_notes text,
  opened_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  owner_name text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('customer_claims', 'profile_id', 'bigint');
SELECT public.sa_add_column('customer_claims', 'customer_id', 'bigint');
SELECT public.sa_add_column('customer_claims', 'order_id', 'bigint');
SELECT public.sa_add_column('customer_claims', 'invoice_id', 'bigint');
SELECT public.sa_add_column('customer_claims', 'claim_number', 'text');
SELECT public.sa_add_column('customer_claims', 'claim_type', 'text', '''quality''');
SELECT public.sa_add_column('customer_claims', 'status', 'text', '''open''');
SELECT public.sa_add_column('customer_claims', 'priority', 'text', '''medium''');
SELECT public.sa_add_column('customer_claims', 'title', 'text');
SELECT public.sa_add_column('customer_claims', 'description', 'text');
SELECT public.sa_add_column('customer_claims', 'amount_claimed', 'numeric(18,2)', '0');
SELECT public.sa_add_column('customer_claims', 'amount_approved', 'numeric(18,2)', '0');
SELECT public.sa_add_column('customer_claims', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('customer_claims', 'resolution_notes', 'text');
SELECT public.sa_add_column('customer_claims', 'opened_at', 'timestamptz');
SELECT public.sa_add_column('customer_claims', 'resolved_at', 'timestamptz');
SELECT public.sa_add_column('customer_claims', 'owner_name', 'text');

-- ── Contracts ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_contracts (
  id bigserial PRIMARY KEY,
  profile_id bigint,
  customer_id bigint,
  contract_number text,
  title text NOT NULL DEFAULT 'Customer contract',
  status text NOT NULL DEFAULT 'draft',
  -- draft | active | expired | terminated | renewed
  contract_type text DEFAULT 'supply',
  start_date date,
  end_date date,
  auto_renew boolean DEFAULT false,
  value numeric(18,2) DEFAULT 0,
  currency text DEFAULT 'ZAR',
  payment_terms text,
  sla_summary text,
  notes text,
  signed_at timestamptz,
  owner_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('customer_contracts', 'profile_id', 'bigint');
SELECT public.sa_add_column('customer_contracts', 'customer_id', 'bigint');
SELECT public.sa_add_column('customer_contracts', 'contract_number', 'text');
SELECT public.sa_add_column('customer_contracts', 'title', 'text');
SELECT public.sa_add_column('customer_contracts', 'status', 'text', '''draft''');
SELECT public.sa_add_column('customer_contracts', 'contract_type', 'text', '''supply''');
SELECT public.sa_add_column('customer_contracts', 'start_date', 'date');
SELECT public.sa_add_column('customer_contracts', 'end_date', 'date');
SELECT public.sa_add_column('customer_contracts', 'auto_renew', 'boolean', 'false');
SELECT public.sa_add_column('customer_contracts', 'value', 'numeric(18,2)', '0');
SELECT public.sa_add_column('customer_contracts', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('customer_contracts', 'payment_terms', 'text');
SELECT public.sa_add_column('customer_contracts', 'sla_summary', 'text');
SELECT public.sa_add_column('customer_contracts', 'notes', 'text');
SELECT public.sa_add_column('customer_contracts', 'signed_at', 'timestamptz');
SELECT public.sa_add_column('customer_contracts', 'owner_name', 'text');

-- ── Customer RIAD (company-scoped) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_riad (
  id bigserial PRIMARY KEY,
  profile_id bigint,
  customer_id bigint,
  entry_type text NOT NULL DEFAULT 'risk', -- risk | issue | action | decision
  title text NOT NULL DEFAULT 'RIAD entry',
  description text,
  status text NOT NULL DEFAULT 'open', -- open | in_progress | closed
  severity text DEFAULT 'medium',
  owner_name text,
  due_date date,
  closed_at timestamptz,
  related_order_id bigint,
  related_claim_id bigint,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('customer_riad', 'profile_id', 'bigint');
SELECT public.sa_add_column('customer_riad', 'customer_id', 'bigint');
SELECT public.sa_add_column('customer_riad', 'entry_type', 'text', '''risk''');
SELECT public.sa_add_column('customer_riad', 'title', 'text');
SELECT public.sa_add_column('customer_riad', 'description', 'text');
SELECT public.sa_add_column('customer_riad', 'status', 'text', '''open''');
SELECT public.sa_add_column('customer_riad', 'severity', 'text', '''medium''');
SELECT public.sa_add_column('customer_riad', 'owner_name', 'text');
SELECT public.sa_add_column('customer_riad', 'due_date', 'date');
SELECT public.sa_add_column('customer_riad', 'closed_at', 'timestamptz');
SELECT public.sa_add_column('customer_riad', 'related_order_id', 'bigint');
SELECT public.sa_add_column('customer_riad', 'related_claim_id', 'bigint');

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_customer_quotes_profile ON public.customer_quotes(profile_id);
  CREATE INDEX IF NOT EXISTS idx_sales_orders_profile ON public.sales_orders(profile_id);
  CREATE INDEX IF NOT EXISTS idx_customer_invoices_profile ON public.customer_invoices(profile_id);
  CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_customer ON public.loyalty_accounts(customer_id);
  CREATE INDEX IF NOT EXISTS idx_customer_claims_profile ON public.customer_claims(profile_id);
  CREATE INDEX IF NOT EXISTS idx_customer_contracts_profile ON public.customer_contracts(profile_id);
  CREATE INDEX IF NOT EXISTS idx_customer_riad_profile ON public.customer_riad(profile_id);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'crm lifecycle index skip: %', SQLERRM;
END $$;

ALTER TABLE public.customer_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_riad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_quotes_all ON public.customer_quotes;
CREATE POLICY customer_quotes_all ON public.customer_quotes FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS sales_orders_all ON public.sales_orders;
CREATE POLICY sales_orders_all ON public.sales_orders FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS customer_invoices_all ON public.customer_invoices;
CREATE POLICY customer_invoices_all ON public.customer_invoices FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS loyalty_accounts_all ON public.loyalty_accounts;
CREATE POLICY loyalty_accounts_all ON public.loyalty_accounts FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS loyalty_transactions_all ON public.loyalty_transactions;
CREATE POLICY loyalty_transactions_all ON public.loyalty_transactions FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS customer_claims_all ON public.customer_claims;
CREATE POLICY customer_claims_all ON public.customer_claims FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS customer_contracts_all ON public.customer_contracts;
CREATE POLICY customer_contracts_all ON public.customer_contracts FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS customer_riad_all ON public.customer_riad;
CREATE POLICY customer_riad_all ON public.customer_riad FOR ALL USING (true) WITH CHECK (true);

SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN (
  'customer_quotes','sales_orders','customer_invoices',
  'loyalty_accounts','loyalty_transactions',
  'customer_claims','customer_contracts','customer_riad'
)
ORDER BY 1;
