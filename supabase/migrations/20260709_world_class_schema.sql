-- =============================================================================
-- SupplierAdvisor — World-class multi-module schema upgrade (v2, defensive)
-- Idempotent & safe for partial re-runs. Guards every column/index access.
-- Project: onkklullmgrdqoertngp
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Helpers
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

CREATE OR REPLACE FUNCTION public.sa_add_column(
  p_table text,
  p_column text,
  p_type text,
  p_default text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = p_column
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
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
  p_table text,
  p_column text,
  p_ref_table text,
  p_ref_column text DEFAULT 'id',
  p_on_delete text DEFAULT 'SET NULL'
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  cname text := p_table || '_' || p_column || '_fkey';
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = p_column
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_name = cname
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
  p_name text,
  p_table text,
  p_columns text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  col text;
  cols text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) THEN
    RETURN;
  END IF;

  cols := string_to_array(replace(p_columns, ' ', ''), ',');
  FOREACH col IN ARRAY cols LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = p_table AND column_name = col
    ) THEN
      RAISE NOTICE 'Index % skipped: column %.% missing', p_name, p_table, col;
      RETURN;
    END IF;
  END LOOP;

  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)', p_name, p_table, p_columns);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Index % skipped: %', p_name, SQLERRM;
END;
$$;

-- =============================================================================
-- 1) CORE: profiles
-- =============================================================================
SELECT public.sa_add_column('profiles', 'onboarding_complete', 'boolean', 'false');
SELECT public.sa_add_column('profiles', 'onboarding_step', 'text');
SELECT public.sa_add_column('profiles', 'parent_profile_id', 'bigint');
SELECT public.sa_add_column('profiles', 'primary_currency', 'text', '''ZAR''');
SELECT public.sa_add_column('profiles', 'timezone', 'text', '''Africa/Johannesburg''');
SELECT public.sa_add_column('profiles', 'is_buyer', 'boolean', 'true');
SELECT public.sa_add_column('profiles', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_fk('profiles', 'parent_profile_id', 'profiles', 'id', 'SET NULL');

SELECT public.sa_create_index('idx_profiles_user_id', 'profiles', 'user_id');
SELECT public.sa_create_index('idx_profiles_relationship', 'profiles', 'relationship_type');
SELECT public.sa_create_index('idx_profiles_supplier_status', 'profiles', 'supplier_status');
SELECT public.sa_create_index('idx_profiles_verification', 'profiles', 'verification_status');
SELECT public.sa_create_index('idx_profiles_invite_token', 'profiles', 'invite_token');

-- =============================================================================
-- 2) CORE: business_users
-- =============================================================================
SELECT public.sa_add_column('business_users', 'permissions', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('business_users', 'last_active_at', 'timestamptz');
SELECT public.sa_add_column('business_users', 'expires_at', 'timestamptz');
SELECT public.sa_add_column('business_users', 'metadata', 'jsonb', '''{}''::jsonb');
-- ensure profile_id exists (legacy safety)
SELECT public.sa_add_column('business_users', 'profile_id', 'bigint');
SELECT public.sa_add_fk('business_users', 'profile_id', 'profiles', 'id', 'CASCADE');

SELECT public.sa_create_index('idx_business_users_profile', 'business_users', 'profile_id');
SELECT public.sa_create_index('idx_business_users_user', 'business_users', 'user_id');
SELECT public.sa_create_index('idx_business_users_status', 'business_users', 'status');
SELECT public.sa_create_index('idx_business_users_invite_token', 'business_users', 'invite_token');
SELECT public.sa_create_index('idx_business_users_email', 'business_users', 'email');
SELECT public.sa_create_index('idx_business_users_invited_email', 'business_users', 'invited_email');

-- =============================================================================
-- 3) NETWORK: business_connections
-- =============================================================================
SELECT public.sa_add_column('business_connections', 'responded_at', 'timestamptz');
SELECT public.sa_add_column('business_connections', 'connection_type', 'text', '''partner''');
SELECT public.sa_add_column('business_connections', 'notes', 'text');
SELECT public.sa_add_column('business_connections', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('business_connections', 'requester_profile_id', 'bigint');
SELECT public.sa_add_column('business_connections', 'requestee_profile_id', 'bigint');
SELECT public.sa_add_fk('business_connections', 'requester_profile_id', 'profiles', 'id', 'SET NULL');
SELECT public.sa_add_fk('business_connections', 'requestee_profile_id', 'profiles', 'id', 'SET NULL');

SELECT public.sa_create_index('idx_bc_requester_profile', 'business_connections', 'requester_profile_id');
SELECT public.sa_create_index('idx_bc_requestee_profile', 'business_connections', 'requestee_profile_id');
SELECT public.sa_create_index('idx_bc_requester_id', 'business_connections', 'requester_id');
SELECT public.sa_create_index('idx_bc_requestee_id', 'business_connections', 'requestee_id');
SELECT public.sa_create_index('idx_bc_status', 'business_connections', 'status');

-- =============================================================================
-- 4) PROCUREMENT: purchase_orders
-- =============================================================================
SELECT public.sa_add_column('purchase_orders', 'buyer_profile_id', 'bigint');
SELECT public.sa_add_column('purchase_orders', 'supplier_profile_id', 'bigint');
SELECT public.sa_add_column('purchase_orders', 'description', 'text');
SELECT public.sa_add_column('purchase_orders', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('purchase_orders', 'subtotal', 'numeric(18,2)', '0');
SELECT public.sa_add_column('purchase_orders', 'tax_amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('purchase_orders', 'shipping_amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('purchase_orders', 'discount_amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('purchase_orders', 'promised_date', 'date');
SELECT public.sa_add_column('purchase_orders', 'actual_delivery_date', 'date');
SELECT public.sa_add_column('purchase_orders', 'order_quantity', 'numeric(18,4)');
SELECT public.sa_add_column('purchase_orders', 'delivered_quantity', 'numeric(18,4)');
SELECT public.sa_add_column('purchase_orders', 'damaged_quantity', 'numeric(18,4)', '0');
SELECT public.sa_add_column('purchase_orders', 'items', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('purchase_orders', 'supplier_wallet', 'text');
SELECT public.sa_add_column('purchase_orders', 'onchain_tx', 'text');
SELECT public.sa_add_column('purchase_orders', 'onchain_po_id', 'text');
SELECT public.sa_add_column('purchase_orders', 'payment_terms', 'text');
SELECT public.sa_add_column('purchase_orders', 'incoterms', 'text');
SELECT public.sa_add_column('purchase_orders', 'delivery_address', 'text');
SELECT public.sa_add_column('purchase_orders', 'approved_at', 'timestamptz');
SELECT public.sa_add_column('purchase_orders', 'approved_by', 'text');
SELECT public.sa_add_column('purchase_orders', 'funded_at', 'timestamptz');
SELECT public.sa_add_column('purchase_orders', 'closed_at', 'timestamptz');
SELECT public.sa_add_column('purchase_orders', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_fk('purchase_orders', 'buyer_profile_id', 'profiles', 'id', 'SET NULL');
SELECT public.sa_add_fk('purchase_orders', 'supplier_profile_id', 'profiles', 'id', 'SET NULL');

-- Map legacy supplier_id → supplier_profile_id
DO $$
BEGIN
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
END $$;

SELECT public.sa_create_index('idx_po_buyer', 'purchase_orders', 'buyer_profile_id');
SELECT public.sa_create_index('idx_po_supplier', 'purchase_orders', 'supplier_profile_id');
SELECT public.sa_create_index('idx_po_supplier_legacy', 'purchase_orders', 'supplier_id');
SELECT public.sa_create_index('idx_po_status', 'purchase_orders', 'status');
SELECT public.sa_create_index('idx_po_number', 'purchase_orders', 'po_number');
SELECT public.sa_create_index('idx_po_created', 'purchase_orders', 'created_at');

-- po_items
SELECT public.sa_add_column('po_items', 'line_number', 'int');
SELECT public.sa_add_column('po_items', 'tax_rate', 'numeric(8,4)', '0');
SELECT public.sa_add_column('po_items', 'received_quantity', 'numeric(18,4)', '0');
SELECT public.sa_add_column('po_items', 'notes', 'text');
SELECT public.sa_add_column('po_items', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_create_index('idx_po_items_po', 'po_items', 'po_id');

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
  converted_po_id bigint,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('requisitions', 'profile_id', 'bigint');
SELECT public.sa_add_fk('requisitions', 'profile_id', 'profiles', 'id', 'CASCADE');
SELECT public.sa_create_index('idx_requisitions_profile', 'requisitions', 'profile_id');
SELECT public.sa_create_index('idx_requisitions_status', 'requisitions', 'status');

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
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_create_index('idx_scorecards_buyer', 'supplier_scorecards', 'buyer_profile_id');
SELECT public.sa_create_index('idx_scorecards_supplier', 'supplier_scorecards', 'supplier_profile_id');

-- =============================================================================
-- 5) INVENTORY
-- =============================================================================
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
SELECT public.sa_add_column('warehouses', 'profile_id', 'bigint');
SELECT public.sa_add_fk('warehouses', 'profile_id', 'profiles', 'id', 'CASCADE');
SELECT public.sa_create_index('idx_warehouses_profile', 'warehouses', 'profile_id');

SELECT public.sa_add_column('products', 'warehouse_id', 'bigint');
SELECT public.sa_add_column('products', 'reorder_level', 'numeric(18,4)', '0');
SELECT public.sa_add_column('products', 'reorder_qty', 'numeric(18,4)', '0');
SELECT public.sa_add_column('products', 'qty_on_hand', 'numeric(18,4)', '0');
SELECT public.sa_add_column('products', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('products', 'profile_id', 'bigint');
SELECT public.sa_add_fk('products', 'profile_id', 'profiles', 'id', 'CASCADE');
SELECT public.sa_create_index('idx_products_profile', 'products', 'profile_id');
SELECT public.sa_create_index('idx_products_sku', 'products', 'sku');

CREATE TABLE IF NOT EXISTS public.stock_levels (
  id bigserial PRIMARY KEY,
  profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id bigint REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id bigint,
  qty_on_hand numeric(18,4) NOT NULL DEFAULT 0,
  qty_reserved numeric(18,4) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('stock_levels', 'profile_id', 'bigint');
SELECT public.sa_add_column('stock_levels', 'product_id', 'bigint');
SELECT public.sa_add_column('stock_levels', 'warehouse_id', 'bigint');
SELECT public.sa_add_column('stock_levels', 'qty_on_hand', 'numeric(18,4)', '0');
SELECT public.sa_add_column('stock_levels', 'qty_reserved', 'numeric(18,4)', '0');
SELECT public.sa_create_index('idx_stock_levels_profile', 'stock_levels', 'profile_id');
SELECT public.sa_create_index('idx_stock_levels_product', 'stock_levels', 'product_id');

-- qty_available generated column (optional)
DO $$
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
END $$;

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id bigserial PRIMARY KEY,
  profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id bigint REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id bigint,
  movement_type text NOT NULL DEFAULT 'adjustment',
  quantity numeric(18,4) NOT NULL DEFAULT 0,
  reference_type text,
  reference_id text,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('stock_movements', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_stock_movements_profile', 'stock_movements', 'profile_id');
SELECT public.sa_create_index('idx_stock_movements_product', 'stock_movements', 'product_id');

-- =============================================================================
-- 6) CONTAINERS
-- =============================================================================
SELECT public.sa_add_column('containers', 'profile_id', 'bigint');
SELECT public.sa_add_column('containers', 'assigned_contractor', 'text');
SELECT public.sa_add_column('containers', 'contractor_id', 'bigint');
SELECT public.sa_add_column('containers', 'tags', 'text[]', '''{}''');
SELECT public.sa_add_column('containers', 'wifi_portal_url', 'text');
SELECT public.sa_add_column('containers', 'capacity_units', 'numeric(18,2)');
SELECT public.sa_add_column('containers', 'monthly_target', 'numeric(18,2)');
SELECT public.sa_add_column('containers', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_fk('containers', 'profile_id', 'profiles', 'id', 'CASCADE');

SELECT public.sa_create_index('idx_containers_profile', 'containers', 'profile_id');
SELECT public.sa_create_index('idx_containers_status', 'containers', 'status');
SELECT public.sa_create_index('idx_containers_code', 'containers', 'container_code');

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
SELECT public.sa_add_column('container_contractors', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_container_contractors_profile', 'container_contractors', 'profile_id');

DO $$
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
END $$;

CREATE TABLE IF NOT EXISTS public.container_sales (
  id bigserial PRIMARY KEY,
  profile_id bigint REFERENCES public.profiles(id) ON DELETE CASCADE,
  container_id bigint REFERENCES public.containers(id) ON DELETE CASCADE,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  gross_amount numeric(18,2) NOT NULL DEFAULT 0,
  net_amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text DEFAULT 'ZAR',
  payment_method text,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('container_sales', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_container_sales_container', 'container_sales', 'container_id');

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
SELECT public.sa_add_column('container_payouts', 'profile_id', 'bigint');

-- =============================================================================
-- 7) CUSTOMERS / SALES
-- =============================================================================
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
SELECT public.sa_add_column('customers', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_customers_profile', 'customers', 'profile_id');

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
SELECT public.sa_add_column('sales_orders', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_sales_orders_profile', 'sales_orders', 'profile_id');
SELECT public.sa_create_index('idx_sales_orders_status', 'sales_orders', 'status');

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
SELECT public.sa_add_column('leads', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_leads_profile', 'leads', 'profile_id');

-- =============================================================================
-- 8) DISTRIBUTION
-- =============================================================================
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
SELECT public.sa_add_column('shipments', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_shipments_profile', 'shipments', 'profile_id');

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
SELECT public.sa_add_column('carriers', 'profile_id', 'bigint');

-- =============================================================================
-- 9) QUALITY & COMPLIANCE
-- =============================================================================
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
SELECT public.sa_add_column('quality_inspections', 'profile_id', 'bigint');

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
SELECT public.sa_add_column('haccp_records', 'profile_id', 'bigint');

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
SELECT public.sa_add_column('compliance_certificates', 'profile_id', 'bigint');

-- RIAD: add profile_id only if missing; backfill from owner_id
SELECT public.sa_add_column('riad_logs', 'profile_id', 'bigint');
SELECT public.sa_add_column('riad_logs', 'mitigation_plan', 'text');
SELECT public.sa_add_column('riad_logs', 'residual_rpn', 'int');
SELECT public.sa_add_fk('riad_logs', 'profile_id', 'profiles', 'id', 'CASCADE');

DO $$
BEGIN
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
END $$;

SELECT public.sa_create_index('idx_riad_profile', 'riad_logs', 'profile_id');
SELECT public.sa_create_index('idx_riad_owner', 'riad_logs', 'owner_id');
SELECT public.sa_create_index('idx_riad_status', 'riad_logs', 'status');

-- =============================================================================
-- 10) FINANCE
-- =============================================================================
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
SELECT public.sa_add_column('chart_of_accounts', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_coa_profile', 'chart_of_accounts', 'profile_id');

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
SELECT public.sa_add_column('journal_entries', 'profile_id', 'bigint');

CREATE TABLE IF NOT EXISTS public.journal_lines (
  id bigserial PRIMARY KEY,
  journal_entry_id bigint REFERENCES public.journal_entries(id) ON DELETE CASCADE,
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
SELECT public.sa_add_column('invoices', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_invoices_profile', 'invoices', 'profile_id');
SELECT public.sa_create_index('idx_invoices_status', 'invoices', 'status');

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
SELECT public.sa_add_column('payments', 'profile_id', 'bigint');

-- =============================================================================
-- 11) PEOPLE
-- =============================================================================
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
SELECT public.sa_add_column('employees', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_employees_profile', 'employees', 'profile_id');

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
SELECT public.sa_add_column('training_records', 'profile_id', 'bigint');

-- =============================================================================
-- 12) PROJECTS
-- =============================================================================
SELECT public.sa_add_column('projects', 'owner_user_id', 'text');
SELECT public.sa_add_column('projects', 'budget', 'numeric(18,2)');
SELECT public.sa_add_column('projects', 'end_date', 'date');
SELECT public.sa_add_column('projects', 'priority', 'text', '''medium''');
SELECT public.sa_add_column('projects', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('projects', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_projects_profile', 'projects', 'profile_id');

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id bigserial PRIMARY KEY,
  project_id bigint REFERENCES public.projects(id) ON DELETE CASCADE,
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
SELECT public.sa_add_column('timesheets', 'profile_id', 'bigint');

-- =============================================================================
-- 13) SUSTAINABILITY
-- =============================================================================
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
SELECT public.sa_add_column('carbon_entries', 'profile_id', 'bigint');

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
SELECT public.sa_add_column('sustainability_certificates', 'profile_id', 'bigint');

-- =============================================================================
-- 14) AUDIT
-- =============================================================================
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
SELECT public.sa_add_column('activity_log', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_activity_log_profile', 'activity_log', 'profile_id');
SELECT public.sa_create_index('idx_activity_log_created', 'activity_log', 'created_at');

-- =============================================================================
-- 15) INVITATIONS
-- =============================================================================
SELECT public.sa_add_column('invitations', 'invite_kind', 'text', '''team''');
SELECT public.sa_add_column('invitations', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('invitations', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_invitations_profile', 'invitations', 'profile_id');
SELECT public.sa_create_index('idx_invitations_token', 'invitations', 'token');
SELECT public.sa_create_index('idx_invitations_status', 'invitations', 'status');

-- documents / company_documents safety
SELECT public.sa_add_column('documents', 'profile_id', 'bigint');
SELECT public.sa_add_column('company_documents', 'profile_id', 'bigint');
SELECT public.sa_create_index('idx_documents_profile', 'documents', 'profile_id');
SELECT public.sa_create_index('idx_company_documents_profile', 'company_documents', 'profile_id');

-- =============================================================================
-- 16) updated_at triggers
-- =============================================================================
DO $$
DECLARE
  t text;
BEGIN
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
END $$;

-- =============================================================================
-- 17) RLS (transitional open policies; service role bypasses RLS)
-- =============================================================================
DO $$
DECLARE
  t text;
  pol_select text;
  pol_write text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'warehouses','stock_levels','stock_movements','container_contractors',
    'container_sales','container_payouts','customers','sales_orders','leads',
    'shipments','carriers','quality_inspections','haccp_records','compliance_certificates',
    'chart_of_accounts','journal_entries','journal_lines','invoices','payments',
    'employees','training_records','project_tasks','timesheets','carbon_entries',
    'sustainability_certificates','activity_log','requisitions','supplier_scorecards'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      pol_select := t || '_select_all';
      pol_write := t || '_write_all';
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
-- Done
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE 'SupplierAdvisor world-class schema v2 applied successfully';
END $$;
