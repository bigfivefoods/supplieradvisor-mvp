-- RecoverAdvisor® foundation (Brief A). Written for the SQL editor.
-- Not applied to any live database by this change. Do not run it from the app.
--
-- company_id is bigint because public.profiles.id is bigint in this database
-- (the same key TradeAdvisor® uses). customers.id is bigint too.
-- There is no workspace-wide public token. Portal secrets are per person and hashed.
--
-- recover_portal is nologin and has no table grants. Forced row security has no
-- policy for anon, authenticated, or recover_portal, so a direct query is denied.
-- The SECURITY DEFINER functions below are owned by the migration role (the table
-- owner). A function owned by recover_portal could not read a session: that role
-- has no grants and row security is forced. service_role is the only execute grantee.
-- search_path is empty and every reference is schema-qualified.
-- Forced row security applies to the table owner too. SET row_security = off does
-- not bypass that: it raises if a policy would apply. recover_table_owner is a
-- permissive policy for the migration role only, so that role can run the
-- definer functions without BYPASSRLS. Every other role has no policy.
--
-- TRUNCATE, REFERENCES, and TRIGGER are revoked from anon, authenticated,
-- service_role, and recover_portal on every recover_ table. Default privileges
-- that GRANT ALL ON TABLES would otherwise leave TRUNCATE in place.
-- recover_audit_log is the only append-only table. A BEFORE TRUNCATE statement
-- trigger refuses a wipe even for the table owner. EXECUTE on that trigger
-- function is revoked from PUBLIC, anon, and authenticated. Portal attempts
-- are pruned, so they are not append-only.
-- Staff audit rows store the staff id in both payload and target. An email
-- passed as the target is not written.
--
-- ROLLBACK (run manually, in this order, only after review).
-- Functions that the audit trigger depends on are dropped after the tables.
-- The staff and team foreign keys are a cycle, so those constraints go first.
-- ROLLBACK_START
-- DROP FUNCTION IF EXISTS public.recover_desk_commit(bigint, text, text, text, jsonb);
-- DROP FUNCTION IF EXISTS public.recover_portal_call(text, text, text, jsonb);
-- DROP FUNCTION IF EXISTS public.recover_portal_register_failure(uuid, bigint, text, text);
-- DROP FUNCTION IF EXISTS public.recover_portal_is_throttled(bigint, text, text);
-- DROP FUNCTION IF EXISTS public.recover_portal_prune_attempts();
-- DROP FUNCTION IF EXISTS public.recover_verify_code_ct(text, text);
-- ALTER TABLE IF EXISTS public.recover_teams DROP CONSTRAINT IF EXISTS recover_teams_lead_staff_id_fkey;
-- ALTER TABLE IF EXISTS public.recover_staff DROP CONSTRAINT IF EXISTS recover_staff_team_id_fkey;
-- ALTER TABLE IF EXISTS public.recover_staff DROP CONSTRAINT IF EXISTS recover_staff_company_team_fkey;
-- ALTER TABLE IF EXISTS public.recover_teams DROP CONSTRAINT IF EXISTS uq_recover_teams_company_id;
-- DROP TABLE IF EXISTS public.recover_portal_attempts;
-- DROP TABLE IF EXISTS public.recover_portal_otps;
-- DROP TABLE IF EXISTS public.recover_portal_sessions;
-- DROP TABLE IF EXISTS public.recover_portal_invites;
-- DROP TABLE IF EXISTS public.recover_audit_log;
-- DROP TABLE IF EXISTS public.recover_mandates;
-- DROP TABLE IF EXISTS public.recover_creditors;
-- DROP TABLE IF EXISTS public.recover_staff;
-- DROP TABLE IF EXISTS public.recover_teams;
-- DROP TABLE IF EXISTS public.recover_workspaces;
-- DROP FUNCTION IF EXISTS public.recover_forbid_mutation();
-- DROP FUNCTION IF EXISTS public.recover_forbid_truncate();
-- DROP ROLE IF EXISTS recover_portal;
-- ROLLBACK_END

CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'recover_portal') THEN
    CREATE ROLE recover_portal NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.recover_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  operator_type text NOT NULL DEFAULT 'agency',
  programme_types text[] NOT NULL DEFAULT ARRAY['recovery']::text[],
  trust_mode text NOT NULL DEFAULT 'trust',
  cfdc_registration_no text NOT NULL DEFAULT '',
  cfdc_expiry date,
  vat_registered boolean NOT NULL DEFAULT false,
  vat_rate_bps integer,
  contact_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  trust_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  comms_flags jsonb NOT NULL DEFAULT '{"email":false,"whatsapp":false,"sms":false}'::jsonb,
  retention jsonb NOT NULL DEFAULT '{}'::jsonb,
  real_data_enabled boolean NOT NULL DEFAULT false,
  real_data_confirmed_by text,
  real_data_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recover_workspaces_operator_check CHECK (
    operator_type IN ('agency', 'in_house', 'attorney')
  ),
  CONSTRAINT recover_workspaces_trust_check CHECK (trust_mode IN ('trust', 'direct')),
  CONSTRAINT recover_workspaces_programme_check CHECK (
    programme_types <@ ARRAY['recovery', 'managed_repayment']::text[]
    AND cardinality(programme_types) >= 1
  )
);

CREATE INDEX IF NOT EXISTS idx_recover_workspaces_company
  ON public.recover_workspaces (company_id);

