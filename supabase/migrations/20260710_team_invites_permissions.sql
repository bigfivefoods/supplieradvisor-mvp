-- Team invites + role columns on business_users
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

-- Core membership fields (idempotent)
SELECT public.sa_add_column('business_users', 'profile_id', 'bigint');
SELECT public.sa_add_column('business_users', 'user_id', 'text');
SELECT public.sa_add_column('business_users', 'name', 'text');
SELECT public.sa_add_column('business_users', 'email', 'text');
SELECT public.sa_add_column('business_users', 'role', 'text', '''member''');
SELECT public.sa_add_column('business_users', 'status', 'text', '''active''');

-- Invite lifecycle (required for team email invites)
SELECT public.sa_add_column('business_users', 'invited_email', 'text');
SELECT public.sa_add_column('business_users', 'invited_at', 'timestamptz');
SELECT public.sa_add_column('business_users', 'invited_by', 'text');
SELECT public.sa_add_column('business_users', 'invite_token', 'text');
SELECT public.sa_add_column('business_users', 'joined_at', 'timestamptz');
SELECT public.sa_add_column('business_users', 'expires_at', 'timestamptz');
SELECT public.sa_add_column('business_users', 'updated_at', 'timestamptz', 'now()');
SELECT public.sa_add_column('business_users', 'permissions', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('business_users', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_add_column('business_users', 'last_active_at', 'timestamptz');

-- Indexes for invite claim + membership lookup
CREATE INDEX IF NOT EXISTS idx_business_users_invite_token
  ON public.business_users (invite_token)
  WHERE invite_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_users_profile_status
  ON public.business_users (profile_id, status);

CREATE INDEX IF NOT EXISTS idx_business_users_profile_email
  ON public.business_users (profile_id, lower(coalesce(invited_email, email)));

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'business_users'
  AND column_name IN (
    'invite_token', 'invited_email', 'invited_by', 'invited_at',
    'role', 'status', 'permissions', 'expires_at'
  )
ORDER BY 1;
