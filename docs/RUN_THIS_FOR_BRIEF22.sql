-- Brief 22 — site stamps, product SLA columns, OnePot BOM. Safe to re-run.
-- Paste in the Supabase SQL editor. Does not rename warehouses.

CREATE OR REPLACE FUNCTION public.sa_add_column(p_table text, p_column text, p_type text, p_default text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = p_column
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

SELECT public.sa_add_column('products', 'long_description', 'text');
SELECT public.sa_add_column('products', 'lead_time_days', 'integer');
SELECT public.sa_add_column('products', 'moq', 'numeric(18,4)');

-- Warehouse 1 = Kelpack DC (already Brief 21). Keep name.
UPDATE public.warehouses
SET owner_type = 'supplier',
    warehouse_type = 'supplier_dc',
    partner_name = COALESCE(NULLIF(partner_name, ''), name),
    metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object('srm_supplier_id', 12),
    updated_at = now()
WHERE id = 1 AND profile_id = 102;

-- Warehouse 2 = SA Harvest customer site. Link CRM row by name; create if missing.
INSERT INTO public.customers (profile_id, trading_name, status, updated_at)
SELECT 102, 'SA Harvest', 'active', now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.customers
  WHERE profile_id = 102
    AND (
      trading_name ILIKE '%harvest%'
      OR legal_name ILIKE '%harvest%'
    )
);

UPDATE public.warehouses
SET owner_type = 'customer',
    warehouse_type = 'customer_site',
    partner_name = COALESCE(NULLIF(partner_name, ''), name),
    metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'customer_id',
        (
          SELECT id FROM public.customers
          WHERE profile_id = 102
            AND (trading_name ILIKE '%harvest%' OR legal_name ILIKE '%harvest%')
          ORDER BY id
          LIMIT 1
        )
      ),
    updated_at = now()
WHERE id = 2 AND profile_id = 102;

-- Warehouse 3 = Love Cities Howick → Love Umngeni NPC customers.id=15
UPDATE public.warehouses
SET owner_type = 'customer',
    warehouse_type = 'customer_site',
    partner_name = COALESCE(NULLIF(partner_name, ''), name),
    metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object('customer_id', 15),
    updated_at = now()
WHERE id = 3 AND profile_id = 102;

-- SLA pin only (Commercial). Do not put FG/NSNP onto Kelpack Stock as zeros.
UPDATE public.products
SET metadata = COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object('srm_supplier_id', 12),
    updated_at = now()
WHERE profile_id = 102
  AND id IN (2, 3, 4, 5, 6, 7, 8, 9, 42, 44, 45, 46, 49, 50, 51, 52);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'warehouse_id'
  ) THEN
    UPDATE public.products
    SET warehouse_id = NULL, updated_at = now()
    WHERE profile_id = 102
      AND id IN (2, 3, 4, 5, 6, 7, 8, 9, 42, 44, 45, 46)
      AND warehouse_id = 1;
  END IF;
END $$;

-- OnePot Chicken BOM: 1 unit of film 51 per 1kg bag (documented until recipe grams exist).
INSERT INTO public.manufacturing_boms (
  profile_id, product_id, bom_number, name, revision, status, notes, updated_at
)
SELECT 102, 2, 'BOM-ONEPOT-CHICKEN', 'OnePot Chicken 1kg', 'A', 'active',
       'qty_per 1 film 51 per FG unit until grams are known', now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.manufacturing_boms
  WHERE profile_id = 102 AND product_id = 2 AND bom_number = 'BOM-ONEPOT-CHICKEN'
);

INSERT INTO public.manufacturing_bom_lines (
  bom_id, profile_id, component_product_id, line_no, qty_per, uom, notes
)
SELECT b.id, 102, 51, 10, 1, 'unit', '1 film per 1kg bag (documented placeholder)'
FROM public.manufacturing_boms b
WHERE b.profile_id = 102
  AND b.bom_number = 'BOM-ONEPOT-CHICKEN'
  AND NOT EXISTS (
    SELECT 1 FROM public.manufacturing_bom_lines l
    WHERE l.bom_id = b.id AND l.component_product_id = 51
  );
