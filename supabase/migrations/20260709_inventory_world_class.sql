-- World-class inventory foundation: products, warehouses, stock, movements, QR / on-chain
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

-- Products
CREATE TABLE IF NOT EXISTS public.products (
  id bigserial PRIMARY KEY,
  name text NOT NULL DEFAULT 'Product',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('products', 'profile_id', 'bigint');
SELECT public.sa_add_column('products', 'name', 'text');
SELECT public.sa_add_column('products', 'sku', 'text');
SELECT public.sa_add_column('products', 'barcode', 'text');
SELECT public.sa_add_column('products', 'public_id', 'text'); -- stable UUID for QR
SELECT public.sa_add_column('products', 'category', 'text');
SELECT public.sa_add_column('products', 'product_type', 'text', '''finished_good'''); -- raw_material | finished_good | consumable | kit
SELECT public.sa_add_column('products', 'uom', 'text', '''unit''');
SELECT public.sa_add_column('products', 'sell_price', 'numeric(18,2)', '0');
SELECT public.sa_add_column('products', 'cost_price', 'numeric(18,2)', '0');
SELECT public.sa_add_column('products', 'reorder_level', 'numeric(18,4)', '0');
SELECT public.sa_add_column('products', 'reorder_qty', 'numeric(18,4)', '0');
SELECT public.sa_add_column('products', 'short_description', 'text');
SELECT public.sa_add_column('products', 'status', 'text', '''active''');
SELECT public.sa_add_column('products', 'primary_image_url', 'text');
SELECT public.sa_add_column('products', 'specs_sheet_url', 'text');
SELECT public.sa_add_column('products', 'specs_sheet_name', 'text');
SELECT public.sa_add_column('products', 'track_lot', 'boolean', 'false');
SELECT public.sa_add_column('products', 'track_serial', 'boolean', 'false');
SELECT public.sa_add_column('products', 'is_sellable', 'boolean', 'true');
SELECT public.sa_add_column('products', 'is_purchasable', 'boolean', 'true');
-- On-chain / QR
SELECT public.sa_add_column('products', 'qr_payload', 'text');
SELECT public.sa_add_column('products', 'onchain_status', 'text', '''pending'''); -- pending | hashed | anchored | minted
SELECT public.sa_add_column('products', 'onchain_hash', 'text');
SELECT public.sa_add_column('products', 'onchain_tx_hash', 'text');
SELECT public.sa_add_column('products', 'onchain_token_id', 'text');
SELECT public.sa_add_column('products', 'onchain_chain', 'text', '''base-sepolia''');
SELECT public.sa_add_column('products', 'onchain_anchored_at', 'timestamptz');
SELECT public.sa_add_column('products', 'metadata', 'jsonb', '''{}''::jsonb');

-- Warehouses
CREATE TABLE IF NOT EXISTS public.warehouses (
  id bigserial PRIMARY KEY,
  name text NOT NULL DEFAULT 'Main warehouse',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('warehouses', 'profile_id', 'bigint');
SELECT public.sa_add_column('warehouses', 'name', 'text');
SELECT public.sa_add_column('warehouses', 'code', 'text');
SELECT public.sa_add_column('warehouses', 'warehouse_type', 'text', '''warehouse'''); -- warehouse | container | store | virtual
SELECT public.sa_add_column('warehouses', 'status', 'text', '''active''');
SELECT public.sa_add_column('warehouses', 'address', 'text');
SELECT public.sa_add_column('warehouses', 'city', 'text');
SELECT public.sa_add_column('warehouses', 'country', 'text');
SELECT public.sa_add_column('warehouses', 'container_id', 'bigint');
SELECT public.sa_add_column('warehouses', 'is_default', 'boolean', 'false');

-- Stock levels
CREATE TABLE IF NOT EXISTS public.stock_levels (
  id bigserial PRIMARY KEY,
  qty_on_hand numeric(18,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('stock_levels', 'profile_id', 'bigint');
SELECT public.sa_add_column('stock_levels', 'product_id', 'bigint');
SELECT public.sa_add_column('stock_levels', 'warehouse_id', 'bigint');
SELECT public.sa_add_column('stock_levels', 'qty_on_hand', 'numeric(18,4)', '0');
SELECT public.sa_add_column('stock_levels', 'qty_reserved', 'numeric(18,4)', '0');
SELECT public.sa_add_column('stock_levels', 'reorder_level', 'numeric(18,4)', '0');
SELECT public.sa_add_column('stock_levels', 'lot_number', 'text');
SELECT public.sa_add_column('stock_levels', 'expiry_date', 'date');
SELECT public.sa_add_column('stock_levels', 'bin_location', 'text');

-- Stock movements (immutable ledger)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id bigserial PRIMARY KEY,
  movement_type text NOT NULL DEFAULT 'adjustment',
  quantity numeric(18,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('stock_movements', 'profile_id', 'bigint');
SELECT public.sa_add_column('stock_movements', 'product_id', 'bigint');
SELECT public.sa_add_column('stock_movements', 'warehouse_id', 'bigint');
SELECT public.sa_add_column('stock_movements', 'from_warehouse_id', 'bigint');
SELECT public.sa_add_column('stock_movements', 'to_warehouse_id', 'bigint');
SELECT public.sa_add_column('stock_movements', 'movement_type', 'text', '''adjustment''');
-- receive | issue | transfer | adjustment | count | sale | return
SELECT public.sa_add_column('stock_movements', 'quantity', 'numeric(18,4)', '0');
SELECT public.sa_add_column('stock_movements', 'unit_cost', 'numeric(18,4)', '0');
SELECT public.sa_add_column('stock_movements', 'reference_type', 'text');
SELECT public.sa_add_column('stock_movements', 'reference_id', 'text');
SELECT public.sa_add_column('stock_movements', 'notes', 'text');
SELECT public.sa_add_column('stock_movements', 'created_by', 'text');
SELECT public.sa_add_column('stock_movements', 'onchain_hash', 'text');
SELECT public.sa_add_column('stock_movements', 'lot_number', 'text');

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_products_profile ON public.products(profile_id);
  CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
  CREATE INDEX IF NOT EXISTS idx_products_public_id ON public.products(public_id);
  CREATE INDEX IF NOT EXISTS idx_warehouses_profile ON public.warehouses(profile_id);
  CREATE INDEX IF NOT EXISTS idx_stock_levels_profile ON public.stock_levels(profile_id);
  CREATE INDEX IF NOT EXISTS idx_stock_levels_product ON public.stock_levels(product_id);
  CREATE INDEX IF NOT EXISTS idx_stock_movements_profile ON public.stock_movements(profile_id);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'inventory index skip: %', SQLERRM;
END $$;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_all ON public.products;
CREATE POLICY products_all ON public.products FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS warehouses_all ON public.warehouses;
CREATE POLICY warehouses_all ON public.warehouses FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS stock_levels_all ON public.stock_levels;
CREATE POLICY stock_levels_all ON public.stock_levels FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS stock_movements_all ON public.stock_movements;
CREATE POLICY stock_movements_all ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);

SELECT 'products' AS t, column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='products'
  AND column_name IN ('public_id','qr_payload','onchain_hash','onchain_status','sku')
ORDER BY 1,2;
