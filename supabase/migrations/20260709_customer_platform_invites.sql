-- Customer platform invitations + invite_status on customers + BC pair unique
-- Safe / idempotent for Supabase SQL Editor
-- No visibility / po_reviews / PO bridge columns (later PRs)

-- DROP first: CREATE OR REPLACE cannot rename parameters on existing helpers
DROP FUNCTION IF EXISTS public.sa_add_column(text, text, text, text);
DROP FUNCTION IF EXISTS public.sa_add_column(text, text, text);
DROP FUNCTION IF EXISTS public.sa_create_index(text, text, text);
DROP FUNCTION IF EXISTS public.sa_create_index(text, text, text[]);

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

-- Same signature/parameter names as world_class_schema (p_columns, not p_column)
CREATE OR REPLACE FUNCTION public.sa_create_index(
  p_name text, p_table text, p_columns text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  col text;
  cols text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) THEN
    RETURN;
  END IF;

  cols := string_to_array(replace(p_columns, ' ', ''), ',');
  FOREACH col IN ARRAY cols LOOP
    IF col IS NULL OR col = '' THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = p_table AND column_name = col
    ) THEN
      RAISE NOTICE 'Index % skipped: missing %.%', p_name, p_table, col;
      RETURN;
    END IF;
  END LOOP;

  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)', p_name, p_table, p_columns);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Index % skipped: %', p_name, SQLERRM;
END;
$$;

-- ---------------------------------------------------------------------------
-- Ensure parent tables exist (minimal)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id bigserial PRIMARY KEY,
  trading_name text NOT NULL DEFAULT 'Customer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_connections (
  id bigserial PRIMARY KEY,
  status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('business_connections', 'requester_profile_id', 'bigint');
SELECT public.sa_add_column('business_connections', 'requestee_profile_id', 'bigint');
SELECT public.sa_add_column('business_connections', 'status', 'text', '''pending''');
SELECT public.sa_add_column('business_connections', 'connection_type', 'text', '''partner''');
SELECT public.sa_add_column('business_connections', 'notes', 'text');
SELECT public.sa_add_column('business_connections', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('business_connections', 'responded_at', 'timestamptz');
SELECT public.sa_add_column('business_connections', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('business_connections', 'updated_at', 'timestamptz', 'now()');

-- ---------------------------------------------------------------------------
-- Extend customers with invite / platform-link columns
-- ---------------------------------------------------------------------------
SELECT public.sa_add_column('customers', 'profile_id', 'bigint');
SELECT public.sa_add_column('customers', 'linked_profile_id', 'bigint'); -- may already exist
SELECT public.sa_add_column('customers', 'connection_id', 'bigint');
SELECT public.sa_add_column('customers', 'invite_status', 'text', '''not_invited''');
SELECT public.sa_add_column('customers', 'invite_token', 'text');
SELECT public.sa_add_column('customers', 'invited_at', 'timestamptz');
SELECT public.sa_add_column('customers', 'invite_accepted_at', 'timestamptz');
SELECT public.sa_add_column('customers', 'invited_email', 'text');

-- Backfill invite_status for existing rows where column was just added with DEFAULT
UPDATE public.customers
SET invite_status = 'not_invited'
WHERE invite_status IS NULL;

-- Indexes created independently so one failure does not skip the others
SELECT public.sa_create_index('idx_customers_linked_profile', 'customers', 'linked_profile_id');
SELECT public.sa_create_index('idx_customers_invite_status', 'customers', 'invite_status');

-- 1:1 linked buyer per seller CRM scope (partial unique; not via sa_create_index)
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_profile_linked
    ON public.customers(profile_id, linked_profile_id)
    WHERE linked_profile_id IS NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'uq_customers_profile_linked skip: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- business_connections: one-time duplicate cleanup + pair unique (UPSERT target)
-- Cleanup is destructive: non-survivor rows for a pair are permanently deleted.
-- Keep preference: status=accepted, then newest updated_at/created_at, then highest id.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  deleted_count int := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'business_connections'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_connections'
      AND column_name = 'requester_profile_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_connections'
      AND column_name = 'requestee_profile_id'
  ) THEN
    DELETE FROM public.business_connections a
    USING (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY requester_profile_id, requestee_profile_id
          ORDER BY
            CASE WHEN status = 'accepted' THEN 0 ELSE 1 END,
            COALESCE(updated_at, created_at, 'epoch'::timestamptz) DESC,
            id DESC
        ) AS rn
      FROM public.business_connections
      WHERE requester_profile_id IS NOT NULL
        AND requestee_profile_id IS NOT NULL
    ) ranked
    WHERE a.id = ranked.id
      AND ranked.rn > 1;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE
      'business_connections duplicate cleanup removed % row(s) (kept accepted > newest > highest id per pair)',
      deleted_count;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'bc duplicate cleanup skip: %', SQLERRM;
END $$;

