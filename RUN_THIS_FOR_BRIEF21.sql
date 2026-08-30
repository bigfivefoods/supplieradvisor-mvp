-- Brief 21 — pin Kelpack maker SKUs to warehouse 1 (supplier DC).
-- Safe to re-run. Does not rename the DC. Own and customer sites are unchanged.

-- Warehouse 1 is Kelpack's DC on Big Five Foods (profile 102).
UPDATE public.warehouses
SET metadata = COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object('srm_supplier_id', 12),
    updated_at = now()
WHERE id = 1
  AND profile_id = 102;

-- Finished goods they make + NSNP pack sizes. Films 49–52 already have stock_levels.
UPDATE public.products
SET metadata = COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object('srm_supplier_id', 12),
    updated_at = now()
WHERE profile_id = 102
  AND id IN (2, 3, 4, 5, 6, 7, 8, 9, 42, 44, 45, 46);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'warehouse_id'
  ) THEN
    UPDATE public.products
    SET warehouse_id = 1,
        updated_at = now()
    WHERE profile_id = 102
      AND id IN (2, 3, 4, 5, 6, 7, 8, 9, 42, 44, 45, 46);
  END IF;
END $$;
