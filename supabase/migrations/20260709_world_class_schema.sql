-- =============================================================================
-- SupplierAdvisor schema v3 (safe / idempotent)
-- Run entire file in Supabase SQL Editor → expect Success + verification table
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop helpers first so re-runs never hit 42P13 parameter rename errors
DROP FUNCTION IF EXISTS public.sa_create_index(text, text, text);
DROP FUNCTION IF EXISTS public.sa_add_column(text, text, text, text);
DROP FUNCTION IF EXISTS public.sa_add_column(text, text, text);
DROP FUNCTION IF EXISTS public.sa_add_fk(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_add_column(
  p_table text, p_column text, p_type text, p_default text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name=p_table
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=p_table AND column_name=p_column
  ) THEN
    IF p_default IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', p_table, p_column, p_type);
    ELSE
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN %I %s DEFAULT %s',
        p_table, p_column, p_type, p_default
      );
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_add_fk(
  p_table text, p_column text, p_ref_table text,
  p_ref_column text DEFAULT 'id', p_on_delete text DEFAULT 'SET NULL'
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  cname text := p_table || '_' || p_column || '_fkey';
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=p_table AND column_name=p_column
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema='public' AND constraint_name=cname
  ) THEN
    BEGIN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(%I) ON DELETE %s',
        p_table, cname, p_column, p_ref_table, p_ref_column, p_on_delete
      );
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'FK % skipped: %', cname, SQLERRM;
    END;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_create_index(
  p_name text, p_table text, p_columns text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  col text;
  cols text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name=p_table
  ) THEN
    RETURN;
  END IF;

  cols := string_to_array(replace(p_columns, ' ', ''), ',');
  FOREACH col IN ARRAY cols LOOP
    IF col IS NULL OR col = '' THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=p_table AND column_name=col
    ) THEN
      RAISE NOTICE 'Index % skipped: missing %.%', p_name, p_table, col;
      RETURN;
    END IF;
  END LOOP;

  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)', p_name, p_table, p_columns);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Index % skipped: %', p_name, SQLERRM;
END;
$$;

-- =============================================================================
-- MAIN MIGRATION (PERFORM only — no result grids)
-- =============================================================================
DO $migration$
DECLARE
  t text;
  rt text;
  pol_select text;
  pol_write text;
