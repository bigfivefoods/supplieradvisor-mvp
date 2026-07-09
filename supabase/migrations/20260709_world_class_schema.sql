-- =============================================================================
-- SupplierAdvisor — World-class multi-module schema upgrade
-- Safe / idempotent: uses IF NOT EXISTS and ADD COLUMN IF NOT EXISTS
-- Project: onkklullmgrdqoertngp
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Helper: updated_at trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 1) CORE: profiles (companies) enhancements
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step text,
  ADD COLUMN IF NOT EXISTS parent_profile_id bigint REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS primary_currency text DEFAULT 'ZAR',
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Africa/Johannesburg',
  ADD COLUMN IF NOT EXISTS is_buyer boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_relationship ON public.profiles(relationship_type);
CREATE INDEX IF NOT EXISTS idx_profiles_supplier_status ON public.profiles(supplier_status);
CREATE INDEX IF NOT EXISTS idx_profiles_verification ON public.profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_profiles_invite_token ON public.profiles(invite_token) WHERE invite_token IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2) CORE: business_users (team memberships)
-- -----------------------------------------------------------------------------
ALTER TABLE public.business_users
  ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_business_users_profile ON public.business_users(profile_id);
CREATE INDEX IF NOT EXISTS idx_business_users_user ON public.business_users(user_id);
CREATE INDEX IF NOT EXISTS idx_business_users_status ON public.business_users(status);
CREATE INDEX IF NOT EXISTS idx_business_users_invite_token ON public.business_users(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_business_users_email ON public.business_users(email);
CREATE INDEX IF NOT EXISTS idx_business_users_invited_email ON public.business_users(invited_email);

-- -----------------------------------------------------------------------------
-- 3) NETWORK: business_connections
-- -----------------------------------------------------------------------------
ALTER TABLE public.business_connections
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS connection_type text DEFAULT 'partner',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_bc_requester_profile ON public.business_connections(requester_profile_id);
CREATE INDEX IF NOT EXISTS idx_bc_requestee_profile ON public.business_connections(requestee_profile_id);
CREATE INDEX IF NOT EXISTS idx_bc_requester_id ON public.business_connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_bc_requestee_id ON public.business_connections(requestee_id);
CREATE INDEX IF NOT EXISTS idx_bc_status ON public.business_connections(status);

