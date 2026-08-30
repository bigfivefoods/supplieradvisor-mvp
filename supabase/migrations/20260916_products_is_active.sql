-- products.is_active — catalogue GET, KPI snapshot, POST/PATCH.
-- Twin paste: RUN_THIS_FOR_PRODUCTS_IS_ACTIVE.sql
-- Safe to re-run. Distinct from products.status and product_categories.is_active.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.products
SET is_active = true
WHERE is_active IS NULL;
