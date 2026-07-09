-- Snapshot physical collection + destination coordinates on each transfer
-- + ensure warehouse lat/lng exist. Safe / idempotent.

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

-- Warehouse physical GPS (collection / destination sites)
SELECT public.sa_add_column('warehouses', 'lat', 'double precision');
SELECT public.sa_add_column('warehouses', 'lng', 'double precision');

-- Transfer endpoint snapshots (frozen at create/ship so ETA stays correct)
SELECT public.sa_add_column('stock_transfer_orders', 'from_lat', 'double precision');
SELECT public.sa_add_column('stock_transfer_orders', 'from_lng', 'double precision');
SELECT public.sa_add_column('stock_transfer_orders', 'to_lat', 'double precision');
SELECT public.sa_add_column('stock_transfer_orders', 'to_lng', 'double precision');
SELECT public.sa_add_column('stock_transfer_orders', 'from_address', 'text');
SELECT public.sa_add_column('stock_transfer_orders', 'to_address', 'text');

-- Backfill endpoints from warehouse physical coords where missing
UPDATE public.stock_transfer_orders t
SET
  from_lat = w.lat,
  from_lng = w.lng,
  from_address = COALESCE(t.from_address, NULLIF(trim(concat_ws(', ', w.address, w.city, w.country)), ''))
FROM public.warehouses w
WHERE t.from_warehouse_id = w.id
  AND t.from_lat IS NULL
  AND w.lat IS NOT NULL
  AND w.lng IS NOT NULL;

UPDATE public.stock_transfer_orders t
SET
  to_lat = w.lat,
  to_lng = w.lng,
  to_address = COALESCE(t.to_address, NULLIF(trim(concat_ws(', ', w.address, w.city, w.country)), ''))
FROM public.warehouses w
WHERE t.to_warehouse_id = w.id
  AND t.to_lat IS NULL
  AND w.lat IS NOT NULL
  AND w.lng IS NOT NULL;

SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='stock_transfer_orders'
  AND column_name IN ('from_lat','from_lng','to_lat','to_lng','from_address','to_address')
ORDER BY 1;

SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='warehouses'
  AND column_name IN ('lat','lng')
ORDER BY 1;
