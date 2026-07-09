-- Lot / serial pedigree, GS1 fields, EDI messages, warehouse↔container sync
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

-- Product GS1
SELECT public.sa_add_column('products', 'gtin', 'text');
SELECT public.sa_add_column('products', 'gtin14', 'text');
SELECT public.sa_add_column('products', 'gs1_company_prefix', 'text');

-- Lots
CREATE TABLE IF NOT EXISTS public.inventory_lots (
  id bigserial PRIMARY KEY,
  profile_id bigint,
  product_id bigint,
  lot_number text NOT NULL,
  expiry_date date,
  best_before date,
  manufactured_date date,
  qty_on_hand numeric(18,4) NOT NULL DEFAULT 0,
  warehouse_id bigint,
  container_id bigint,
  status text DEFAULT 'active',
  supplier_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('inventory_lots', 'profile_id', 'bigint');
SELECT public.sa_add_column('inventory_lots', 'product_id', 'bigint');
SELECT public.sa_add_column('inventory_lots', 'lot_number', 'text');
SELECT public.sa_add_column('inventory_lots', 'expiry_date', 'date');
SELECT public.sa_add_column('inventory_lots', 'best_before', 'date');
SELECT public.sa_add_column('inventory_lots', 'manufactured_date', 'date');
SELECT public.sa_add_column('inventory_lots', 'qty_on_hand', 'numeric(18,4)', '0');
SELECT public.sa_add_column('inventory_lots', 'warehouse_id', 'bigint');
SELECT public.sa_add_column('inventory_lots', 'container_id', 'bigint');
SELECT public.sa_add_column('inventory_lots', 'status', 'text', '''active''');
SELECT public.sa_add_column('inventory_lots', 'supplier_ref', 'text');
SELECT public.sa_add_column('inventory_lots', 'notes', 'text');
SELECT public.sa_add_column('inventory_lots', 'gtin14', 'text');

-- Serial numbers
CREATE TABLE IF NOT EXISTS public.inventory_serials (
  id bigserial PRIMARY KEY,
  profile_id bigint,
  product_id bigint,
  serial_number text NOT NULL,
  lot_id bigint,
  lot_number text,
  status text DEFAULT 'in_stock', -- in_stock | issued | sold | returned | scrapped
  warehouse_id bigint,
  container_id bigint,
  onchain_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('inventory_serials', 'profile_id', 'bigint');
SELECT public.sa_add_column('inventory_serials', 'product_id', 'bigint');
SELECT public.sa_add_column('inventory_serials', 'serial_number', 'text');
SELECT public.sa_add_column('inventory_serials', 'lot_id', 'bigint');
SELECT public.sa_add_column('inventory_serials', 'lot_number', 'text');
SELECT public.sa_add_column('inventory_serials', 'status', 'text', '''in_stock''');
SELECT public.sa_add_column('inventory_serials', 'warehouse_id', 'bigint');
SELECT public.sa_add_column('inventory_serials', 'container_id', 'bigint');
SELECT public.sa_add_column('inventory_serials', 'onchain_hash', 'text');

-- EDI messages log
CREATE TABLE IF NOT EXISTS public.edi_messages (
  id bigserial PRIMARY KEY,
  profile_id bigint,
  direction text NOT NULL DEFAULT 'outbound', -- inbound | outbound
  standard text DEFAULT 'X12',
  transaction_set text,
  control_number text,
  trading_partner text,
  status text DEFAULT 'generated', -- generated | sent | received | failed | acknowledged
  payload jsonb DEFAULT '{}'::jsonb,
  raw_text text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('edi_messages', 'profile_id', 'bigint');
SELECT public.sa_add_column('edi_messages', 'direction', 'text', '''outbound''');
SELECT public.sa_add_column('edi_messages', 'standard', 'text', '''X12''');
SELECT public.sa_add_column('edi_messages', 'transaction_set', 'text');
SELECT public.sa_add_column('edi_messages', 'control_number', 'text');
SELECT public.sa_add_column('edi_messages', 'trading_partner', 'text');
SELECT public.sa_add_column('edi_messages', 'status', 'text', '''generated''');
SELECT public.sa_add_column('edi_messages', 'payload', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('edi_messages', 'raw_text', 'text');

-- Warehouse ↔ container transfer jobs
CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id bigserial PRIMARY KEY,
  profile_id bigint,
  product_id bigint,
  quantity numeric(18,4) NOT NULL DEFAULT 0,
  from_type text, -- warehouse | container
  from_id bigint,
  to_type text,
  to_id bigint,
  lot_number text,
  status text DEFAULT 'completed', -- draft | in_transit | completed | cancelled
  movement_id bigint,
  container_inventory_id bigint,
  onchain_hash text,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('inventory_transfers', 'profile_id', 'bigint');
SELECT public.sa_add_column('inventory_transfers', 'product_id', 'bigint');
SELECT public.sa_add_column('inventory_transfers', 'quantity', 'numeric(18,4)', '0');
SELECT public.sa_add_column('inventory_transfers', 'from_type', 'text');
SELECT public.sa_add_column('inventory_transfers', 'from_id', 'bigint');
SELECT public.sa_add_column('inventory_transfers', 'to_type', 'text');
SELECT public.sa_add_column('inventory_transfers', 'to_id', 'bigint');
SELECT public.sa_add_column('inventory_transfers', 'lot_number', 'text');
SELECT public.sa_add_column('inventory_transfers', 'status', 'text', '''completed''');
SELECT public.sa_add_column('inventory_transfers', 'onchain_hash', 'text');
SELECT public.sa_add_column('inventory_transfers', 'product_name', 'text');
SELECT public.sa_add_column('inventory_transfers', 'sku', 'text');

-- Stock movement pedigree
SELECT public.sa_add_column('stock_movements', 'lot_number', 'text');
SELECT public.sa_add_column('stock_movements', 'serial_number', 'text');
SELECT public.sa_add_column('stock_movements', 'expiry_date', 'date');
SELECT public.sa_add_column('stock_movements', 'gtin14', 'text');
SELECT public.sa_add_column('stock_movements', 'scan_raw', 'text');
SELECT public.sa_add_column('stock_movements', 'container_id', 'bigint');

ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edi_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_lots_all ON public.inventory_lots;
CREATE POLICY inventory_lots_all ON public.inventory_lots FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS inventory_serials_all ON public.inventory_serials;
CREATE POLICY inventory_serials_all ON public.inventory_serials FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS edi_messages_all ON public.edi_messages;
CREATE POLICY edi_messages_all ON public.edi_messages FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS inventory_transfers_all ON public.inventory_transfers;
CREATE POLICY inventory_transfers_all ON public.inventory_transfers FOR ALL USING (true) WITH CHECK (true);

SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('inventory_lots','inventory_serials','edi_messages','inventory_transfers','products')
  AND column_name IN ('lot_number','serial_number','gtin14','transaction_set','from_type')
ORDER BY 1;