CREATE TABLE IF NOT EXISTS public.recover_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  lead_staff_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recover_teams_company
  ON public.recover_teams (company_id, name);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_recover_teams_company_id'
  ) THEN
    ALTER TABLE public.recover_teams
      ADD CONSTRAINT uq_recover_teams_company_id UNIQUE (company_id, id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.recover_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id text,
  email text NOT NULL,
  role text NOT NULL,
  team_id uuid REFERENCES public.recover_teams(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  cfdc_registration_no text NOT NULL DEFAULT '',
  registration_status text NOT NULL DEFAULT '',
  monthly_target_cents bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recover_staff_role_check CHECK (
    role IN ('manager', 'collector', 'compliance', 'finance_view')
  ),
  CONSTRAINT recover_staff_status_check CHECK (status IN ('active', 'inactive'))
);

ALTER TABLE public.recover_staff DROP CONSTRAINT IF EXISTS recover_staff_team_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recover_staff_company_team_fkey'
  ) THEN
    ALTER TABLE public.recover_staff
      ADD CONSTRAINT recover_staff_company_team_fkey
      FOREIGN KEY (company_id, team_id)
      REFERENCES public.recover_teams (company_id, id)
      ON DELETE SET NULL (team_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_recover_staff_email
  ON public.recover_staff (company_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_recover_staff_company
  ON public.recover_staff (company_id, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recover_teams_lead_staff_id_fkey'
  ) THEN
    ALTER TABLE public.recover_teams
      ADD CONSTRAINT recover_teams_lead_staff_id_fkey
      FOREIGN KEY (lead_staff_id) REFERENCES public.recover_staff(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.recover_creditors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id bigint REFERENCES public.customers(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  reg_no text NOT NULL DEFAULT '',
  vat_no text NOT NULL DEFAULT '',
  remittance_terms text NOT NULL DEFAULT 'monthly',
  portal_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recover_creditors_terms_check CHECK (
    remittance_terms IN ('monthly', 'weekly', 'on_receipt')
  ),
  CONSTRAINT recover_creditors_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_recover_creditors_company
  ON public.recover_creditors (company_id, status);

CREATE TABLE IF NOT EXISTS public.recover_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creditor_id uuid NOT NULL REFERENCES public.recover_creditors(id) ON DELETE CASCADE,
  programme_type text NOT NULL DEFAULT 'recovery',
  product_type text NOT NULL,
  nca_regulated boolean NOT NULL,
  processing_role text NOT NULL,
  authority_to_litigate boolean NOT NULL DEFAULT false,
  bureau_authority boolean NOT NULL DEFAULT false,
  retention_months integer,
  start_on date,
  end_on date,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recover_mandates_programme_check CHECK (
    programme_type IN ('recovery', 'managed_repayment')
  ),
  CONSTRAINT recover_mandates_product_check CHECK (
    product_type IN ('nca_credit', 'trade', 'levy', 'rent', 'medical', 'utility', 'other')
  ),
  CONSTRAINT recover_mandates_processing_check CHECK (
    processing_role IN ('responsible_party', 'operator')
  )
);

CREATE INDEX IF NOT EXISTS idx_recover_mandates_company
  ON public.recover_mandates (company_id, creditor_id, status);

CREATE TABLE IF NOT EXISTS public.recover_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_kind text NOT NULL,
  actor_id text,
  action text NOT NULL,
  target text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recover_audit_actor_check CHECK (actor_kind IN ('staff', 'system', 'portal'))
);

CREATE INDEX IF NOT EXISTS idx_recover_audit_company
  ON public.recover_audit_log (company_id, at DESC);

CREATE TABLE IF NOT EXISTS public.recover_portal_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  portal text NOT NULL,
  subject_id uuid,
  email text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recover_portal_invites_portal_check CHECK (
    portal IN ('creditor', 'debtor', 'attorney')
  )
);

CREATE INDEX IF NOT EXISTS idx_recover_portal_invites_company
  ON public.recover_portal_invites (company_id, portal, lower(email));

CREATE TABLE IF NOT EXISTS public.recover_portal_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_id uuid NOT NULL REFERENCES public.recover_portal_invites(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recover_portal_otps_attempts_check CHECK (failed_attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_recover_portal_otps_invite
  ON public.recover_portal_otps (invite_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.recover_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  portal text NOT NULL,
  subject_id uuid,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recover_portal_sessions_portal_check CHECK (
    portal IN ('creditor', 'debtor', 'attorney')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_recover_portal_sessions_hash
  ON public.recover_portal_sessions (token_hash);

CREATE INDEX IF NOT EXISTS idx_recover_portal_sessions_company
  ON public.recover_portal_sessions (company_id, portal);

CREATE TABLE IF NOT EXISTS public.recover_portal_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  portal text NOT NULL,
  scope text NOT NULL,
  key_hash text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recover_portal_attempts_portal_check CHECK (
    portal IN ('creditor', 'debtor', 'attorney')
  ),
  CONSTRAINT recover_portal_attempts_scope_check CHECK (scope IN ('email', 'book'))
);

-- A shared address is not a throttle key. scope is email or book only.
ALTER TABLE public.recover_portal_attempts
  DROP CONSTRAINT IF EXISTS recover_portal_attempts_scope_check;
ALTER TABLE public.recover_portal_attempts
  ADD CONSTRAINT recover_portal_attempts_scope_check CHECK (scope IN ('email', 'book'));

-- Profile removal must not delete the audit row. SET NULL is an UPDATE, so the
-- append-only trigger allows only that one change and still blocks every other write.
ALTER TABLE public.recover_audit_log ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE public.recover_audit_log DROP CONSTRAINT IF EXISTS recover_audit_log_company_id_fkey;
ALTER TABLE public.recover_audit_log
  ADD CONSTRAINT recover_audit_log_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recover_portal_attempts_recent
  ON public.recover_portal_attempts (company_id, scope, at DESC);

CREATE OR REPLACE FUNCTION public.recover_forbid_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- A profile delete fires the foreign-key action inside an outer trigger,
  -- so this row trigger is nested. A direct UPDATE is depth 1 and stays refused.
  IF TG_OP = 'UPDATE'
     AND pg_catalog.pg_trigger_depth() > 1
     AND OLD.company_id IS NOT NULL
     AND NEW.company_id IS NULL
     AND NEW.id = OLD.id
     AND NEW.actor_kind = OLD.actor_kind
     AND NEW.actor_id IS NOT DISTINCT FROM OLD.actor_id
     AND NEW.action = OLD.action
     AND NEW.target IS NOT DISTINCT FROM OLD.target
     AND NEW.payload = OLD.payload
     AND NEW.at = OLD.at THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'append-only' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS recover_audit_log_append_only ON public.recover_audit_log;
CREATE TRIGGER recover_audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.recover_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.recover_forbid_mutation();

CREATE OR REPLACE FUNCTION public.recover_forbid_truncate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'append-only' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS recover_audit_log_no_truncate ON public.recover_audit_log;
CREATE TRIGGER recover_audit_log_no_truncate
  BEFORE TRUNCATE ON public.recover_audit_log
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.recover_forbid_truncate();

REVOKE ALL ON FUNCTION public.recover_forbid_truncate() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  t text;
  grantee text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'recover_workspaces',
    'recover_teams',
    'recover_staff',
    'recover_creditors',
    'recover_mandates',
    'recover_audit_log',
    'recover_portal_invites',
    'recover_portal_otps',
    'recover_portal_sessions',
    'recover_portal_attempts'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'recover_portal') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM recover_portal', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM service_role', t);
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role',
        t
      );
    END IF;
    -- GRANT ALL from default privileges includes TRUNCATE. Take it back explicitly.
    FOREACH grantee IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'recover_portal']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = grantee) THEN
        EXECUTE format(
          'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM %I',
          t,
          grantee
        );
      END IF;
    END LOOP;
    EXECUTE format('DROP POLICY IF EXISTS recover_table_owner ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY recover_table_owner ON public.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
      t,
      current_user
    );
  END LOOP;
