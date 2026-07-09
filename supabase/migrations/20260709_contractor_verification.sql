-- Contractor VerifyNow identity verification + ID document attachment
-- Safe / idempotent for Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.sa_add_column(p_table text, p_column text, p_type text, p_default text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
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
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN %I %s DEFAULT %s',
        p_table, p_column, p_type, p_default
      );
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sa_add_column %.% skip: %', p_table, p_column, SQLERRM;
END;
$$;

CREATE TABLE IF NOT EXISTS public.container_contractors (
  id bigserial PRIMARY KEY,
  full_name text NOT NULL DEFAULT 'Contractor',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('container_contractors', 'id_number', 'text');
SELECT public.sa_add_column('container_contractors', 'id_document_url', 'text');
SELECT public.sa_add_column('container_contractors', 'id_document_name', 'text');
SELECT public.sa_add_column('container_contractors', 'id_document_uploaded_at', 'timestamptz');
SELECT public.sa_add_column('container_contractors', 'verification_status', 'text', '''unverified''');
-- unverified | pending | verified | failed | mismatch
SELECT public.sa_add_column('container_contractors', 'verified_at', 'timestamptz');
SELECT public.sa_add_column('container_contractors', 'verification_provider', 'text');
SELECT public.sa_add_column('container_contractors', 'verification_reference', 'text');
SELECT public.sa_add_column('container_contractors', 'verification_data', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('container_contractors', 'verified_first_names', 'text');
SELECT public.sa_add_column('container_contractors', 'verified_last_name', 'text');
SELECT public.sa_add_column('container_contractors', 'verified_dob', 'text');
SELECT public.sa_add_column('container_contractors', 'consent_identity_check', 'boolean', 'false');
SELECT public.sa_add_column('container_contractors', 'consent_identity_at', 'timestamptz');

-- Verification audit log (optional history of checks)
CREATE TABLE IF NOT EXISTS public.contractor_verifications (
  id bigserial PRIMARY KEY,
  contractor_id bigint,
  profile_id bigint,
  id_number text,
  provider text NOT NULL DEFAULT 'verifynow',
  report_type text,
  status text NOT NULL DEFAULT 'pending',
  request_id text,
  mode text,
  result jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('contractor_verifications', 'contractor_id', 'bigint');
SELECT public.sa_add_column('contractor_verifications', 'profile_id', 'bigint');
SELECT public.sa_add_column('contractor_verifications', 'id_number', 'text');
SELECT public.sa_add_column('contractor_verifications', 'provider', 'text', '''verifynow''');
SELECT public.sa_add_column('contractor_verifications', 'report_type', 'text');
SELECT public.sa_add_column('contractor_verifications', 'status', 'text', '''pending''');
SELECT public.sa_add_column('contractor_verifications', 'request_id', 'text');
SELECT public.sa_add_column('contractor_verifications', 'mode', 'text');
SELECT public.sa_add_column('contractor_verifications', 'result', 'jsonb', '''{}''::jsonb');

ALTER TABLE public.contractor_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contractor_verifications_all ON public.contractor_verifications;
CREATE POLICY contractor_verifications_all ON public.contractor_verifications
  FOR ALL USING (true) WITH CHECK (true);

SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'container_contractors'
  AND column_name IN (
    'id_number', 'id_document_url', 'verification_status',
    'verified_at', 'verification_data', 'consent_identity_check'
  )
ORDER BY column_name;
