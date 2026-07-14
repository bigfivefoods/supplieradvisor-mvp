-- Container resellers: verified sellers who draw stock from containers and earn per-item commission

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

-- ── Resellers (people) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.container_resellers (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  id_number TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  -- draft | invited | active | suspended
  portal_status TEXT NOT NULL DEFAULT 'draft',
  user_id TEXT,
  invite_token TEXT,
  invited_at TIMESTAMPTZ,
  contract_accepted_at TIMESTAMPTZ,
  -- Linked primary container (can draw from multiple via transfers)
  primary_container_id BIGINT,
  -- VerifyNow
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  verified_at TIMESTAMPTZ,
  verification_provider TEXT,
  verification_reference TEXT,
  verification_data JSONB,
  verified_first_names TEXT,
  verified_last_name TEXT,
  verified_dob TEXT,
  consent_identity_check BOOLEAN DEFAULT false,
  consent_identity_at TIMESTAMPTZ,
  id_document_url TEXT,
  id_document_name TEXT,
  -- R50 VerifyNow charge per verified person
  verification_fee_zar NUMERIC(12,2) NOT NULL DEFAULT 50,
  verification_fee_status TEXT NOT NULL DEFAULT 'not_charged',
  -- not_charged | charged | waived
  verification_fee_charged_at TIMESTAMPTZ,
  bank_details JSONB,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_container_resellers_profile ON public.container_resellers(profile_id);
CREATE INDEX IF NOT EXISTS idx_container_resellers_user ON public.container_resellers(user_id);
CREATE INDEX IF NOT EXISTS idx_container_resellers_email ON public.container_resellers(email);
CREATE INDEX IF NOT EXISTS idx_container_resellers_token ON public.container_resellers(invite_token);

-- ── Per-item commission rates (dynamic) ──────────────────────────────────────
-- company default per product; optional reseller override
CREATE TABLE IF NOT EXISTS public.reseller_commission_rates (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  product_id BIGINT,
  product_name TEXT,
  sku TEXT,
  -- null reseller_id = company default for that product
  reseller_id BIGINT,
  commission_type TEXT NOT NULL DEFAULT 'percent',
  -- percent | fixed
  commission_value NUMERIC(18,4) NOT NULL DEFAULT 10,
  -- percent: 10 = 10%; fixed: ZAR amount per unit sold
  currency TEXT NOT NULL DEFAULT 'ZAR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reseller_commission_profile ON public.reseller_commission_rates(profile_id);
CREATE INDEX IF NOT EXISTS idx_reseller_commission_product ON public.reseller_commission_rates(profile_id, product_id);
CREATE INDEX IF NOT EXISTS idx_reseller_commission_reseller ON public.reseller_commission_rates(reseller_id);

-- ── Stock held by reseller (drawn from containers) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.reseller_inventory (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  reseller_id BIGINT NOT NULL,
  container_id BIGINT,
  product_id BIGINT,
  product_name TEXT NOT NULL DEFAULT 'Item',
  sku TEXT,
  qty_on_hand NUMERIC(18,4) NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'unit',
  unit_cost NUMERIC(18,2) DEFAULT 0,
  unit_sell_price NUMERIC(18,2) DEFAULT 0,
  last_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reseller_inventory_reseller ON public.reseller_inventory(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_inventory_profile ON public.reseller_inventory(profile_id);

-- ── Draw / transfer log (container → reseller) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reseller_stock_transfers (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  reseller_id BIGINT NOT NULL,
  container_id BIGINT NOT NULL,
  transfer_number TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  -- draft | completed | cancelled
  notes TEXT,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ product_id, product_name, sku, qty, unit, unit_cost }]
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reseller_transfers_profile ON public.reseller_stock_transfers(profile_id);
CREATE INDEX IF NOT EXISTS idx_reseller_transfers_reseller ON public.reseller_stock_transfers(reseller_id);

-- ── Reseller sales ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reseller_sales (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL,
  reseller_id BIGINT NOT NULL,
  container_id BIGINT,
  sale_number TEXT,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  commission_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  notes TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ product_id, product_name, sku, qty, unit_price, line_total, commission_type, commission_value, commission_amount }]
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reseller_sales_profile ON public.reseller_sales(profile_id);
CREATE INDEX IF NOT EXISTS idx_reseller_sales_reseller ON public.reseller_sales(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_sales_date ON public.reseller_sales(sale_date);

-- ── RLS deny anon (service role APIs) ────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'container_resellers',
    'reseller_commission_rates',
    'reseller_inventory',
    'reseller_stock_transfers',
    'reseller_sales'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS sa_deny_anon ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY sa_deny_anon ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
        t
      );
      EXECUTE format('DROP POLICY IF EXISTS sa_deny_authenticated ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY sa_deny_authenticated ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
        t
      );
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'reseller RLS % skip: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE public.container_resellers IS
  'Container network resellers — VerifyNow (R50 fee), draw stock, sell with per-item commission';