END $$;

-- Compare two SHA-256 hex digests. Every call walks the same 32 bytes.
-- A short value, a null, or a bad hex digit is folded into the accumulator.
-- The function does not return before that walk, and it does not use text equality.
CREATE OR REPLACE FUNCTION public.recover_verify_code_ct(a text, b text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  zeros bytea := pg_catalog.decode(repeat('00', 32), 'hex');
  left_bytes bytea := zeros;
  right_bytes bytea := zeros;
  diff integer := 0;
  i integer;
BEGIN
  IF a IS NULL OR b IS NULL OR pg_catalog.length(a) <> 64 OR pg_catalog.length(b) <> 64 THEN
    diff := 1;
  ELSE
    BEGIN
      left_bytes := pg_catalog.decode(a, 'hex');
      right_bytes := pg_catalog.decode(b, 'hex');
    EXCEPTION WHEN others THEN
      diff := 1;
      left_bytes := zeros;
      right_bytes := zeros;
    END;
  END IF;
  IF pg_catalog.octet_length(left_bytes) <> 32 OR pg_catalog.octet_length(right_bytes) <> 32 THEN
    diff := 1;
    left_bytes := zeros;
    right_bytes := zeros;
  END IF;
  FOR i IN 0 .. 31 LOOP
    diff := diff | (pg_catalog.get_byte(left_bytes, i) # pg_catalog.get_byte(right_bytes, i));
  END LOOP;
  RETURN diff = 0;
END;
$$;

REVOKE ALL ON FUNCTION public.recover_verify_code_ct(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_verify_code_ct(text, text) TO service_role;

-- Call before any code comparison. Blank input and unexpected errors are locked.
CREATE OR REPLACE FUNCTION public.recover_portal_is_throttled(
  p_company_id bigint,
  p_portal text,
  p_email_hash text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  email_count integer;
  book_count integer;
BEGIN
  IF p_company_id IS NULL
     OR p_portal IS NULL
     OR p_email_hash IS NULL
     OR pg_catalog.btrim(p_email_hash) = ''
     OR p_portal NOT IN ('creditor', 'debtor', 'attorney') THEN
    RETURN true;
  END IF;
  SELECT count(*) INTO email_count
  FROM public.recover_portal_attempts
  WHERE company_id = p_company_id
    AND scope = 'email'
    AND key_hash = p_email_hash
    AND at > pg_catalog.now() - interval '15 minutes';
  SELECT count(*) INTO book_count
  FROM public.recover_portal_attempts
  WHERE company_id = p_company_id
    AND scope = 'book'
    AND at > pg_catalog.now() - interval '15 minutes';
  RETURN email_count > 10 OR book_count > 50;
EXCEPTION WHEN others THEN
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.recover_portal_is_throttled(bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_portal_is_throttled(bigint, text, text) TO service_role;

-- Drop sign-in attempts older than a day. Email and book counters only look back 15 minutes.
CREATE OR REPLACE FUNCTION public.recover_portal_prune_attempts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.recover_portal_attempts
  WHERE at < pg_catalog.now() - interval '24 hours';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
EXCEPTION WHEN others THEN
  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.recover_portal_prune_attempts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_portal_prune_attempts() TO service_role;

-- One statement increments the live code. At 5 failures the code is burned.
-- Returns false on bad input or any error so the caller treats the attempt as locked.
-- The fourth argument is ignored. IP scope is not stored.
CREATE OR REPLACE FUNCTION public.recover_portal_register_failure(
  p_invite_id uuid,
  p_company_id bigint,
  p_email_hash text,
  p_ip_hash text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_portal text;
BEGIN
  IF p_company_id IS NULL
     OR p_email_hash IS NULL
     OR pg_catalog.btrim(p_email_hash) = '' THEN
    RETURN false;
  END IF;

  SELECT portal INTO v_portal
  FROM public.recover_portal_invites
  WHERE id = p_invite_id
    AND company_id = p_company_id;

  IF v_portal IS NULL THEN
    v_portal := 'debtor';
  END IF;

  -- p_ip_hash is accepted and ignored. A shared address must not lock the book.
  PERFORM p_ip_hash;
  PERFORM public.recover_portal_prune_attempts();

  INSERT INTO public.recover_portal_attempts (company_id, portal, scope, key_hash)
  VALUES (p_company_id, v_portal, 'email', p_email_hash);

  INSERT INTO public.recover_portal_attempts (company_id, portal, scope, key_hash)
  VALUES (
    p_company_id,
    v_portal,
    'book',
    encode(extensions.digest(convert_to(p_company_id::text, 'UTF8'), 'sha256'), 'hex')
  );

  UPDATE public.recover_portal_otps
  SET
    failed_attempts = failed_attempts + 1,
    used_at = CASE
      WHEN failed_attempts + 1 >= 5 THEN pg_catalog.now()
      ELSE used_at
    END
  WHERE id = (
    SELECT id
    FROM public.recover_portal_otps
    WHERE invite_id = p_invite_id
      AND company_id = p_company_id
      AND used_at IS NULL
      AND expires_at > pg_catalog.now()
    ORDER BY expires_at DESC
    LIMIT 1
  );

  RETURN true;
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.recover_portal_register_failure(uuid, bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_portal_register_failure(uuid, bigint, text, text) TO service_role;

-- Skeleton portal entry. The only whitelisted op is ping, and it returns no
-- company or subject data. Every other outcome is the same generic denial.
CREATE OR REPLACE FUNCTION public.recover_portal_call(
  p_portal text,
  p_token_hash text,
  p_op text,
  p_args jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_portal text;
  v_hash text;
  v_expires timestamptz;
  v_revoked timestamptz;
  v_match boolean := false;
BEGIN
  PERFORM p_args;
  SELECT portal, token_hash, expires_at, revoked_at
    INTO v_portal, v_hash, v_expires, v_revoked
  FROM public.recover_portal_sessions
  WHERE token_hash = p_token_hash
  LIMIT 1;

  IF v_hash IS NOT NULL THEN
    v_match := public.recover_verify_code_ct(v_hash, p_token_hash);
  END IF;

  IF v_match
     AND v_revoked IS NULL
     AND v_expires > pg_catalog.now()
     AND v_portal = p_portal
     AND p_op = 'ping'
     AND p_portal IN ('creditor', 'debtor', 'attorney') THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'portal', v_portal);
  END IF;

  RETURN pg_catalog.jsonb_build_object('ok', false);
EXCEPTION WHEN others THEN
  RETURN pg_catalog.jsonb_build_object('ok', false);
END;
$$;

REVOKE ALL ON FUNCTION public.recover_portal_call(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_portal_call(text, text, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.recover_portal_call(text, text, text, jsonb) IS
  'RecoverAdvisor® portal skeleton. ping only. No company or subject payload.';

COMMENT ON FUNCTION public.recover_portal_is_throttled(bigint, text, text) IS
  'Call before comparing a sign-in code. More than 10 email failures or 50 workspace failures in 15 minutes locks. Errors lock.';

COMMENT ON FUNCTION public.recover_portal_register_failure(uuid, bigint, text, text) IS
  'Atomic wrong-code counter. The fifth failure burns the code. Errors lock. The IP argument is ignored.';

REVOKE ALL ON FUNCTION public.recover_forbid_mutation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_forbid_mutation() TO service_role;

-- Workspace write and its audit row share one transaction.
CREATE OR REPLACE FUNCTION public.recover_desk_commit(
  p_company_id bigint,
  p_actor_id text,
  p_action text,
  p_target text,
  p_patch jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_found integer;
  v_staff_id uuid;
  v_team_id uuid;
BEGIN
  IF p_patch IS NULL THEN
    p_patch := '{}'::jsonb;
  END IF;

  IF p_action = 'update_workspace' THEN
    UPDATE public.recover_workspaces
    SET
      display_name = CASE WHEN p_patch ? 'display_name' THEN p_patch->>'display_name' ELSE display_name END,
      operator_type = CASE WHEN p_patch ? 'operator_type' THEN p_patch->>'operator_type' ELSE operator_type END,
      trust_mode = CASE WHEN p_patch ? 'trust_mode' THEN p_patch->>'trust_mode' ELSE trust_mode END,
      cfdc_registration_no = CASE WHEN p_patch ? 'cfdc_registration_no' THEN p_patch->>'cfdc_registration_no' ELSE cfdc_registration_no END,
      cfdc_expiry = CASE
        WHEN p_patch ? 'cfdc_expiry' THEN NULLIF(p_patch->>'cfdc_expiry', '')::date
        ELSE cfdc_expiry
      END,
      vat_registered = CASE
        WHEN p_patch ? 'vat_registered' THEN (p_patch->>'vat_registered')::boolean
        ELSE vat_registered
      END,
      vat_rate_bps = CASE
        WHEN p_patch ? 'vat_rate_bps' AND NULLIF(p_patch->>'vat_rate_bps', '') IS NULL THEN NULL
        WHEN p_patch ? 'vat_rate_bps' THEN (p_patch->>'vat_rate_bps')::integer
        ELSE vat_rate_bps
      END,
      programme_types = ARRAY['recovery']::text[],
      updated_at = pg_catalog.now()
    WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_found = ROW_COUNT;
    IF v_found = 0 THEN
      RAISE EXCEPTION 'missing_workspace' USING ERRCODE = 'P0002';
    END IF;
  ELSIF p_action = 'set_real_data_enabled' THEN
    UPDATE public.recover_workspaces
    SET
      real_data_enabled = COALESCE((p_patch->>'enabled')::boolean, false),
      real_data_confirmed_by = CASE
        WHEN COALESCE((p_patch->>'enabled')::boolean, false) THEN NULLIF(p_patch->>'real_data_confirmed_by', '')
        ELSE NULL
      END,
      real_data_confirmed_at = CASE
        WHEN COALESCE((p_patch->>'enabled')::boolean, false) THEN pg_catalog.now()
        ELSE NULL
      END,
      updated_at = pg_catalog.now()
    WHERE company_id = p_company_id;
    GET DIAGNOSTICS v_found = ROW_COUNT;
    IF v_found = 0 THEN
      RAISE EXCEPTION 'missing_workspace' USING ERRCODE = 'P0002';
    END IF;
  ELSIF p_action = 'init_workspace' THEN
    INSERT INTO public.recover_workspaces (
      company_id,
      display_name,
      operator_type,
      trust_mode,
      programme_types,
      cfdc_registration_no,
      cfdc_expiry,
      vat_registered,
      vat_rate_bps,
      updated_at
    )
    VALUES (
      p_company_id,
      COALESCE(p_patch->>'display_name', ''),
      COALESCE(NULLIF(p_patch->>'operator_type', ''), 'agency'),
      COALESCE(NULLIF(p_patch->>'trust_mode', ''), 'trust'),
      ARRAY['recovery']::text[],
      COALESCE(p_patch->>'cfdc_registration_no', ''),
      NULLIF(p_patch->>'cfdc_expiry', '')::date,
      COALESCE((p_patch->>'vat_registered')::boolean, false),
      CASE
        WHEN p_patch ? 'vat_rate_bps' AND NULLIF(p_patch->>'vat_rate_bps', '') IS NOT NULL
          THEN (p_patch->>'vat_rate_bps')::integer
        ELSE NULL
      END,
      pg_catalog.now()
    )
    ON CONFLICT (company_id) DO NOTHING;
    -- A repeat init finds the existing workspace and changes nothing.
    -- Do not append an audit row for that no-op.
    GET DIAGNOSTICS v_found = ROW_COUNT;
    IF v_found = 0 THEN
      RETURN;
    END IF;
  ELSIF p_action = 'upsert_staff' THEN
    v_team_id := CASE
      WHEN p_patch ? 'team_id' THEN NULLIF(p_patch->>'team_id', '')::uuid
      ELSE NULL
    END;
    IF p_patch ? 'team_id' AND v_team_id IS NOT NULL THEN
      PERFORM 1
      FROM public.recover_teams
      WHERE id = v_team_id
        AND company_id = p_company_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'team_company_mismatch' USING ERRCODE = '23503';
      END IF;
    END IF;
    IF NULLIF(p_patch->>'id', '') IS NOT NULL THEN
      UPDATE public.recover_staff
      SET
        email = COALESCE(NULLIF(p_patch->>'email', ''), email),
        role = COALESCE(NULLIF(p_patch->>'role', ''), role),
        team_id = CASE
          WHEN p_patch ? 'team_id' THEN NULLIF(p_patch->>'team_id', '')::uuid
          ELSE team_id
        END,
        cfdc_registration_no = CASE
          WHEN p_patch ? 'cfdc_registration_no' THEN COALESCE(p_patch->>'cfdc_registration_no', '')
          ELSE cfdc_registration_no
        END,
        registration_status = CASE
          WHEN p_patch ? 'registration_status' THEN COALESCE(p_patch->>'registration_status', '')
          ELSE registration_status
        END,
        monthly_target_cents = CASE
          WHEN p_patch ? 'monthly_target_cents' AND NULLIF(p_patch->>'monthly_target_cents', '') IS NULL THEN NULL
          WHEN p_patch ? 'monthly_target_cents' THEN (p_patch->>'monthly_target_cents')::bigint
          ELSE monthly_target_cents
        END,
        status = 'active',
        updated_at = pg_catalog.now()
      WHERE company_id = p_company_id
        AND id = (p_patch->>'id')::uuid
      RETURNING id INTO v_staff_id;
      GET DIAGNOSTICS v_found = ROW_COUNT;
      IF v_found = 0 THEN
        RAISE EXCEPTION 'missing_staff' USING ERRCODE = 'P0002';
      END IF;
    ELSE
      UPDATE public.recover_staff
      SET
        role = COALESCE(NULLIF(p_patch->>'role', ''), role),
        team_id = CASE
          WHEN p_patch ? 'team_id' THEN NULLIF(p_patch->>'team_id', '')::uuid
          ELSE team_id
        END,
        cfdc_registration_no = CASE
          WHEN p_patch ? 'cfdc_registration_no' THEN COALESCE(p_patch->>'cfdc_registration_no', '')
          ELSE cfdc_registration_no
        END,
        registration_status = CASE
          WHEN p_patch ? 'registration_status' THEN COALESCE(p_patch->>'registration_status', '')
          ELSE registration_status
        END,
        monthly_target_cents = CASE
          WHEN p_patch ? 'monthly_target_cents' AND NULLIF(p_patch->>'monthly_target_cents', '') IS NULL THEN NULL
          WHEN p_patch ? 'monthly_target_cents' THEN (p_patch->>'monthly_target_cents')::bigint
          ELSE monthly_target_cents
        END,
        status = 'active',
        updated_at = pg_catalog.now()
      WHERE company_id = p_company_id
        AND lower(email) = lower(COALESCE(p_patch->>'email', ''))
      RETURNING id INTO v_staff_id;
      GET DIAGNOSTICS v_found = ROW_COUNT;
      IF v_found = 0 THEN
        INSERT INTO public.recover_staff (
          company_id,
          user_id,
          email,
          role,
          team_id,
          status,
          cfdc_registration_no,
          registration_status,
          monthly_target_cents,
          updated_at
        )
        VALUES (
          p_company_id,
          NULL,
          COALESCE(p_patch->>'email', ''),
          COALESCE(NULLIF(p_patch->>'role', ''), 'collector'),
          NULLIF(p_patch->>'team_id', '')::uuid,
          'active',
          COALESCE(p_patch->>'cfdc_registration_no', ''),
          COALESCE(p_patch->>'registration_status', ''),
          CASE
            WHEN NULLIF(p_patch->>'monthly_target_cents', '') IS NULL THEN NULL
            ELSE (p_patch->>'monthly_target_cents')::bigint
          END,
          pg_catalog.now()
        )
        RETURNING id INTO v_staff_id;
      END IF;
    END IF;
  ELSIF p_action = 'deactivate_staff' THEN
    UPDATE public.recover_staff
    SET status = 'inactive', updated_at = pg_catalog.now()
    WHERE company_id = p_company_id
      AND id = NULLIF(p_patch->>'id', '')::uuid
    RETURNING id INTO v_staff_id;
    GET DIAGNOSTICS v_found = ROW_COUNT;
    IF v_found = 0 THEN
      RAISE EXCEPTION 'missing_staff' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    RAISE EXCEPTION 'unsupported' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.recover_audit_log (company_id, actor_kind, actor_id, action, target, payload)
  VALUES (
    p_company_id,
    'staff',
    p_actor_id,
    p_action,
    CASE
      WHEN p_action IN ('upsert_staff', 'deactivate_staff') THEN v_staff_id::text
      ELSE p_target
    END,
    CASE
      WHEN p_action IN ('upsert_staff', 'deactivate_staff')
        THEN pg_catalog.jsonb_build_object('staff_id', v_staff_id)
      ELSE p_patch
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.recover_desk_commit(bigint, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_desk_commit(bigint, text, text, text, jsonb) TO service_role;
