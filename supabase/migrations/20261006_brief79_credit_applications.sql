-- Brief 79: Customer credit applications (customer portal + supplier review desk)
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.sa_add_column(p_table text, p_column text, p_type text, p_default text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = p_column
  ) THEN
    RETURN;
  END IF;

  IF p_default IS NULL THEN
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', p_table, p_column, p_type);
  ELSE
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s DEFAULT %s', p_table, p_column, p_type, p_default);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sa_add_column %.% skip: %', p_table, p_column, SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.sa_create_index(p_name text, p_table text, p_columns text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)', p_name, p_table, p_columns);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sa_create_index % on % skip: %', p_name, p_table, SQLERRM;
END;
$$;

CREATE TABLE IF NOT EXISTS public.credit_applications (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id bigint NOT NULL,
  viewer_id bigint NULL REFERENCES public.trade_portal_viewers(id) ON DELETE SET NULL,
  applicant_profile_id bigint NULL,
  reference text,
  country_code text NOT NULL DEFAULT 'ZA',
  form_version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','under_review','more_info_needed','approved','declined')),
  business jsonb NOT NULL DEFAULT '{}'::jsonb,
  addresses jsonb NOT NULL DEFAULT '{}'::jsonb,
  contacts jsonb NOT NULL DEFAULT '{}'::jsonb,
  trade_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  bank jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_limit numeric(18,2),
  requested_terms text,
  currency text DEFAULT 'ZAR',
  approved_limit numeric(18,2),
  approved_terms text,
  review_date date,
  decision_reason text,
  info_request text,
  info_response text,
  popia_consent_at timestamptz,
  credit_check_consent_at timestamptz,
  terms_accepted_at timestamptz,
  terms_version text,
  terms_sha256 text,
  signature jsonb,
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_credit_applications_reference'
  ) THEN
    ALTER TABLE public.credit_applications
      ADD CONSTRAINT uq_credit_applications_reference UNIQUE (reference);
  END IF;
END $$;

