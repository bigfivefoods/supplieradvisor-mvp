-- =============================================================================
-- World-class Supplier SRM (company-scoped)
-- Buyer book of suppliers + invite lifecycle + shared vault + scorecard helpers
-- =============================================================================

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

-- ── Buyer-scoped supplier master (your supplier book) ────────────────────────
CREATE TABLE IF NOT EXISTS public.srm_suppliers (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL, -- buyer / company workspace
  trading_name text NOT NULL DEFAULT 'Supplier',
  legal_name text,
  email text,
  phone text,
  contact_name text,
  job_title text,
  website text,
  industry text,
  sub_industry text,
  category text,
  city text,
  region text,
  province text,
  country text DEFAULT 'South Africa',
  continent text,
  address text,
  postal_code text,
  status text NOT NULL DEFAULT 'prospect', -- prospect | preferred | active | blocked | archived
  invite_status text NOT NULL DEFAULT 'not_invited',
  -- not_invited | invited | accepted | suspended | declined | expired
  invite_token text,
  invited_at timestamptz,
  invite_accepted_at timestamptz,
  invited_email text,
  linked_profile_id bigint, -- platform company profile after claim
  connection_id bigint,     -- business_connections edge
  wallet_address text,
  certifications text[] DEFAULT '{}',
  bee_level text,
  verified boolean DEFAULT false,
  trust_score numeric(6,2) DEFAULT 0,
  otifef_pct numeric(6,2) DEFAULT 0,
  rating_avg numeric(4,2) DEFAULT 0,
  rating_count int DEFAULT 0,
  owner_name text,
  notes text,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}'::jsonb,
  onchain_tx text,
  onchain_registered_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('srm_suppliers', 'profile_id', 'bigint');
SELECT public.sa_add_column('srm_suppliers', 'trading_name', 'text', '''Supplier''');
SELECT public.sa_add_column('srm_suppliers', 'legal_name', 'text');
SELECT public.sa_add_column('srm_suppliers', 'email', 'text');
SELECT public.sa_add_column('srm_suppliers', 'phone', 'text');
SELECT public.sa_add_column('srm_suppliers', 'contact_name', 'text');
SELECT public.sa_add_column('srm_suppliers', 'job_title', 'text');
SELECT public.sa_add_column('srm_suppliers', 'website', 'text');
SELECT public.sa_add_column('srm_suppliers', 'industry', 'text');
SELECT public.sa_add_column('srm_suppliers', 'sub_industry', 'text');
SELECT public.sa_add_column('srm_suppliers', 'category', 'text');
SELECT public.sa_add_column('srm_suppliers', 'city', 'text');
SELECT public.sa_add_column('srm_suppliers', 'region', 'text');
SELECT public.sa_add_column('srm_suppliers', 'province', 'text');
SELECT public.sa_add_column('srm_suppliers', 'country', 'text', '''South Africa''');
SELECT public.sa_add_column('srm_suppliers', 'continent', 'text');
SELECT public.sa_add_column('srm_suppliers', 'address', 'text');
SELECT public.sa_add_column('srm_suppliers', 'postal_code', 'text');
SELECT public.sa_add_column('srm_suppliers', 'status', 'text', '''prospect''');
SELECT public.sa_add_column('srm_suppliers', 'invite_status', 'text', '''not_invited''');
SELECT public.sa_add_column('srm_suppliers', 'invite_token', 'text');
SELECT public.sa_add_column('srm_suppliers', 'invited_at', 'timestamptz');
SELECT public.sa_add_column('srm_suppliers', 'invite_accepted_at', 'timestamptz');
SELECT public.sa_add_column('srm_suppliers', 'invited_email', 'text');
SELECT public.sa_add_column('srm_suppliers', 'linked_profile_id', 'bigint');
SELECT public.sa_add_column('srm_suppliers', 'connection_id', 'bigint');
SELECT public.sa_add_column('srm_suppliers', 'wallet_address', 'text');
SELECT public.sa_add_column('srm_suppliers', 'certifications', 'text[]', '''{}''');
SELECT public.sa_add_column('srm_suppliers', 'bee_level', 'text');
SELECT public.sa_add_column('srm_suppliers', 'verified', 'boolean', 'false');
SELECT public.sa_add_column('srm_suppliers', 'trust_score', 'numeric(6,2)', '0');
SELECT public.sa_add_column('srm_suppliers', 'otifef_pct', 'numeric(6,2)', '0');
SELECT public.sa_add_column('srm_suppliers', 'rating_avg', 'numeric(4,2)', '0');
SELECT public.sa_add_column('srm_suppliers', 'rating_count', 'int', '0');
SELECT public.sa_add_column('srm_suppliers', 'owner_name', 'text');
SELECT public.sa_add_column('srm_suppliers', 'notes', 'text');
SELECT public.sa_add_column('srm_suppliers', 'tags', 'text[]', '''{}''');
SELECT public.sa_add_column('srm_suppliers', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('srm_suppliers', 'onchain_tx', 'text');
SELECT public.sa_add_column('srm_suppliers', 'onchain_registered_at', 'timestamptz');
SELECT public.sa_add_column('srm_suppliers', 'created_by', 'text');

-- One linked platform company per buyer book
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_srm_suppliers_profile_linked'
  ) THEN
    CREATE UNIQUE INDEX uq_srm_suppliers_profile_linked
      ON public.srm_suppliers (profile_id, linked_profile_id)
      WHERE linked_profile_id IS NOT NULL;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'uq_srm_suppliers_profile_linked: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_srm_suppliers_profile ON public.srm_suppliers(profile_id);
