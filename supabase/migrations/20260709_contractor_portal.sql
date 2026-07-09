-- Independent contractor invitations + portal identity
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

CREATE OR REPLACE FUNCTION public.sa_create_index(p_name text, p_table text, p_column text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = p_column
  ) THEN
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)',
      p_name, p_table, p_column
    );
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sa_create_index % skip: %', p_name, SQLERRM;
END;
$$;

-- ---------------------------------------------------------------------------
-- Ensure parent tables exist (minimal)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.containers (
  id bigserial PRIMARY KEY,
  container_code text,
  name text,
  status text DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('containers', 'profile_id', 'bigint');
SELECT public.sa_add_column('containers', 'contractor_id', 'bigint');
SELECT public.sa_add_column('containers', 'assigned_contractor', 'text');

CREATE TABLE IF NOT EXISTS public.container_contractors (
  id bigserial PRIMARY KEY,
  full_name text NOT NULL DEFAULT 'Contractor',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('container_contractors', 'profile_id', 'bigint');
SELECT public.sa_add_column('container_contractors', 'full_name', 'text', '''Contractor''');
SELECT public.sa_add_column('container_contractors', 'email', 'text');
SELECT public.sa_add_column('container_contractors', 'phone', 'text');
SELECT public.sa_add_column('container_contractors', 'id_number', 'text');
SELECT public.sa_add_column('container_contractors', 'status', 'text', '''active''');
SELECT public.sa_add_column('container_contractors', 'training_status', 'text', '''pending''');
SELECT public.sa_add_column('container_contractors', 'bank_details', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('container_contractors', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('container_contractors', 'user_id', 'text');
SELECT public.sa_add_column('container_contractors', 'invite_token', 'text');
SELECT public.sa_add_column('container_contractors', 'invited_at', 'timestamptz');
SELECT public.sa_add_column('container_contractors', 'contract_accepted_at', 'timestamptz');
SELECT public.sa_add_column('container_contractors', 'contract_version', 'text');
SELECT public.sa_add_column('container_contractors', 'portal_status', 'text', '''draft''');
SELECT public.sa_add_column('container_contractors', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('container_contractors', 'updated_at', 'timestamptz', 'now()');

SELECT public.sa_create_index('idx_container_contractors_user', 'container_contractors', 'user_id');
SELECT public.sa_create_index('idx_container_contractors_email', 'container_contractors', 'email');
SELECT public.sa_create_index('idx_container_contractors_invite', 'container_contractors', 'invite_token');
SELECT public.sa_create_index('idx_container_contractors_profile', 'container_contractors', 'profile_id');

-- ---------------------------------------------------------------------------
-- contractor_invites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contractor_invites (
  id bigserial PRIMARY KEY,
  token text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  contract_version text NOT NULL DEFAULT 'IC-2026.1',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('contractor_invites', 'token', 'text');
SELECT public.sa_add_column('contractor_invites', 'profile_id', 'bigint');
SELECT public.sa_add_column('contractor_invites', 'container_id', 'bigint');
SELECT public.sa_add_column('contractor_invites', 'contractor_id', 'bigint');
SELECT public.sa_add_column('contractor_invites', 'email', 'text');
SELECT public.sa_add_column('contractor_invites', 'full_name', 'text');
SELECT public.sa_add_column('contractor_invites', 'status', 'text', '''pending''');
SELECT public.sa_add_column('contractor_invites', 'contract_version', 'text', '''IC-2026.1''');
SELECT public.sa_add_column('contractor_invites', 'contract_accepted_at', 'timestamptz');
SELECT public.sa_add_column('contractor_invites', 'user_id', 'text');
SELECT public.sa_add_column('contractor_invites', 'invited_by', 'text');
SELECT public.sa_add_column('contractor_invites', 'company_name', 'text');
SELECT public.sa_add_column('contractor_invites', 'container_name', 'text');
SELECT public.sa_add_column('contractor_invites', 'expires_at', 'timestamptz', '(now() + interval ''14 days'')');
SELECT public.sa_add_column('contractor_invites', 'accepted_at', 'timestamptz');
SELECT public.sa_add_column('contractor_invites', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('contractor_invites', 'updated_at', 'timestamptz', 'now()');

-- Unique token if possible
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contractor_invites' AND column_name = 'token'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contractor_invites_token_key'
  ) THEN
    ALTER TABLE public.contractor_invites ADD CONSTRAINT contractor_invites_token_key UNIQUE (token);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'contractor_invites token unique skip: %', SQLERRM;
END $$;

SELECT public.sa_create_index('idx_contractor_invites_token', 'contractor_invites', 'token');
SELECT public.sa_create_index('idx_contractor_invites_email', 'contractor_invites', 'email');
SELECT public.sa_create_index('idx_contractor_invites_status', 'contractor_invites', 'status');

-- ---------------------------------------------------------------------------
-- container_sales extras
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.container_sales (
  id bigserial PRIMARY KEY,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  gross_amount numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('container_sales', 'profile_id', 'bigint');
SELECT public.sa_add_column('container_sales', 'container_id', 'bigint');
SELECT public.sa_add_column('container_sales', 'contractor_id', 'bigint');
SELECT public.sa_add_column('container_sales', 'net_amount', 'numeric(18,2)', '0');
SELECT public.sa_add_column('container_sales', 'currency', 'text', '''ZAR''');
SELECT public.sa_add_column('container_sales', 'payment_method', 'text');
SELECT public.sa_add_column('container_sales', 'notes', 'text');
SELECT public.sa_add_column('container_sales', 'items', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('container_sales', 'created_by', 'text');

-- ---------------------------------------------------------------------------
-- container_stock_counts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.container_stock_counts (
  id bigserial PRIMARY KEY,
  container_id bigint,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  counted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('container_stock_counts', 'profile_id', 'bigint');
SELECT public.sa_add_column('container_stock_counts', 'container_id', 'bigint');
SELECT public.sa_add_column('container_stock_counts', 'contractor_id', 'bigint');
SELECT public.sa_add_column('container_stock_counts', 'user_id', 'text');
SELECT public.sa_add_column('container_stock_counts', 'lines', 'jsonb', '''[]''::jsonb');
SELECT public.sa_add_column('container_stock_counts', 'notes', 'text');
SELECT public.sa_add_column('container_stock_counts', 'counted_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('container_stock_counts', 'created_at', 'timestamptz', 'now()');

SELECT public.sa_create_index('idx_stock_counts_container', 'container_stock_counts', 'container_id');

-- Optional FKs (never fail the script)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='containers' AND column_name='contractor_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='container_contractors'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'containers_contractor_id_fkey'
  ) THEN
    ALTER TABLE public.containers
      ADD CONSTRAINT containers_contractor_id_fkey
      FOREIGN KEY (contractor_id) REFERENCES public.container_contractors(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'containers contractor FK skip: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.contractor_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_stock_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contractor_invites_all ON public.contractor_invites;
CREATE POLICY contractor_invites_all ON public.contractor_invites
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS container_stock_counts_all ON public.container_stock_counts;
CREATE POLICY container_stock_counts_all ON public.container_stock_counts
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'container_contractors',
    'contractor_invites',
    'container_stock_counts',
    'container_sales',
    'containers'
  )
  AND column_name IN (
    'profile_id', 'user_id', 'portal_status', 'contract_accepted_at',
    'contractor_id', 'token', 'email', 'items', 'lines'
  )
ORDER BY table_name, column_name;
