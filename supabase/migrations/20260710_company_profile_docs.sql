-- Company profile document URLs, geo pin, multi-industry, structured certs & export licenses
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

SELECT public.sa_add_column('profiles', 'registration_certificate_url', 'text');
SELECT public.sa_add_column('profiles', 'vat_certificate_url', 'text');
SELECT public.sa_add_column('profiles', 'bee_certificate_url', 'text');
SELECT public.sa_add_column('profiles', 'bank_confirmation_url', 'text');
SELECT public.sa_add_column('profiles', 'import_license_url', 'text');
SELECT public.sa_add_column('profiles', 'export_license_url', 'text');
SELECT public.sa_add_column('profiles', 'export_license_number', 'text');
SELECT public.sa_add_column('profiles', 'import_license_number', 'text');
SELECT public.sa_add_column('profiles', 'director_id_number', 'text');
SELECT public.sa_add_column('profiles', 'bee_level', 'text');
SELECT public.sa_add_column('profiles', 'sub_industry', 'text');
SELECT public.sa_add_column('profiles', 'sub_industries', 'text[]');
SELECT public.sa_add_column('profiles', 'export_licenses', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('profiles', 'uploaded_certificates', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('profiles', 'latitude', 'double precision');
SELECT public.sa_add_column('profiles', 'longitude', 'double precision');
SELECT public.sa_add_column('profiles', 'lat', 'double precision');
SELECT public.sa_add_column('profiles', 'lng', 'double precision');
SELECT public.sa_add_column('profiles', 'verification_payment_ref', 'text');
SELECT public.sa_add_column('profiles', 'wallet_address', 'text');
SELECT public.sa_add_column('profiles', 'logo_url', 'text');
SELECT public.sa_add_column('profiles', 'continent', 'text');
SELECT public.sa_add_column('profiles', 'province', 'text');
SELECT public.sa_add_column('profiles', 'region', 'text');
SELECT public.sa_add_column('profiles', 'postal_code', 'text');
SELECT public.sa_add_column('profiles', 'bank_name', 'text');
SELECT public.sa_add_column('profiles', 'account_name', 'text');
SELECT public.sa_add_column('profiles', 'account_number', 'text');
SELECT public.sa_add_column('profiles', 'iban', 'text');
SELECT public.sa_add_column('profiles', 'swift', 'text');

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name IN (
    'registration_certificate_url', 'export_licenses', 'uploaded_certificates',
    'latitude', 'longitude', 'sub_industries', 'verification_payment_ref'
  )
ORDER BY 1;
