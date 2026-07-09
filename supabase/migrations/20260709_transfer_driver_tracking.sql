-- Driver cellphone transfer tracking: scannable public token, GPS trail, pickup/deliver events
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

-- Public scan token (unguessable) — driver opens /t/{token}
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

-- Backfill tokens for existing orders missing one
UPDATE public.stock_transfer_orders
SET public_token = replace(gen_random_uuid()::text, '-', '')
WHERE public_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_transfer_orders_public_token
  ON public.stock_transfer_orders(public_token)
  WHERE public_token IS NOT NULL;

-- Event trail (scan + GPS pings)
CREATE TABLE IF NOT EXISTS public.stock_transfer_events (
  id bigserial PRIMARY KEY,
  transfer_id bigint NOT NULL,
  profile_id bigint,
  event_type text NOT NULL, -- created | assigned | pickup_scan | en_route | location_ping | dropoff_scan | received | cancelled | note
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

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_stock_transfer_events_transfer ON public.stock_transfer_events(transfer_id);
  CREATE INDEX IF NOT EXISTS idx_stock_transfer_events_created ON public.stock_transfer_events(created_at DESC);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'transfer events index skip: %', SQLERRM;
END $$;

ALTER TABLE public.stock_transfer_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_transfer_events_all ON public.stock_transfer_events;
CREATE POLICY stock_transfer_events_all ON public.stock_transfer_events FOR ALL USING (true) WITH CHECK (true);

SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='stock_transfer_orders'
  AND column_name IN ('public_token','driver_name','pickup_scanned_at','last_lat','dropoff_scanned_at')
ORDER BY 1;
