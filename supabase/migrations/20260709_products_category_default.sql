-- Fix products.category NOT NULL without default (breaks product create)
-- Safe / idempotent for Supabase SQL Editor

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'category'
  ) THEN
    UPDATE public.products SET category = 'General' WHERE category IS NULL OR btrim(category) = '';
    ALTER TABLE public.products ALTER COLUMN category SET DEFAULT 'General';
    -- Keep NOT NULL if desired, but ensure no nulls remain
    BEGIN
      ALTER TABLE public.products ALTER COLUMN category SET NOT NULL;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'category SET NOT NULL skip: %', SQLERRM;
    END;
  END IF;
END $$;

SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'category';
