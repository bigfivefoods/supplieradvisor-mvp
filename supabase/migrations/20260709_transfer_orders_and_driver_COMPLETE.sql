-- =============================================================================
-- COMPLETE: stock transfer orders + lines + driver cellphone tracking
-- Run this ONE file in Supabase SQL Editor (safe / idempotent).
-- Fixes: relation "stock_transfer_orders" does not exist
-- =============================================================================

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

-- ── Optional warehouse partner fields (only if warehouses table exists) ─────
SELECT public.sa_add_column('warehouses', 'owner_type', 'text', '''own''');
SELECT public.sa_add_column('warehouses', 'partner_name', 'text');
SELECT public.sa_add_column('warehouses', 'partner_ref', 'text');
SELECT public.sa_add_column('warehouses', 'contact_name', 'text');
SELECT public.sa_add_column('warehouses', 'contact_email', 'text');
SELECT public.sa_add_column('warehouses', 'contact_phone', 'text');
SELECT public.sa_add_column('warehouses', 'notes', 'text');
SELECT public.sa_add_column('warehouses', 'allow_stock', 'boolean', 'true');
SELECT public.sa_add_column('warehouses', 'postal_code', 'text');
SELECT public.sa_add_column('warehouses', 'region', 'text');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='warehouses'
  ) THEN
    UPDATE public.warehouses SET owner_type = 'own' WHERE owner_type IS NULL;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'warehouses owner_type backfill skip: %', SQLERRM;
END $$;