CREATE INDEX IF NOT EXISTS idx_srm_suppliers_status ON public.srm_suppliers(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_srm_suppliers_invite ON public.srm_suppliers(profile_id, invite_status);
CREATE INDEX IF NOT EXISTS idx_srm_suppliers_industry ON public.srm_suppliers(industry);
CREATE INDEX IF NOT EXISTS idx_srm_suppliers_country ON public.srm_suppliers(country);

-- ── Supplier invitations (platform invite attempts) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_invitations (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL, -- buyer company inviting
  supplier_id bigint,         -- srm_suppliers row
  email text NOT NULL,
  full_name text,
  company_name text,
  message text,
  token text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  -- pending | claiming | accepted | declined | expired | revoked
  target_profile_id bigint,
  invited_by text,
  invited_by_user_id text,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('supplier_invitations', 'profile_id', 'bigint');
SELECT public.sa_add_column('supplier_invitations', 'supplier_id', 'bigint');
SELECT public.sa_add_column('supplier_invitations', 'email', 'text');
SELECT public.sa_add_column('supplier_invitations', 'full_name', 'text');
SELECT public.sa_add_column('supplier_invitations', 'company_name', 'text');
SELECT public.sa_add_column('supplier_invitations', 'message', 'text');
SELECT public.sa_add_column('supplier_invitations', 'token', 'text');
SELECT public.sa_add_column('supplier_invitations', 'status', 'text', '''pending''');
SELECT public.sa_add_column('supplier_invitations', 'target_profile_id', 'bigint');
SELECT public.sa_add_column('supplier_invitations', 'invited_by', 'text');
SELECT public.sa_add_column('supplier_invitations', 'invited_by_user_id', 'text');
SELECT public.sa_add_column('supplier_invitations', 'expires_at', 'timestamptz');
SELECT public.sa_add_column('supplier_invitations', 'accepted_at', 'timestamptz');
-- If the table pre-existed without timestamps, CREATE IF NOT EXISTS skips them —
-- always ensure created_at / updated_at for rate limits + list ordering.
SELECT public.sa_add_column('supplier_invitations', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('supplier_invitations', 'updated_at', 'timestamptz', 'now()');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_supplier_invitations_token'
  ) THEN
    CREATE UNIQUE INDEX uq_supplier_invitations_token ON public.supplier_invitations(token);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'uq_supplier_invitations_token: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_supplier_invitations_profile ON public.supplier_invitations(profile_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invitations_status ON public.supplier_invitations(status);
CREATE INDEX IF NOT EXISTS idx_supplier_invitations_supplier ON public.supplier_invitations(supplier_id);

-- ── Shared document vault (buyer ↔ connected supplier) ───────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_documents (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL, -- owner (usually buyer)
  supplier_id bigint,         -- srm_suppliers id
  supplier_profile_id bigint, -- linked platform profile when known
  title text NOT NULL,
  doc_type text DEFAULT 'other', -- contract | cert | sla | nda | spec | other
  description text,
  file_url text,
  storage_path text,
  visibility text NOT NULL DEFAULT 'private', -- private | shared
  shared_at timestamptz,
  version int DEFAULT 1,
  content_hash text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('supplier_documents', 'profile_id', 'bigint');
SELECT public.sa_add_column('supplier_documents', 'supplier_id', 'bigint');
SELECT public.sa_add_column('supplier_documents', 'supplier_profile_id', 'bigint');
SELECT public.sa_add_column('supplier_documents', 'title', 'text');
SELECT public.sa_add_column('supplier_documents', 'doc_type', 'text', '''other''');
SELECT public.sa_add_column('supplier_documents', 'description', 'text');
SELECT public.sa_add_column('supplier_documents', 'file_url', 'text');
SELECT public.sa_add_column('supplier_documents', 'storage_path', 'text');
SELECT public.sa_add_column('supplier_documents', 'visibility', 'text', '''private''');
SELECT public.sa_add_column('supplier_documents', 'shared_at', 'timestamptz');
SELECT public.sa_add_column('supplier_documents', 'version', 'int', '1');
SELECT public.sa_add_column('supplier_documents', 'content_hash', 'text');
SELECT public.sa_add_column('supplier_documents', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('supplier_documents', 'created_by', 'text');

CREATE INDEX IF NOT EXISTS idx_supplier_documents_profile ON public.supplier_documents(profile_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier ON public.supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_shared
  ON public.supplier_documents(supplier_profile_id)
  WHERE visibility = 'shared';

-- ── Scorecard enrichment ────────────────────────────────────────────────────
SELECT public.sa_add_column('supplier_scorecards', 'srm_supplier_id', 'bigint');
SELECT public.sa_add_column('supplier_scorecards', 'rating_avg', 'numeric(4,2)', '0');
SELECT public.sa_add_column('supplier_scorecards', 'rating_count', 'int', '0');

-- ── Platform discover index helpers on profiles ──────────────────────────────
SELECT public.sa_add_column('profiles', 'continent', 'text');
SELECT public.sa_add_column('profiles', 'province', 'text');
SELECT public.sa_add_column('profiles', 'sub_industry', 'text');
SELECT public.sa_add_column('profiles', 'certifications', 'text[]', '''{}''');
SELECT public.sa_add_column('profiles', 'trust_score', 'numeric(6,2)', '0');
SELECT public.sa_add_column('profiles', 'otifef_average', 'numeric(6,2)', '0');
SELECT public.sa_add_column('profiles', 'bee_level', 'text');
SELECT public.sa_add_column('profiles', 'is_discoverable', 'boolean', 'true');

CREATE INDEX IF NOT EXISTS idx_profiles_discover_industry ON public.profiles(industry)
  WHERE relationship_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_discover_country ON public.profiles(country);

ALTER TABLE public.srm_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS srm_suppliers_all ON public.srm_suppliers;
CREATE POLICY srm_suppliers_all ON public.srm_suppliers FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS supplier_invitations_all ON public.supplier_invitations;
CREATE POLICY supplier_invitations_all ON public.supplier_invitations FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS supplier_documents_all ON public.supplier_documents;
CREATE POLICY supplier_documents_all ON public.supplier_documents FOR ALL USING (true) WITH CHECK (true);

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('srm_suppliers', 'supplier_invitations', 'supplier_documents', 'supplier_scorecards')
ORDER BY 1;
