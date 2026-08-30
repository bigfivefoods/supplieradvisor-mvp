-- products.is_active — catalogue, dashboard KPI, POST/PATCH.
-- Paste in the Supabase SQL editor. Safe to re-run.
-- Distinct from products.status and from product_categories.is_active.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.products
SET is_active = true
WHERE is_active IS NULL;
