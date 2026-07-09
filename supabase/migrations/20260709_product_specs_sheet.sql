-- Product image already has primary_image_url; add specifications sheet columns
-- Safe / idempotent for Supabase SQL Editor

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'specs_sheet_url'
    ) THEN
      ALTER TABLE public.products ADD COLUMN specs_sheet_url text;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'specs_sheet_name'
    ) THEN
      ALTER TABLE public.products ADD COLUMN specs_sheet_name text;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'primary_image_url'
    ) THEN
      ALTER TABLE public.products ADD COLUMN primary_image_url text;
    END IF;
  END IF;
END $$;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
  AND column_name IN ('primary_image_url', 'specs_sheet_url', 'specs_sheet_name')
ORDER BY column_name;
