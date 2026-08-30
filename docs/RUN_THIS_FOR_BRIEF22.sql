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

-- Inventory cost_price wins over Brief 21 28/35 seeds on supplier catalogue.
-- Customer lines and invoices are not touched.
UPDATE public.party_catalogue_lines l
SET accepted_price = p.cost_price,
    accepted_at = COALESCE(l.accepted_at, now()),
    updated_at = now()
FROM public.products p
WHERE l.profile_id = 102
  AND l.party_kind = 'supplier'
  AND p.profile_id = 102
  AND p.id = l.product_id
  AND p.cost_price IS NOT NULL
  AND l.accepted_price IS DISTINCT FROM p.cost_price;

-- Reprice open draft/sent/confirmed supplier POs (including Kelpack PO 1)
-- from live products.cost_price (inventory wins over a stale accepted seed).
-- Skip received history. Do not rewrite customer invoices.
-- Does not write Kelpack's book id onto purchase_orders.supplier_id.
DO $$
DECLARE
  r record;
  item jsonb;
  new_items jsonb;
  pid integer;
  sku text;
  unit numeric;
  qty numeric;
  line_total numeric;
  total numeric;
  srm integer;
  accepted numeric;
  cost numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
  ) THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT po.id, COALESCE(po.items, '[]'::jsonb) AS items, po.metadata
    FROM public.purchase_orders po
    WHERE po.buyer_profile_id = 102
      AND lower(COALESCE(po.status, '')) IN ('draft', 'sent', 'confirmed')
      AND COALESCE(po.metadata->>'inventory_received_at', '') = ''
  LOOP
    srm := NULL;
    BEGIN
      srm := NULLIF(r.metadata->>'srm_supplier_id', '')::integer;
    EXCEPTION WHEN others THEN
      srm := NULL;
    END;
    IF srm IS NULL THEN
      CONTINUE;
    END IF;
    new_items := '[]'::jsonb;
    total := 0;
    FOR item IN SELECT value FROM jsonb_array_elements(r.items)
    LOOP
      pid := NULL;
      BEGIN
        pid := NULLIF(item->>'product_id', '')::integer;
      EXCEPTION WHEN others THEN
        pid := NULL;
      END;
      sku := NULLIF(btrim(COALESCE(item->>'sku', '')), '');
      IF (pid IS NULL OR pid <= 0) AND sku IS NOT NULL THEN
        SELECT p.id INTO pid
        FROM public.products p
        WHERE p.profile_id = 102 AND lower(COALESCE(p.sku, '')) = lower(sku)
        LIMIT 1;
      END IF;
      unit := NULL;
      accepted := NULL;
      cost := NULL;
      IF pid IS NOT NULL AND pid > 0 THEN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'party_catalogue_lines'
        ) THEN
          SELECT l.accepted_price INTO accepted
          FROM public.party_catalogue_lines l
          WHERE l.profile_id = 102
            AND l.party_kind = 'supplier'
            AND l.supplier_id = srm
            AND l.product_id = pid
            AND COALESCE(l.status, 'active') = 'active'
          ORDER BY l.id
          LIMIT 1;
        END IF;
        SELECT p.cost_price INTO cost
        FROM public.products p
        WHERE p.profile_id = 102 AND p.id = pid;
        IF cost IS NOT NULL THEN
          unit := cost;
        ELSIF accepted IS NOT NULL THEN
          unit := accepted;
        END IF;
      END IF;
      qty := COALESCE(
        NULLIF(item->>'quantity', '')::numeric,
        NULLIF(item->>'qty', '')::numeric,
        0
      );
      IF unit IS NULL THEN
        BEGIN
          unit := COALESCE(NULLIF(item->>'unit_price', '')::numeric, 0);
        EXCEPTION WHEN others THEN
          unit := 0;
        END;
      END IF;
      line_total := round((qty * unit)::numeric, 4);
      total := total + line_total;
      IF pid IS NOT NULL AND pid > 0 THEN
        item := item || jsonb_build_object(
          'product_id', pid,
          'unit_price', unit,
          'line_total', line_total
        );
      ELSE
        item := item || jsonb_build_object(
          'unit_price', unit,
          'line_total', line_total
        );
      END IF;
      new_items := new_items || jsonb_build_array(item);
    END LOOP;

    BEGIN
      UPDATE public.purchase_orders
      SET items = new_items,
          total_amount = total,
          subtotal = total,
          updated_at = now()
      WHERE id = r.id AND buyer_profile_id = 102;
    EXCEPTION WHEN others THEN
      UPDATE public.purchase_orders
      SET items = new_items,
          total_amount = total,
          updated_at = now()
      WHERE id = r.id AND buyer_profile_id = 102;
    END;
  END LOOP;
END $$;