-- =============================================================================
-- 1) CREATE transfer tables FIRST (this was missing in your DB)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.stock_transfer_orders (
  id bigserial PRIMARY KEY,
  profile_id bigint,
  transfer_number text,
  status text NOT NULL DEFAULT 'draft',
  from_warehouse_id bigint,
  to_warehouse_id bigint,
  expected_ship_date date,
  expected_receive_date date,
  shipped_at timestamptz,
  received_at timestamptz,
  cancelled_at timestamptz,
  carrier text,
  tracking_ref text,
  ship_notes text,
  receive_notes text,
  notes text,
  created_by text,
  onchain_hash text,
  from_warehouse_name text,
  to_warehouse_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('stock_transfer_orders', 'profile_id', 'bigint');
SELECT public.sa_add_column('stock_transfer_orders', 'transfer_number', 'text');
SELECT public.sa_add_column('stock_transfer_orders', 'status', 'text', '''draft''');
SELECT public.sa_add_column('stock_transfer_orders', 'from_warehouse_id', 'bigint');
SELECT public.sa_add_column('stock_transfer_orders', 'to_warehouse_id', 'bigint');
SELECT public.sa_add_column('stock_transfer_orders', 'expected_ship_date', 'date');
SELECT public.sa_add_column('stock_transfer_orders', 'expected_receive_date', 'date');
SELECT public.sa_add_column('stock_transfer_orders', 'shipped_at', 'timestamptz');
SELECT public.sa_add_column('stock_transfer_orders', 'received_at', 'timestamptz');
SELECT public.sa_add_column('stock_transfer_orders', 'cancelled_at', 'timestamptz');
SELECT public.sa_add_column('stock_transfer_orders', 'carrier', 'text');
SELECT public.sa_add_column('stock_transfer_orders', 'tracking_ref', 'text');
SELECT public.sa_add_column('stock_transfer_orders', 'ship_notes', 'text');
SELECT public.sa_add_column('stock_transfer_orders', 'receive_notes', 'text');
SELECT public.sa_add_column('stock_transfer_orders', 'notes', 'text');
SELECT public.sa_add_column('stock_transfer_orders', 'created_by', 'text');
SELECT public.sa_add_column('stock_transfer_orders', 'onchain_hash', 'text');
SELECT public.sa_add_column('stock_transfer_orders', 'from_warehouse_name', 'text');
SELECT public.sa_add_column('stock_transfer_orders', 'to_warehouse_name', 'text');

CREATE TABLE IF NOT EXISTS public.stock_transfer_lines (
  id bigserial PRIMARY KEY,
  transfer_id bigint NOT NULL,
  profile_id bigint,
  product_id bigint,
  product_name text,
  sku text,
  uom text DEFAULT 'unit',
  qty_requested numeric(18,4) NOT NULL DEFAULT 0,
  qty_shipped numeric(18,4) NOT NULL DEFAULT 0,
  qty_received numeric(18,4) NOT NULL DEFAULT 0,
  lot_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('stock_transfer_lines', 'transfer_id', 'bigint');
SELECT public.sa_add_column('stock_transfer_lines', 'profile_id', 'bigint');
SELECT public.sa_add_column('stock_transfer_lines', 'product_id', 'bigint');
SELECT public.sa_add_column('stock_transfer_lines', 'product_name', 'text');
SELECT public.sa_add_column('stock_transfer_lines', 'sku', 'text');
SELECT public.sa_add_column('stock_transfer_lines', 'uom', 'text', '''unit''');
SELECT public.sa_add_column('stock_transfer_lines', 'qty_requested', 'numeric(18,4)', '0');
SELECT public.sa_add_column('stock_transfer_lines', 'qty_shipped', 'numeric(18,4)', '0');
SELECT public.sa_add_column('stock_transfer_lines', 'qty_received', 'numeric(18,4)', '0');
SELECT public.sa_add_column('stock_transfer_lines', 'lot_number', 'text');
SELECT public.sa_add_column('stock_transfer_lines', 'notes', 'text');

-- =============================================================================
-- 2) Driver cellphone tracking columns (QR token + GPS)
-- =============================================================================

SELECT public.sa_add_column('stock_transfer_orders', 'public_token', 'text');
SELECT public.sa_add_column('stock_transfer_orders', 'driver_name', 'text');
SELECT public.sa_add_column('stock_transfer_orders', 'driver_phone', 'text');
SELECT public.sa_add_column('stock_transfer_orders', 'vehicle_reg', 'text');
SELECT public.sa_add_column('stock_transfer_orders', 'pickup_scanned_at', 'timestamptz');
SELECT public.sa_add_column('stock_transfer_orders', 'pickup_lat', 'double precision');
SELECT public.sa_add_column('stock_transfer_orders', 'pickup_lng', 'double precision');
SELECT public.sa_add_column('stock_transfer_orders', 'dropoff_scanned_at', 'timestamptz');
SELECT public.sa_add_column('stock_transfer_orders', 'dropoff_lat', 'double precision');
SELECT public.sa_add_column('stock_transfer_orders', 'dropoff_lng', 'double precision');
SELECT public.sa_add_column('stock_transfer_orders', 'last_lat', 'double precision');
SELECT public.sa_add_column('stock_transfer_orders', 'last_lng', 'double precision');
SELECT public.sa_add_column('stock_transfer_orders', 'last_location_at', 'timestamptz');
SELECT public.sa_add_column('stock_transfer_orders', 'driver_notes', 'text');

-- Backfill tokens only AFTER table exists
UPDATE public.stock_transfer_orders
SET public_token = replace(gen_random_uuid()::text, '-', '')
WHERE public_token IS NULL;

-- =============================================================================
-- 3) Event trail (scan + GPS pings)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.stock_transfer_events (
  id bigserial PRIMARY KEY,
  transfer_id bigint NOT NULL,
  profile_id bigint,
  event_type text NOT NULL,
  actor_name text,
  actor_phone text,
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  payload jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('stock_transfer_events', 'transfer_id', 'bigint');
SELECT public.sa_add_column('stock_transfer_events', 'profile_id', 'bigint');
SELECT public.sa_add_column('stock_transfer_events', 'event_type', 'text');
SELECT public.sa_add_column('stock_transfer_events', 'actor_name', 'text');
SELECT public.sa_add_column('stock_transfer_events', 'actor_phone', 'text');
SELECT public.sa_add_column('stock_transfer_events', 'lat', 'double precision');
SELECT public.sa_add_column('stock_transfer_events', 'lng', 'double precision');
SELECT public.sa_add_column('stock_transfer_events', 'accuracy_m', 'double precision');
SELECT public.sa_add_column('stock_transfer_events', 'payload', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('stock_transfer_events', 'notes', 'text');

-- =============================================================================
-- 4) Indexes + RLS
-- =============================================================================

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_stock_transfer_orders_profile ON public.stock_transfer_orders(profile_id);
  CREATE INDEX IF NOT EXISTS idx_stock_transfer_orders_status ON public.stock_transfer_orders(status);
  CREATE INDEX IF NOT EXISTS idx_stock_transfer_lines_transfer ON public.stock_transfer_lines(transfer_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_transfer_orders_public_token
    ON public.stock_transfer_orders(public_token)
    WHERE public_token IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_stock_transfer_events_transfer ON public.stock_transfer_events(transfer_id);
  CREATE INDEX IF NOT EXISTS idx_stock_transfer_events_created ON public.stock_transfer_events(created_at DESC);
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='warehouses'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_warehouses_owner_type ON public.warehouses(owner_type);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'index skip: %', SQLERRM;
END $$;

ALTER TABLE public.stock_transfer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_transfer_orders_all ON public.stock_transfer_orders;
CREATE POLICY stock_transfer_orders_all ON public.stock_transfer_orders FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS stock_transfer_lines_all ON public.stock_transfer_lines;
CREATE POLICY stock_transfer_lines_all ON public.stock_transfer_lines FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS stock_transfer_events_all ON public.stock_transfer_events;
CREATE POLICY stock_transfer_events_all ON public.stock_transfer_events FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- 5) Verify
-- =============================================================================

SELECT 'stock_transfer_orders' AS table_name, count(*) AS columns
FROM information_schema.columns
WHERE table_schema='public' AND table_name='stock_transfer_orders'
UNION ALL
SELECT 'stock_transfer_lines', count(*)
FROM information_schema.columns
WHERE table_schema='public' AND table_name='stock_transfer_lines'
UNION ALL
SELECT 'stock_transfer_events', count(*)
FROM information_schema.columns
WHERE table_schema='public' AND table_name='stock_transfer_events';

SELECT column_name
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='stock_transfer_orders'
  AND column_name IN (
    'transfer_number','public_token','driver_name',
    'pickup_scanned_at','last_lat','dropoff_scanned_at','status'
  )
ORDER BY column_name;