SELECT public.sa_add_column('credit_applications', 'profile_id', 'bigint');
SELECT public.sa_add_column('credit_applications', 'customer_id', 'bigint');
SELECT public.sa_add_column('credit_applications', 'viewer_id', 'bigint');
SELECT public.sa_add_column('credit_applications', 'applicant_profile_id', 'bigint');
SELECT public.sa_add_column('credit_applications', 'reference', 'text');
SELECT public.sa_add_column('credit_applications', 'country_code', 'text', '''ZA''');
SELECT public.sa_add_column('credit_applications', 'form_version', 'int', '1');
SELECT public.sa_add_column('credit_applications', 'status', 'text', '''draft''');
SELECT public.sa_add_column('credit_applications', 'business', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('credit_applications', 'addresses', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('credit_applications', 'contacts', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('credit_applications', 'trade_references', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('credit_applications', 'bank', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('credit_applications', 'requested_limit', 'numeric(18,2)');
SELECT public.sa_add_column('credit_applications', 'requested_terms', 'text');
SELECT public.sa_add_column('credit_applications', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('credit_applications', 'approved_limit', 'numeric(18,2)');
SELECT public.sa_add_column('credit_applications', 'approved_terms', 'text');
SELECT public.sa_add_column('credit_applications', 'review_date', 'date');
SELECT public.sa_add_column('credit_applications', 'decision_reason', 'text');
SELECT public.sa_add_column('credit_applications', 'info_request', 'text');
SELECT public.sa_add_column('credit_applications', 'info_response', 'text');
SELECT public.sa_add_column('credit_applications', 'popia_consent_at', 'timestamptz');
SELECT public.sa_add_column('credit_applications', 'credit_check_consent_at', 'timestamptz');
SELECT public.sa_add_column('credit_applications', 'terms_accepted_at', 'timestamptz');
SELECT public.sa_add_column('credit_applications', 'terms_version', 'text');
SELECT public.sa_add_column('credit_applications', 'terms_sha256', 'text');
SELECT public.sa_add_column('credit_applications', 'signature', 'jsonb');
SELECT public.sa_add_column('credit_applications', 'submitted_at', 'timestamptz');
SELECT public.sa_add_column('credit_applications', 'decided_at', 'timestamptz');
SELECT public.sa_add_column('credit_applications', 'decided_by', 'text');
SELECT public.sa_add_column('credit_applications', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('credit_applications', 'updated_at', 'timestamptz', 'now()');

CREATE TABLE IF NOT EXISTS public.credit_application_principals (
  id bigserial PRIMARY KEY,
  application_id bigint NOT NULL REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name text,
  role text,
  id_type text NOT NULL DEFAULT 'other' CHECK (id_type IN ('sa_id','passport','other')),
  id_number_enc text,
  id_number_last4 text,
  nationality text,
  residential_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  email text,
  phone text,
  shareholding_pct numeric(9,2),
  surety_offered boolean NOT NULL DEFAULT false,
  surety_signature jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('credit_application_principals', 'application_id', 'bigint');
SELECT public.sa_add_column('credit_application_principals', 'profile_id', 'bigint');
SELECT public.sa_add_column('credit_application_principals', 'full_name', 'text');
SELECT public.sa_add_column('credit_application_principals', 'role', 'text');
SELECT public.sa_add_column('credit_application_principals', 'id_type', 'text', '''other''');
SELECT public.sa_add_column('credit_application_principals', 'id_number_enc', 'text');
SELECT public.sa_add_column('credit_application_principals', 'id_number_last4', 'text');
SELECT public.sa_add_column('credit_application_principals', 'nationality', 'text');
SELECT public.sa_add_column('credit_application_principals', 'residential_address', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('credit_application_principals', 'email', 'text');
SELECT public.sa_add_column('credit_application_principals', 'phone', 'text');
SELECT public.sa_add_column('credit_application_principals', 'shareholding_pct', 'numeric(9,2)');
SELECT public.sa_add_column('credit_application_principals', 'surety_offered', 'boolean', 'false');
SELECT public.sa_add_column('credit_application_principals', 'surety_signature', 'jsonb');
SELECT public.sa_add_column('credit_application_principals', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('credit_application_principals', 'updated_at', 'timestamptz', 'now()');

CREATE TABLE IF NOT EXISTS public.credit_application_documents (
  id bigserial PRIMARY KEY,
  application_id bigint NOT NULL REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  principal_id bigint NULL REFERENCES public.credit_application_principals(id) ON DELETE SET NULL,
  doc_type text NOT NULL CHECK (doc_type IN ('cipc_registration','bank_confirmation','vat_certificate','id_copy','financials','surety_deed','other')),
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  uploaded_by_viewer_id bigint,
  uploaded_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('credit_application_documents', 'application_id', 'bigint');
SELECT public.sa_add_column('credit_application_documents', 'profile_id', 'bigint');
SELECT public.sa_add_column('credit_application_documents', 'principal_id', 'bigint');
SELECT public.sa_add_column('credit_application_documents', 'doc_type', 'text');
SELECT public.sa_add_column('credit_application_documents', 'storage_bucket', 'text');
SELECT public.sa_add_column('credit_application_documents', 'storage_path', 'text');
SELECT public.sa_add_column('credit_application_documents', 'file_name', 'text');
SELECT public.sa_add_column('credit_application_documents', 'mime_type', 'text');
SELECT public.sa_add_column('credit_application_documents', 'size_bytes', 'bigint');
SELECT public.sa_add_column('credit_application_documents', 'sha256', 'text');
SELECT public.sa_add_column('credit_application_documents', 'uploaded_by_viewer_id', 'bigint');
SELECT public.sa_add_column('credit_application_documents', 'uploaded_by_user_id', 'text');
SELECT public.sa_add_column('credit_application_documents', 'created_at', 'timestamptz', 'now()');

CREATE TABLE IF NOT EXISTS public.credit_application_events (
  id bigserial PRIMARY KEY,
  application_id bigint NOT NULL REFERENCES public.credit_applications(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_type text NOT NULL CHECK (actor_type IN ('customer','supplier_user','system')),
  actor_id text,
  action text NOT NULL,
  from_status text,
  to_status text,
  note text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('credit_application_events', 'application_id', 'bigint');
SELECT public.sa_add_column('credit_application_events', 'profile_id', 'bigint');
SELECT public.sa_add_column('credit_application_events', 'actor_type', 'text');
SELECT public.sa_add_column('credit_application_events', 'actor_id', 'text');
SELECT public.sa_add_column('credit_application_events', 'action', 'text');
SELECT public.sa_add_column('credit_application_events', 'from_status', 'text');
SELECT public.sa_add_column('credit_application_events', 'to_status', 'text');
SELECT public.sa_add_column('credit_application_events', 'note', 'text');
SELECT public.sa_add_column('credit_application_events', 'ip', 'text');
SELECT public.sa_add_column('credit_application_events', 'created_at', 'timestamptz', 'now()');

SELECT public.sa_create_index('idx_credit_applications_profile_status_updated', 'credit_applications', 'profile_id, status, updated_at DESC');
SELECT public.sa_create_index('idx_credit_applications_profile_customer', 'credit_applications', 'profile_id, customer_id');
SELECT public.sa_create_index('idx_credit_app_principals_application', 'credit_application_principals', 'application_id, profile_id');
SELECT public.sa_create_index('idx_credit_app_documents_application', 'credit_application_documents', 'application_id, profile_id');
SELECT public.sa_create_index('idx_credit_app_events_application', 'credit_application_events', 'application_id, profile_id, created_at DESC');

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_applications_open_per_customer
  ON public.credit_applications (profile_id, customer_id)
  WHERE status IN ('draft','submitted','under_review','more_info_needed');

ALTER TABLE public.credit_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_application_principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_application_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.credit_applications FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.credit_application_principals FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.credit_application_documents FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.credit_application_events FORCE ROW LEVEL SECURITY;
  EXCEPTION WHEN others THEN
    NULL;
  END;
END $$;

DROP POLICY IF EXISTS sa_deny_anon ON public.credit_applications;
DROP POLICY IF EXISTS sa_deny_authenticated ON public.credit_applications;
CREATE POLICY sa_deny_anon ON public.credit_applications
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY sa_deny_authenticated ON public.credit_applications
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS sa_deny_anon ON public.credit_application_principals;
DROP POLICY IF EXISTS sa_deny_authenticated ON public.credit_application_principals;
CREATE POLICY sa_deny_anon ON public.credit_application_principals
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY sa_deny_authenticated ON public.credit_application_principals
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS sa_deny_anon ON public.credit_application_documents;
DROP POLICY IF EXISTS sa_deny_authenticated ON public.credit_application_documents;
CREATE POLICY sa_deny_anon ON public.credit_application_documents
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY sa_deny_authenticated ON public.credit_application_documents
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS sa_deny_anon ON public.credit_application_events;
DROP POLICY IF EXISTS sa_deny_authenticated ON public.credit_application_events;
CREATE POLICY sa_deny_anon ON public.credit_application_events
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY sa_deny_authenticated ON public.credit_application_events
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.credit_applications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.credit_application_principals FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.credit_application_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.credit_application_events FROM PUBLIC, anon, authenticated;

REVOKE UPDATE, DELETE ON TABLE public.credit_application_events FROM anon, authenticated;

GRANT ALL ON TABLE public.credit_applications TO service_role;
GRANT ALL ON TABLE public.credit_application_principals TO service_role;
GRANT ALL ON TABLE public.credit_application_documents TO service_role;
GRANT ALL ON TABLE public.credit_application_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.credit_applications_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.credit_application_principals_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.credit_application_documents_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.credit_application_events_id_seq TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'credit-application-documents',
  'credit-application-documents',
  false,
  10485760,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

NOTIFY pgrst, 'reload schema';
