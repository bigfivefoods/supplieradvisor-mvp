-- Align production document URL columns with app field names.
-- Production historically used registration_document_url / import_document_url /
-- export_document_url. App writes *_certificate_url / *_license_url.
-- We ADD the missing app columns when possible AND keep legacy names via dual-write in code.

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

-- App-preferred names (may already exist via earlier migration)
SELECT public.sa_add_column('profiles', 'registration_certificate_url', 'text');
SELECT public.sa_add_column('profiles', 'import_license_url', 'text');
SELECT public.sa_add_column('profiles', 'export_license_url', 'text');
SELECT public.sa_add_column('profiles', 'export_licenses', 'jsonb', '''[]''::jsonb');

-- Legacy production names (ensure present)
SELECT public.sa_add_column('profiles', 'registration_document_url', 'text');
SELECT public.sa_add_column('profiles', 'vat_document_url', 'text');
SELECT public.sa_add_column('profiles', 'import_document_url', 'text');
SELECT public.sa_add_column('profiles', 'export_document_url', 'text');
SELECT public.sa_add_column('profiles', 'tax_document_url', 'text');
SELECT public.sa_add_column('profiles', 'bee_certificate_url', 'text');
SELECT public.sa_add_column('profiles', 'bank_confirmation_url', 'text');
SELECT public.sa_add_column('profiles', 'vat_certificate_url', 'text');
SELECT public.sa_add_column('profiles', 'logo_url', 'text');
SELECT public.sa_add_column('profiles', 'uploaded_certificates', 'jsonb', '''[]''::jsonb');

-- Backfill app columns from legacy when app column empty
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='registration_certificate_url'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='registration_document_url'
  ) THEN
    UPDATE public.profiles
    SET registration_certificate_url = registration_document_url
    WHERE registration_certificate_url IS NULL
      AND registration_document_url IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='import_license_url'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='import_document_url'
  ) THEN
    UPDATE public.profiles
    SET import_license_url = import_document_url
    WHERE import_license_url IS NULL AND import_document_url IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='export_license_url'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='export_document_url'
  ) THEN
    UPDATE public.profiles
    SET export_license_url = export_document_url
    WHERE export_license_url IS NULL AND export_document_url IS NOT NULL;
  END IF;
END $$;

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name IN (
    'registration_certificate_url', 'registration_document_url',
    'import_license_url', 'import_document_url',
    'export_license_url', 'export_document_url',
    'vat_certificate_url', 'vat_document_url',
    'bee_certificate_url', 'bank_confirmation_url', 'logo_url',
    'uploaded_certificates', 'export_licenses'
  )
ORDER BY 1;