BEGIN
  -- profiles
  PERFORM public.sa_add_column('profiles', 'onboarding_complete', 'boolean', 'false');
  PERFORM public.sa_add_column('profiles', 'onboarding_step', 'text');
  PERFORM public.sa_add_column('profiles', 'parent_profile_id', 'bigint');
  PERFORM public.sa_add_column('profiles', 'primary_currency', 'text', '''ZAR''');
  PERFORM public.sa_add_column('profiles', 'timezone', 'text', '''Africa/Johannesburg''');
  PERFORM public.sa_add_column('profiles', 'is_buyer', 'boolean', 'true');
  PERFORM public.sa_add_column('profiles', 'metadata', 'jsonb', '''{}''::jsonb');
  PERFORM public.sa_add_fk('profiles', 'parent_profile_id', 'profiles', 'id', 'SET NULL');
  PERFORM public.sa_create_index('idx_profiles_user_id', 'profiles', 'user_id');
  PERFORM public.sa_create_index('idx_profiles_relationship', 'profiles', 'relationship_type');
  PERFORM public.sa_create_index('idx_profiles_supplier_status', 'profiles', 'supplier_status');
  PERFORM public.sa_create_index('idx_profiles_verification', 'profiles', 'verification_status');

  -- business_users
  PERFORM public.sa_add_column('business_users', 'permissions', 'jsonb', '''[]''::jsonb');
  PERFORM public.sa_add_column('business_users', 'last_active_at', 'timestamptz');
  PERFORM public.sa_add_column('business_users', 'expires_at', 'timestamptz');
  PERFORM public.sa_add_column('business_users', 'metadata', 'jsonb', '''{}''::jsonb');
  PERFORM public.sa_add_column('business_users', 'profile_id', 'bigint');
  PERFORM public.sa_add_fk('business_users', 'profile_id', 'profiles', 'id', 'CASCADE');
  PERFORM public.sa_create_index('idx_business_users_profile', 'business_users', 'profile_id');
  PERFORM public.sa_create_index('idx_business_users_user', 'business_users', 'user_id');
  PERFORM public.sa_create_index('idx_business_users_status', 'business_users', 'status');
  PERFORM public.sa_create_index('idx_business_users_email', 'business_users', 'email');

  -- connections
  PERFORM public.sa_add_column('business_connections', 'responded_at', 'timestamptz');
  PERFORM public.sa_add_column('business_connections', 'connection_type', 'text', '''partner''');
  PERFORM public.sa_add_column('business_connections', 'notes', 'text');
  PERFORM public.sa_add_column('business_connections', 'metadata', 'jsonb', '''{}''::jsonb');
  PERFORM public.sa_add_column('business_connections', 'requester_profile_id', 'bigint');
  PERFORM public.sa_add_column('business_connections', 'requestee_profile_id', 'bigint');
  PERFORM public.sa_create_index('idx_bc_requester_profile', 'business_connections', 'requester_profile_id');
  PERFORM public.sa_create_index('idx_bc_requestee_profile', 'business_connections', 'requestee_profile_id');
  PERFORM public.sa_create_index('idx_bc_status', 'business_connections', 'status');

  -- purchase_orders
  PERFORM public.sa_add_column('purchase_orders', 'buyer_profile_id', 'bigint');
  PERFORM public.sa_add_column('purchase_orders', 'supplier_profile_id', 'bigint');
  PERFORM public.sa_add_column('purchase_orders', 'description', 'text');
  PERFORM public.sa_add_column('purchase_orders', 'currency', 'text', '''ZAR''');
  PERFORM public.sa_add_column('purchase_orders', 'subtotal', 'numeric(18,2)', '0');
  PERFORM public.sa_add_column('purchase_orders', 'tax_amount', 'numeric(18,2)', '0');
  PERFORM public.sa_add_column('purchase_orders', 'shipping_amount', 'numeric(18,2)', '0');
  PERFORM public.sa_add_column('purchase_orders', 'discount_amount', 'numeric(18,2)', '0');
  PERFORM public.sa_add_column('purchase_orders', 'promised_date', 'date');
  PERFORM public.sa_add_column('purchase_orders', 'actual_delivery_date', 'date');
  PERFORM public.sa_add_column('purchase_orders', 'order_quantity', 'numeric(18,4)');
  PERFORM public.sa_add_column('purchase_orders', 'delivered_quantity', 'numeric(18,4)');
  PERFORM public.sa_add_column('purchase_orders', 'damaged_quantity', 'numeric(18,4)', '0');
  PERFORM public.sa_add_column('purchase_orders', 'items', 'jsonb', '''[]''::jsonb');
  PERFORM public.sa_add_column('purchase_orders', 'supplier_wallet', 'text');
  PERFORM public.sa_add_column('purchase_orders', 'onchain_tx', 'text');
  PERFORM public.sa_add_column('purchase_orders', 'onchain_po_id', 'text');
  PERFORM public.sa_add_column('purchase_orders', 'payment_terms', 'text');
  PERFORM public.sa_add_column('purchase_orders', 'incoterms', 'text');
  PERFORM public.sa_add_column('purchase_orders', 'delivery_address', 'text');
  PERFORM public.sa_add_column('purchase_orders', 'approved_at', 'timestamptz');
  PERFORM public.sa_add_column('purchase_orders', 'approved_by', 'text');
  PERFORM public.sa_add_column('purchase_orders', 'funded_at', 'timestamptz');
  PERFORM public.sa_add_column('purchase_orders', 'closed_at', 'timestamptz');
  PERFORM public.sa_add_column('purchase_orders', 'metadata', 'jsonb', '''{}''::jsonb');
  PERFORM public.sa_add_fk('purchase_orders', 'buyer_profile_id', 'profiles', 'id', 'SET NULL');
  PERFORM public.sa_add_fk('purchase_orders', 'supplier_profile_id', 'profiles', 'id', 'SET NULL');

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='purchase_orders' AND column_name='supplier_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='purchase_orders' AND column_name='supplier_profile_id'
  ) THEN
    UPDATE public.purchase_orders
    SET supplier_profile_id = supplier_id
    WHERE supplier_profile_id IS NULL AND supplier_id IS NOT NULL;
  END IF;

  PERFORM public.sa_create_index('idx_po_buyer', 'purchase_orders', 'buyer_profile_id');
  PERFORM public.sa_create_index('idx_po_supplier', 'purchase_orders', 'supplier_profile_id');
  PERFORM public.sa_create_index('idx_po_status', 'purchase_orders', 'status');

  PERFORM public.sa_add_column('po_items', 'line_number', 'int');
  PERFORM public.sa_add_column('po_items', 'tax_rate', 'numeric(8,4)', '0');
  PERFORM public.sa_add_column('po_items', 'received_quantity', 'numeric(18,4)', '0');
  PERFORM public.sa_add_column('po_items', 'notes', 'text');
  PERFORM public.sa_add_column('po_items', 'metadata', 'jsonb', '''{}''::jsonb');

  -- new tables
  CREATE TABLE IF NOT EXISTS public.requisitions (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
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
    converted_po_id bigint,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  PERFORM public.sa_add_column('requisitions', 'profile_id', 'bigint');
  PERFORM public.sa_create_index('idx_requisitions_profile', 'requisitions', 'profile_id');

  CREATE TABLE IF NOT EXISTS public.supplier_scorecards (
    id bigserial PRIMARY KEY,
    buyer_profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    supplier_profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
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
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS public.warehouses (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
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
  PERFORM public.sa_add_column('warehouses', 'profile_id', 'bigint');
  PERFORM public.sa_create_index('idx_warehouses_profile', 'warehouses', 'profile_id');

  PERFORM public.sa_add_column('products', 'warehouse_id', 'bigint');
  PERFORM public.sa_add_column('products', 'reorder_level', 'numeric(18,4)', '0');
  PERFORM public.sa_add_column('products', 'reorder_qty', 'numeric(18,4)', '0');
  PERFORM public.sa_add_column('products', 'qty_on_hand', 'numeric(18,4)', '0');
  PERFORM public.sa_add_column('products', 'metadata', 'jsonb', '''{}''::jsonb');
  PERFORM public.sa_add_column('products', 'profile_id', 'bigint');
  PERFORM public.sa_create_index('idx_products_profile', 'products', 'profile_id');
  PERFORM public.sa_create_index('idx_products_sku', 'products', 'sku');

  CREATE TABLE IF NOT EXISTS public.stock_levels (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id bigint,
    warehouse_id bigint,
    qty_on_hand numeric(18,4) NOT NULL DEFAULT 0,
    qty_reserved numeric(18,4) NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  PERFORM public.sa_add_column('stock_levels', 'profile_id', 'bigint');
  PERFORM public.sa_create_index('idx_stock_levels_profile', 'stock_levels', 'profile_id');

  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='stock_levels')
       AND NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='stock_levels' AND column_name='qty_available'
       ) THEN
      ALTER TABLE public.stock_levels
        ADD COLUMN qty_available numeric(18,4)
        GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'qty_available skip: %', SQLERRM;
  END;

  CREATE TABLE IF NOT EXISTS public.stock_movements (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id bigint,
    warehouse_id bigint,
    movement_type text NOT NULL DEFAULT 'adjustment',
    quantity numeric(18,4) NOT NULL DEFAULT 0,
    reference_type text,
    reference_id text,
    notes text,
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  PERFORM public.sa_add_column('stock_movements', 'profile_id', 'bigint');

  -- containers
  PERFORM public.sa_add_column('containers', 'profile_id', 'bigint');
  PERFORM public.sa_add_column('containers', 'assigned_contractor', 'text');
  PERFORM public.sa_add_column('containers', 'contractor_id', 'bigint');
  PERFORM public.sa_add_column('containers', 'tags', 'text[]', '''{}''');
  PERFORM public.sa_add_column('containers', 'wifi_portal_url', 'text');
  PERFORM public.sa_add_column('containers', 'capacity_units', 'numeric(18,2)');
  PERFORM public.sa_add_column('containers', 'monthly_target', 'numeric(18,2)');
  PERFORM public.sa_add_column('containers', 'metadata', 'jsonb', '''{}''::jsonb');
  PERFORM public.sa_add_fk('containers', 'profile_id', 'profiles', 'id', 'CASCADE');
  PERFORM public.sa_create_index('idx_containers_profile', 'containers', 'profile_id');
  PERFORM public.sa_create_index('idx_containers_status', 'containers', 'status');
  PERFORM public.sa_create_index('idx_containers_code', 'containers', 'container_code');

  CREATE TABLE IF NOT EXISTS public.container_contractors (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
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
  PERFORM public.sa_add_column('container_contractors', 'profile_id', 'bigint');

  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='containers' AND column_name='contractor_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='container_contractors'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'containers_contractor_id_fkey'
    ) THEN
      ALTER TABLE public.containers
        ADD CONSTRAINT containers_contractor_id_fkey
        FOREIGN KEY (contractor_id) REFERENCES public.container_contractors(id) ON DELETE SET NULL;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'containers contractor FK skip: %', SQLERRM;
  END;

  CREATE TABLE IF NOT EXISTS public.container_sales (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    container_id bigint,
    sale_date date NOT NULL DEFAULT CURRENT_DATE,
    gross_amount numeric(18,2) NOT NULL DEFAULT 0,
    net_amount numeric(18,2) NOT NULL DEFAULT 0,
    currency text DEFAULT 'ZAR',
    payment_method text,
    notes text,
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  PERFORM public.sa_add_column('container_sales', 'profile_id', 'bigint');

  CREATE TABLE IF NOT EXISTS public.container_payouts (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    container_id bigint,
    contractor_id bigint,
    period_start date,
    period_end date,
    amount numeric(18,2) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending',
    paid_at timestamptz,
    reference text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  PERFORM public.sa_add_column('container_payouts', 'profile_id', 'bigint');

  CREATE TABLE IF NOT EXISTS public.customers (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    trading_name text NOT NULL,
    legal_name text,
    email text,
    phone text,
    status text NOT NULL DEFAULT 'active',
    customer_type text DEFAULT 'business',
    billing_address text,
    shipping_address text,
    credit_limit numeric(18,2) DEFAULT 0,
    linked_profile_id bigint,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  PERFORM public.sa_add_column('customers', 'profile_id', 'bigint');
  PERFORM public.sa_create_index('idx_customers_profile', 'customers', 'profile_id');

  CREATE TABLE IF NOT EXISTS public.sales_orders (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    customer_id bigint,
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
  PERFORM public.sa_add_column('sales_orders', 'profile_id', 'bigint');

  CREATE TABLE IF NOT EXISTS public.leads (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
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
  PERFORM public.sa_add_column('leads', 'profile_id', 'bigint');

  CREATE TABLE IF NOT EXISTS public.shipments (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    direction text NOT NULL DEFAULT 'outbound',
    reference_type text,
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
  PERFORM public.sa_add_column('shipments', 'profile_id', 'bigint');

  CREATE TABLE IF NOT EXISTS public.carriers (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    contact_email text,
    contact_phone text,
    scac_code text,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  PERFORM public.sa_add_column('carriers', 'profile_id', 'bigint');

  CREATE TABLE IF NOT EXISTS public.quality_inspections (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    related_type text,
    related_id bigint,
    inspection_type text DEFAULT 'incoming',
    status text NOT NULL DEFAULT 'open',
    result text,
    inspector text,
    findings text,
    inspected_at timestamptz DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  PERFORM public.sa_add_column('quality_inspections', 'profile_id', 'bigint');

  CREATE TABLE IF NOT EXISTS public.haccp_records (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
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
  PERFORM public.sa_add_column('haccp_records', 'profile_id', 'bigint');

  CREATE TABLE IF NOT EXISTS public.compliance_certificates (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
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
  PERFORM public.sa_add_column('compliance_certificates', 'profile_id', 'bigint');

  PERFORM public.sa_add_column('riad_logs', 'profile_id', 'bigint');
  PERFORM public.sa_add_column('riad_logs', 'mitigation_plan', 'text');
  PERFORM public.sa_add_column('riad_logs', 'residual_rpn', 'int');
  PERFORM public.sa_add_fk('riad_logs', 'profile_id', 'profiles', 'id', 'CASCADE');

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='riad_logs' AND column_name='profile_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='riad_logs' AND column_name='owner_id'
  ) THEN
    UPDATE public.riad_logs
    SET profile_id = owner_id
    WHERE profile_id IS NULL AND owner_id IS NOT NULL;
  END IF;

  PERFORM public.sa_create_index('idx_riad_profile', 'riad_logs', 'profile_id');
  PERFORM public.sa_create_index('idx_riad_owner', 'riad_logs', 'owner_id');
  PERFORM public.sa_create_index('idx_riad_status', 'riad_logs', 'status');

  CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    code text NOT NULL,
    name text NOT NULL,
    account_type text NOT NULL,
    parent_id bigint,
    is_active boolean DEFAULT true,
    currency text DEFAULT 'ZAR',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  PERFORM public.sa_add_column('chart_of_accounts', 'profile_id', 'bigint');

  CREATE TABLE IF NOT EXISTS public.journal_entries (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    entry_date date NOT NULL DEFAULT CURRENT_DATE,
    memo text,
    status text NOT NULL DEFAULT 'posted',
    source text,
    source_id text,
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  PERFORM public.sa_add_column('journal_entries', 'profile_id', 'bigint');

  CREATE TABLE IF NOT EXISTS public.journal_lines (
    id bigserial PRIMARY KEY,
    journal_entry_id bigint,
    account_id bigint,
    debit numeric(18,2) DEFAULT 0,
    credit numeric(18,2) DEFAULT 0,
    memo text
  );

  CREATE TABLE IF NOT EXISTS public.invoices (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    direction text NOT NULL DEFAULT 'receivable',
    counterparty_name text,
    counterparty_profile_id bigint,
    invoice_number text,
    status text NOT NULL DEFAULT 'draft',
    issue_date date DEFAULT CURRENT_DATE,
    due_date date,
    currency text DEFAULT 'ZAR',
    subtotal numeric(18,2) DEFAULT 0,
    tax_amount numeric(18,2) DEFAULT 0,
    total_amount numeric(18,2) DEFAULT 0,
    amount_paid numeric(18,2) DEFAULT 0,
    po_id bigint,
    sales_order_id bigint,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  PERFORM public.sa_add_column('invoices', 'profile_id', 'bigint');
  PERFORM public.sa_create_index('idx_invoices_profile', 'invoices', 'profile_id');

  CREATE TABLE IF NOT EXISTS public.payments (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    invoice_id bigint,
    direction text NOT NULL DEFAULT 'inbound',
    amount numeric(18,2) NOT NULL DEFAULT 0,
    currency text DEFAULT 'ZAR',
    method text,
    reference text,
    paid_at timestamptz DEFAULT now(),
    status text DEFAULT 'completed',
    onchain_tx text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  PERFORM public.sa_add_column('payments', 'profile_id', 'bigint');

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
  PERFORM public.sa_add_column('employees', 'profile_id', 'bigint');
  PERFORM public.sa_create_index('idx_employees_profile', 'employees', 'profile_id');

  CREATE TABLE IF NOT EXISTS public.training_records (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    employee_id bigint,
    course_name text NOT NULL,
    status text DEFAULT 'assigned',
    completed_at timestamptz,
    score numeric(6,2),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  PERFORM public.sa_add_column('training_records', 'profile_id', 'bigint');

  PERFORM public.sa_add_column('projects', 'owner_user_id', 'text');
  PERFORM public.sa_add_column('projects', 'budget', 'numeric(18,2)');
  PERFORM public.sa_add_column('projects', 'end_date', 'date');
  PERFORM public.sa_add_column('projects', 'priority', 'text', '''medium''');
  PERFORM public.sa_add_column('projects', 'metadata', 'jsonb', '''{}''::jsonb');
  PERFORM public.sa_add_column('projects', 'profile_id', 'bigint');
  PERFORM public.sa_create_index('idx_projects_profile', 'projects', 'profile_id');

  CREATE TABLE IF NOT EXISTS public.project_tasks (
    id bigserial PRIMARY KEY,
    project_id bigint,
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
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id text,
    employee_id bigint,
    project_id bigint,
    work_date date NOT NULL DEFAULT CURRENT_DATE,
    hours numeric(6,2) NOT NULL DEFAULT 0,
    notes text,
    status text DEFAULT 'submitted',
    created_at timestamptz NOT NULL DEFAULT now()
  );
  PERFORM public.sa_add_column('timesheets', 'profile_id', 'bigint');

  CREATE TABLE IF NOT EXISTS public.carbon_entries (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    category text NOT NULL,
    amount_kgco2e numeric(18,4) NOT NULL DEFAULT 0,
    period_start date,
    period_end date,
    source text,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  PERFORM public.sa_add_column('carbon_entries', 'profile_id', 'bigint');

  CREATE TABLE IF NOT EXISTS public.sustainability_certificates (
    id bigserial PRIMARY KEY,
    profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    standard text,
    issuer text,
    issued_at date,
    expires_at date,
    file_url text,
    status text DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now()
  );
  PERFORM public.sa_add_column('sustainability_certificates', 'profile_id', 'bigint');

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
  PERFORM public.sa_add_column('activity_log', 'profile_id', 'bigint');
  PERFORM public.sa_create_index('idx_activity_log_profile', 'activity_log', 'profile_id');

  PERFORM public.sa_add_column('invitations', 'invite_kind', 'text', '''team''');
  PERFORM public.sa_add_column('invitations', 'metadata', 'jsonb', '''{}''::jsonb');
  PERFORM public.sa_add_column('invitations', 'profile_id', 'bigint');
  PERFORM public.sa_create_index('idx_invitations_profile', 'invitations', 'profile_id');
  PERFORM public.sa_create_index('idx_invitations_token', 'invitations', 'token');

  PERFORM public.sa_add_column('documents', 'profile_id', 'bigint');
  PERFORM public.sa_add_column('company_documents', 'profile_id', 'bigint');
  PERFORM public.sa_create_index('idx_documents_profile', 'documents', 'profile_id');
  PERFORM public.sa_create_index('idx_company_documents_profile', 'company_documents', 'profile_id');

  -- triggers
  FOREACH t IN ARRAY ARRAY[
    'profiles','business_users','products','warehouses','customers','sales_orders',
    'leads','shipments','projects','project_tasks','invoices','employees',
    'container_contractors','chart_of_accounts','compliance_certificates'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='updated_at')
    THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I', t, t);
      EXECUTE format(
        'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
        t, t
      );
    END IF;
  END LOOP;

  -- RLS transitional
  FOREACH rt IN ARRAY ARRAY[
    'warehouses','stock_levels','stock_movements','container_contractors',
    'container_sales','container_payouts','customers','sales_orders','leads',
    'shipments','carriers','quality_inspections','haccp_records','compliance_certificates',
    'chart_of_accounts','journal_entries','journal_lines','invoices','payments',
    'employees','training_records','project_tasks','timesheets','carbon_entries',
    'sustainability_certificates','activity_log','requisitions','supplier_scorecards'
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

  RAISE NOTICE 'SupplierAdvisor schema v3 applied successfully';
END;
$migration$;

-- =============================================================================
-- Verification query (should show OK for each row)
-- =============================================================================
SELECT * FROM (
  VALUES
    ('purchase_orders.buyer_profile_id',
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchase_orders' AND column_name='buyer_profile_id')),
    ('containers.profile_id',
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='containers' AND column_name='profile_id')),
    ('products.profile_id',
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='profile_id')),
    ('warehouses table',
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='warehouses')),
    ('customers table',
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='customers')),
    ('invoices table',
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoices')),
    ('employees table',
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='employees')),
    ('activity_log table',
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='activity_log')),
    ('riad_logs.profile_id',
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='riad_logs' AND column_name='profile_id')),
    ('business_connections.responded_at',
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_connections' AND column_name='responded_at'))
) AS v(check_name, ok)
ORDER BY check_name;
