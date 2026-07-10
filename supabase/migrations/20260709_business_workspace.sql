-- My Business workspace: ensure profiles.settings + completeness fields
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

SELECT public.sa_add_column('profiles', 'settings', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('profiles', 'timezone', 'text', '''Africa/Johannesburg''');
SELECT public.sa_add_column('profiles', 'primary_currency', 'text', '''ZAR''');
SELECT public.sa_add_column('profiles', 'is_buyer', 'boolean', 'true');
SELECT public.sa_add_column('profiles', 'is_discoverable', 'boolean', 'true');
SELECT public.sa_add_column('profiles', 'description', 'text');
SELECT public.sa_add_column('profiles', 'about', 'text');
SELECT public.sa_add_column('profiles', 'logo_url', 'text');
SELECT public.sa_add_column('profiles', 'registration_number', 'text');
SELECT public.sa_add_column('profiles', 'vat_number', 'text');
SELECT public.sa_add_column('profiles', 'tax_number', 'text');
SELECT public.sa_add_column('profiles', 'business_type', 'text');
SELECT public.sa_add_column('profiles', 'updated_at', 'timestamptz', 'now()');

SELECT public.sa_add_column('business_users', 'invited_email', 'text');
SELECT public.sa_add_column('business_users', 'invited_at', 'timestamptz');
SELECT public.sa_add_column('business_users', 'joined_at', 'timestamptz');
SELECT public.sa_add_column('business_users', 'updated_at', 'timestamptz', 'now()');

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name IN ('settings', 'timezone', 'primary_currency', 'is_discoverable')
ORDER BY 1;
