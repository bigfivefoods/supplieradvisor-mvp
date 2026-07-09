-- Product categories (shared list + per-company custom categories)
-- Safe / idempotent for Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.product_categories (
  id bigserial PRIMARY KEY,
  profile_id bigint, -- NULL = global system defaults available to all companies
  name text NOT NULL,
  description text,
  sort_order int DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure columns if table already existed with fewer fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='product_categories' AND column_name='profile_id'
  ) THEN
    ALTER TABLE public.product_categories ADD COLUMN profile_id bigint;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='product_categories' AND column_name='description'
  ) THEN
    ALTER TABLE public.product_categories ADD COLUMN description text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='product_categories' AND column_name='sort_order'
  ) THEN
    ALTER TABLE public.product_categories ADD COLUMN sort_order int DEFAULT 100;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='product_categories' AND column_name='is_active'
  ) THEN
    ALTER TABLE public.product_categories ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='product_categories' AND column_name='updated_at'
  ) THEN
    ALTER TABLE public.product_categories ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_categories_profile ON public.product_categories(profile_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_name ON public.product_categories(name);

-- Unique name per company (NULL profile_id = global — allow one of each name globally)
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_global_name
  ON public.product_categories (lower(name))
  WHERE profile_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_company_name
  ON public.product_categories (profile_id, lower(name))
  WHERE profile_id IS NOT NULL;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_categories_all ON public.product_categories;
CREATE POLICY product_categories_all ON public.product_categories
  FOR ALL USING (true) WITH CHECK (true);

-- Seed generic categories (only if none exist globally)
INSERT INTO public.product_categories (profile_id, name, description, sort_order, is_active)
SELECT NULL, v.name, v.description, v.sort_order, true
FROM (VALUES
  ('General', 'Default catch-all category', 10),
  ('Raw materials', 'Inputs for production', 20),
  ('Finished goods', 'Sellable finished products', 30),
  ('Packaging', 'Primary and secondary packaging', 40),
  ('Consumables', 'Consumable supplies', 50),
  ('Ingredients', 'Food & beverage ingredients', 60),
  ('Beverages', 'Drinks and liquid products', 70),
  ('Food & grocery', 'Food retail products', 80),
  ('Personal care', 'Hygiene and personal care', 90),
  ('Household', 'Home and household goods', 100),
  ('Electronics', 'Electronic goods & accessories', 110),
  ('Apparel', 'Clothing and soft goods', 120),
  ('Spare parts', 'Maintenance and spare parts', 130),
  ('Tools & equipment', 'Tools and equipment', 140),
  ('Cold chain', 'Temperature-controlled products', 150),
  ('Hazardous / controlled', 'Restricted or hazardous goods', 160),
  ('Services', 'Non-stock service SKUs', 170),
  ('Kits & bundles', 'Multi-item kits', 180),
  ('Returns / seconds', 'Returns and secondary stock', 190),
  ('Other', 'Uncategorised / other', 200)
) AS v(name, description, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_categories c
  WHERE c.profile_id IS NULL AND lower(c.name) = lower(v.name)
);

SELECT id, profile_id, name, sort_order
FROM public.product_categories
WHERE profile_id IS NULL
ORDER BY sort_order, name;