-- -----------------------------------------------------------------------------
-- 4) PROCUREMENT: purchase_orders (align with app + world-class PO process)
-- -----------------------------------------------------------------------------
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS buyer_profile_id bigint REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_profile_id bigint REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'ZAR',
  ADD COLUMN IF NOT EXISTS subtotal numeric(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_amount numeric(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promised_date date,
  ADD COLUMN IF NOT EXISTS actual_delivery_date date,
  ADD COLUMN IF NOT EXISTS order_quantity numeric(18,4),
  ADD COLUMN IF NOT EXISTS delivered_quantity numeric(18,4),
  ADD COLUMN IF NOT EXISTS damaged_quantity numeric(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS supplier_wallet text,
  ADD COLUMN IF NOT EXISTS onchain_tx text,
  ADD COLUMN IF NOT EXISTS onchain_po_id text,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS incoterms text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS funded_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Map legacy supplier_id → supplier_profile_id where possible
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'supplier_id'
  ) THEN
    UPDATE public.purchase_orders
    SET supplier_profile_id = supplier_id
    WHERE supplier_profile_id IS NULL AND supplier_id IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_po_buyer ON public.purchase_orders(buyer_profile_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON public.purchase_orders(supplier_profile_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_number ON public.purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_po_created ON public.purchase_orders(created_at DESC);

-- po_items already exists — enhance
ALTER TABLE public.po_items
  ADD COLUMN IF NOT EXISTS line_number int,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(8,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS received_quantity numeric(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_po_items_po ON public.po_items(po_id);

-- Requisitions
CREATE TABLE IF NOT EXISTS public.requisitions (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by text,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  priority text DEFAULT 'normal',
  needed_by date,
  total_estimate numeric(18,2) DEFAULT 0,
  currency text DEFAULT 'ZAR',
  approved_by text,
  approved_at timestamptz,
  converted_po_id bigint REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requisitions_profile ON public.requisitions(profile_id);
CREATE INDEX IF NOT EXISTS idx_requisitions_status ON public.requisitions(status);

-- Supplier performance (OTIFEF snapshots)
CREATE TABLE IF NOT EXISTS public.supplier_scorecards (
  id bigserial PRIMARY KEY,
  buyer_profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  supplier_profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start date,
  period_end date,
  total_pos int DEFAULT 0,
  on_time_pct numeric(6,2) DEFAULT 0,
  in_full_pct numeric(6,2) DEFAULT 0,
  error_free_pct numeric(6,2) DEFAULT 0,
  otifef_pct numeric(6,2) DEFAULT 0,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buyer_profile_id, supplier_profile_id, period_start, period_end)
);

-- -----------------------------------------------------------------------------
-- 5) INVENTORY
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warehouses (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  address text,
  city text,
  country text DEFAULT 'South Africa',
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_profile ON public.warehouses(profile_id);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS warehouse_id bigint REFERENCES public.warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reorder_level numeric(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_qty numeric(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_on_hand numeric(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_products_profile ON public.products(profile_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);

CREATE TABLE IF NOT EXISTS public.stock_levels (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id bigint REFERENCES public.warehouses(id) ON DELETE SET NULL,
  qty_on_hand numeric(18,4) NOT NULL DEFAULT 0,
  qty_reserved numeric(18,4) NOT NULL DEFAULT 0,
  qty_available numeric(18,4) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id bigint REFERENCES public.warehouses(id) ON DELETE SET NULL,
  movement_type text NOT NULL, -- receipt | issue | transfer | adjustment | count
  quantity numeric(18,4) NOT NULL,
  reference_type text,
  reference_id text,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_profile ON public.stock_movements(profile_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);

-- -----------------------------------------------------------------------------
-- 6) CONTAINERS (retail outlets)
-- -----------------------------------------------------------------------------
ALTER TABLE public.containers
  ADD COLUMN IF NOT EXISTS profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS assigned_contractor text,
  ADD COLUMN IF NOT EXISTS contractor_id bigint,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS wifi_portal_url text,
  ADD COLUMN IF NOT EXISTS capacity_units numeric(18,2),
  ADD COLUMN IF NOT EXISTS monthly_target numeric(18,2),
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_containers_profile ON public.containers(profile_id);
CREATE INDEX IF NOT EXISTS idx_containers_status ON public.containers(status);
CREATE INDEX IF NOT EXISTS idx_containers_code ON public.containers(container_code);

CREATE TABLE IF NOT EXISTS public.container_contractors (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  id_number text,
  status text NOT NULL DEFAULT 'active',
  training_status text DEFAULT 'pending',
  bank_details jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_container_contractors_profile ON public.container_contractors(profile_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'containers_contractor_id_fkey'
  ) THEN
    ALTER TABLE public.containers
      ADD CONSTRAINT containers_contractor_id_fkey
      FOREIGN KEY (contractor_id) REFERENCES public.container_contractors(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.container_sales (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  container_id bigint NOT NULL REFERENCES public.containers(id) ON DELETE CASCADE,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  gross_amount numeric(18,2) NOT NULL DEFAULT 0,
  net_amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text DEFAULT 'ZAR',
  payment_method text,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_container_sales_container ON public.container_sales(container_id);

CREATE TABLE IF NOT EXISTS public.container_payouts (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  container_id bigint REFERENCES public.containers(id) ON DELETE SET NULL,
  contractor_id bigint REFERENCES public.container_contractors(id) ON DELETE SET NULL,
  period_start date,
  period_end date,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  reference text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 7) CUSTOMERS / SALES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trading_name text NOT NULL,
  legal_name text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'active',
  customer_type text DEFAULT 'business',
  billing_address text,
  shipping_address text,
  credit_limit numeric(18,2) DEFAULT 0,
  linked_profile_id bigint REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_profile ON public.customers(profile_id);

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id bigint REFERENCES public.customers(id) ON DELETE SET NULL,
  order_number text,
  status text NOT NULL DEFAULT 'draft',
  currency text DEFAULT 'ZAR',
  subtotal numeric(18,2) DEFAULT 0,
  tax_amount numeric(18,2) DEFAULT 0,
  total_amount numeric(18,2) DEFAULT 0,
  promised_date date,
  shipped_date date,
  notes text,
  items jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_profile ON public.sales_orders(profile_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);

CREATE TABLE IF NOT EXISTS public.leads (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  company_name text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'new',
  source text,
  value_estimate numeric(18,2),
  notes text,
  owner_user_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 8) DISTRIBUTION / LOGISTICS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipments (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'outbound', -- inbound | outbound
  reference_type text, -- po | sales_order
  reference_id bigint,
  carrier text,
  tracking_number text,
  status text NOT NULL DEFAULT 'planned',
  origin text,
  destination text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  incoterms text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipments_profile ON public.shipments(profile_id);

CREATE TABLE IF NOT EXISTS public.carriers (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_email text,
  contact_phone text,
  scac_code text,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 9) QUALITY & COMPLIANCE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quality_inspections (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  related_type text, -- po | product | shipment | container
  related_id bigint,
  inspection_type text DEFAULT 'incoming',
  status text NOT NULL DEFAULT 'open',
  result text, -- pass | fail | conditional
  inspector text,
  findings text,
  inspected_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.haccp_records (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ccp_name text NOT NULL,
  measured_value text,
  unit text,
  within_limits boolean,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.certificates (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  certificate_type text,
  issuer text,
  issued_at date,
  expires_at date,
  file_url text,
  status text DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RIAD enhancements
ALTER TABLE public.riad_logs
  ADD COLUMN IF NOT EXISTS profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS mitigation_plan text,
  ADD COLUMN IF NOT EXISTS residual_rpn int;

UPDATE public.riad_logs SET profile_id = owner_id WHERE profile_id IS NULL AND owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_riad_profile ON public.riad_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_riad_owner ON public.riad_logs(owner_id);
CREATE INDEX IF NOT EXISTS idx_riad_status ON public.riad_logs(status);

-- -----------------------------------------------------------------------------
-- 10) FINANCE / ACCOUNTING
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL, -- asset | liability | equity | revenue | expense
  parent_id bigint REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  currency text DEFAULT 'ZAR',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, code)
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  memo text,
  status text NOT NULL DEFAULT 'posted',
  source text,
  source_id text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.journal_lines (
  id bigserial PRIMARY KEY,
  journal_entry_id bigint NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id bigint NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  debit numeric(18,2) DEFAULT 0,
  credit numeric(18,2) DEFAULT 0,
  memo text
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'receivable', -- receivable | payable
  counterparty_name text,
  counterparty_profile_id bigint REFERENCES public.profiles(id) ON DELETE SET NULL,
  invoice_number text,
  status text NOT NULL DEFAULT 'draft',
  issue_date date DEFAULT CURRENT_DATE,
  due_date date,
  currency text DEFAULT 'ZAR',
  subtotal numeric(18,2) DEFAULT 0,
  tax_amount numeric(18,2) DEFAULT 0,
  total_amount numeric(18,2) DEFAULT 0,
  amount_paid numeric(18,2) DEFAULT 0,
  po_id bigint REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  sales_order_id bigint REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_profile ON public.invoices(profile_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

CREATE TABLE IF NOT EXISTS public.payments (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invoice_id bigint REFERENCES public.invoices(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'inbound',
  amount numeric(18,2) NOT NULL,
  currency text DEFAULT 'ZAR',
  method text,
  reference text,
  paid_at timestamptz DEFAULT now(),
  status text DEFAULT 'completed',
  onchain_tx text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 11) PEOPLE / HR
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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
  manager_id bigint REFERENCES public.employees(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_profile ON public.employees(profile_id);

CREATE TABLE IF NOT EXISTS public.training_records (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id bigint REFERENCES public.employees(id) ON DELETE CASCADE,
  course_name text NOT NULL,
  status text DEFAULT 'assigned',
  completed_at timestamptz,
  score numeric(6,2),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 12) PROJECTS (enhance existing)
-- -----------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS owner_user_id text,
  ADD COLUMN IF NOT EXISTS budget numeric(18,2),
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id bigserial PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'todo',
  assignee_user_id text,
  due_date date,
  sort_order int DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.timesheets (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id text,
  employee_id bigint REFERENCES public.employees(id) ON DELETE SET NULL,
  project_id bigint REFERENCES public.projects(id) ON DELETE SET NULL,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  hours numeric(6,2) NOT NULL DEFAULT 0,
  notes text,
  status text DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 13) SUSTAINABILITY
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.carbon_entries (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  amount_kgco2e numeric(18,4) NOT NULL DEFAULT 0,
  period_start date,
  period_end date,
  source text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sustainability_certificates (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  standard text,
  issuer text,
  issued_at date,
  expires_at date,
  file_url text,
  status text DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 14) AUDIT / ACTIVITY
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_log (
  id bigserial PRIMARY KEY,
  profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_user_id text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  summary text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_profile ON public.activity_log(profile_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);

-- -----------------------------------------------------------------------------
-- 15) INVITATIONS enhancements
-- -----------------------------------------------------------------------------
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS invite_kind text DEFAULT 'team',
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_invitations_profile ON public.invitations(profile_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);

-- -----------------------------------------------------------------------------
-- 16) updated_at triggers (best-effort)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','business_users','products','warehouses','customers','sales_orders',
    'leads','shipments','projects','project_tasks','invoices','employees',
    'container_contractors','chart_of_accounts','certificates'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I', t, t);
      EXECUTE format(
        'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
        t, t
      );
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 17) Basic RLS enablement (service role bypasses RLS; keep anon readable where needed)
--     NOTE: Tighten further once Privy→JWT integration is complete.
-- -----------------------------------------------------------------------------
-- Enable RLS on sensitive new tables but allow authenticated-style access via policies
-- that currently permit all for transition (replace with real JWT claims later).

DO $$
DECLARE
  t text;
  pol_select text;
  pol_write text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'warehouses','stock_levels','stock_movements','container_contractors',
    'container_sales','container_payouts','customers','sales_orders','leads',
    'shipments','carriers','quality_inspections','haccp_records','certificates',
    'chart_of_accounts','journal_entries','journal_lines','invoices','payments',
    'employees','training_records','project_tasks','timesheets','carbon_entries',
    'sustainability_certificates','activity_log','requisitions','supplier_scorecards'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      pol_select := t || '_select_all';
      pol_write := t || '_write_all';
      -- Transitional open policies (app uses service role for privileged writes)
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_select, t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true)', pol_select, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_write, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
        pol_write, t
      );
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- End of migration
-- =============================================================================