-- Unique pair index is required for claim UPSERT — fail loud if it cannot be created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'business_connections'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_connections'
      AND column_name = 'requester_profile_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_connections'
      AND column_name = 'requestee_profile_id'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_bc_requester_requestee
      ON public.business_connections (requester_profile_id, requestee_profile_id);
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION
      'uq_bc_requester_requestee failed: residual duplicates remain after cleanup. %',
      SQLERRM;
  WHEN others THEN
    RAISE EXCEPTION 'uq_bc_requester_requestee create failed: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'business_connections'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_connections'
      AND column_name = 'requester_profile_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_connections'
      AND column_name = 'requestee_profile_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uq_bc_requester_requestee'
  ) THEN
    RAISE EXCEPTION
      'Required unique index uq_bc_requester_requestee was not created on business_connections (claim UPSERT depends on it)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- customer_invitations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_invitations (
  id bigserial PRIMARY KEY,
  token text NOT NULL,
  profile_id bigint NOT NULL,
  customer_id bigint NOT NULL,
  email text NOT NULL,
  full_name text,
  status text NOT NULL DEFAULT 'pending',
  -- pending | claiming | accepted | declined | expired | revoked
  invited_by text,
  company_name text,
  customer_name text,
  target_profile_id bigint,
  message text,
  user_id text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

SELECT public.sa_add_column('customer_invitations', 'token', 'text');
SELECT public.sa_add_column('customer_invitations', 'profile_id', 'bigint');
SELECT public.sa_add_column('customer_invitations', 'customer_id', 'bigint');
SELECT public.sa_add_column('customer_invitations', 'email', 'text');
SELECT public.sa_add_column('customer_invitations', 'full_name', 'text');
SELECT public.sa_add_column('customer_invitations', 'status', 'text', '''pending''');
SELECT public.sa_add_column('customer_invitations', 'invited_by', 'text');
SELECT public.sa_add_column('customer_invitations', 'company_name', 'text');
SELECT public.sa_add_column('customer_invitations', 'customer_name', 'text');
SELECT public.sa_add_column('customer_invitations', 'target_profile_id', 'bigint');
SELECT public.sa_add_column('customer_invitations', 'message', 'text');
SELECT public.sa_add_column('customer_invitations', 'user_id', 'text');
SELECT public.sa_add_column('customer_invitations', 'expires_at', 'timestamptz', '(now() + interval ''14 days'')');
SELECT public.sa_add_column('customer_invitations', 'accepted_at', 'timestamptz');
SELECT public.sa_add_column('customer_invitations', 'created_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('customer_invitations', 'updated_at', 'timestamptz', 'now()');

-- Unique token if possible
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_invitations' AND column_name = 'token'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_invitations_token_key'
  ) THEN
    ALTER TABLE public.customer_invitations ADD CONSTRAINT customer_invitations_token_key UNIQUE (token);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'customer_invitations token unique skip: %', SQLERRM;
END $$;

-- Token is covered by UNIQUE constraint customer_invitations_token_key (no redundant non-unique index)
SELECT public.sa_create_index('idx_customer_invitations_profile', 'customer_invitations', 'profile_id');
SELECT public.sa_create_index('idx_customer_invitations_customer', 'customer_invitations', 'customer_id');
SELECT public.sa_create_index('idx_customer_invitations_email', 'customer_invitations', 'email');
SELECT public.sa_create_index('idx_customer_invitations_status', 'customer_invitations', 'status');

-- Optional FKs (never fail the script).
-- profile_id / customer_id are NOT NULL → ON DELETE CASCADE (SET NULL not allowed).
-- target_profile_id / connection_id are nullable → ON DELETE SET NULL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_invitations' AND column_name = 'profile_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'customer_invitations_profile_id_fkey'
  ) THEN
    ALTER TABLE public.customer_invitations
      ADD CONSTRAINT customer_invitations_profile_id_fkey
      FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'customer_invitations profile_id FK skip: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_invitations' AND column_name = 'customer_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'customer_invitations_customer_id_fkey'
  ) THEN
    ALTER TABLE public.customer_invitations
      ADD CONSTRAINT customer_invitations_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'customer_invitations customer_id FK skip: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_invitations' AND column_name = 'target_profile_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'customer_invitations_target_profile_id_fkey'
  ) THEN
    ALTER TABLE public.customer_invitations
      ADD CONSTRAINT customer_invitations_target_profile_id_fkey
      FOREIGN KEY (target_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'customer_invitations target_profile_id FK skip: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'connection_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_connections'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'customers_connection_id_fkey'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_connection_id_fkey
      FOREIGN KEY (connection_id) REFERENCES public.business_connections(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'customers connection_id FK skip: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.customer_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_invitations_all ON public.customer_invitations;
CREATE POLICY customer_invitations_all ON public.customer_invitations
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
  AND (
    (table_name = 'customers' AND column_name IN (
      'linked_profile_id', 'connection_id', 'invite_status', 'invite_token',
      'invited_at', 'invite_accepted_at', 'invited_email'
    ))
    OR (table_name = 'customer_invitations' AND column_name IN (
      'token', 'profile_id', 'customer_id', 'email', 'status', 'target_profile_id',
      'expires_at', 'user_id'
    ))
  )
ORDER BY table_name, column_name;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_customers_linked_profile',
    'idx_customers_invite_status',
    'uq_customers_profile_linked',
    'uq_bc_requester_requestee',
    'customer_invitations_token_key',
    'idx_customer_invitations_profile',
    'idx_customer_invitations_customer',
    'idx_customer_invitations_email',
    'idx_customer_invitations_status'
  )
ORDER BY indexname;
