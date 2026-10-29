-- GymAdvisor® Netcash debit orders and member invoicing.
-- DO NOT apply this file to production (onkklullmgrdqoertngp).
-- Staging review target, after a human reads it: wpchtkfkaavcjyfgmktn.
-- Re-runnable. No seed rows. No company 110 data. No truncate.
--
-- Tables are company-scoped. The API uses the service role and checks
-- owner/admin. Row level security still limits signed-in owner/admin
-- reads to their own company. Service keys and bank account numbers are
-- not granted to anon or authenticated.

SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '60s';

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;

DO $need_auth$
BEGIN
  IF to_regnamespace('auth') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION '20261047 requires auth.uid()';
  END IF;
END
$need_auth$;

CREATE OR REPLACE FUNCTION app_private.gym_netcash_owner_admin(p_company_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_users bu
    WHERE bu.profile_id = p_company_id
      AND bu.status = 'active'
      AND lower(bu.role) IN ('owner', 'admin')
      AND bu.user_id = auth.uid()::text
  );
$$;

REVOKE ALL ON FUNCTION app_private.gym_netcash_owner_admin(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.gym_netcash_owner_admin(bigint) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.gym_netcash_settings (
  company_id bigint PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  merchant_account text NOT NULL DEFAULT '',
  service_key_enc text,
  service_key_last4 text NOT NULL DEFAULT '',
  account_key_enc text,
  account_key_last4 text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT 'test',
  debit_day integer NOT NULL DEFAULT 1,
  cadence text NOT NULL DEFAULT 'monthly',
  lead_business_days integer NOT NULL DEFAULT 2,
  cutoff_hour_sast integer NOT NULL DEFAULT 14,
  cutoff_minute integer NOT NULL DEFAULT 0,
  prices_include_vat boolean NOT NULL DEFAULT true,
  vat_bps integer NOT NULL DEFAULT 1500,
  invoice_prefix text NOT NULL DEFAULT 'GYM',
  credit_prefix text NOT NULL DEFAULT 'GCN',
  late_fee_cents bigint NOT NULL DEFAULT 0,
  retry_max_attempts integer NOT NULL DEFAULT 2,
  auto_submit boolean NOT NULL DEFAULT false,
  auto_suspend_access boolean NOT NULL DEFAULT false,
  dunning_email boolean NOT NULL DEFAULT true,
  allow_amount_variance boolean NOT NULL DEFAULT true,
  gl_bank_code text NOT NULL DEFAULT '1110',
  gl_ar_code text NOT NULL DEFAULT '1180',
  gl_revenue_code text NOT NULL DEFAULT '4400',
  gl_vat_code text NOT NULL DEFAULT '2120',
  gl_fee_code text NOT NULL DEFAULT '4300',
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_by text NOT NULL DEFAULT '',
  CONSTRAINT gym_netcash_settings_mode CHECK (mode IN ('test', 'live')),
  CONSTRAINT gym_netcash_settings_cadence CHECK (cadence IN ('monthly', 'weekly', 'fortnightly')),
  CONSTRAINT gym_netcash_settings_day CHECK (debit_day BETWEEN 1 AND 31),
  CONSTRAINT gym_netcash_settings_lead CHECK (lead_business_days BETWEEN 0 AND 10),
  CONSTRAINT gym_netcash_settings_hour CHECK (cutoff_hour_sast BETWEEN 0 AND 23),
  CONSTRAINT gym_netcash_settings_minute CHECK (cutoff_minute BETWEEN 0 AND 59),
  CONSTRAINT gym_netcash_settings_vat CHECK (vat_bps BETWEEN 0 AND 3000),
  CONSTRAINT gym_netcash_settings_fee CHECK (late_fee_cents BETWEEN 0 AND 100000),
  CONSTRAINT gym_netcash_settings_retry CHECK (retry_max_attempts BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS public.gym_debit_mandates (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  member_id text NOT NULL,
  member_name text NOT NULL DEFAULT '',
  member_email text NOT NULL DEFAULT '',
  member_phone text NOT NULL DEFAULT '',
  account_holder text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  branch_code text NOT NULL DEFAULT '',
  account_type text NOT NULL DEFAULT 'cheque',
  account_number_enc text NOT NULL DEFAULT '',
  account_last4 text NOT NULL DEFAULT '',
  validation_status text NOT NULL DEFAULT 'unchecked',
  validation_ref text NOT NULL DEFAULT '',
  debit_day integer NOT NULL DEFAULT 1,
  amount_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  status text NOT NULL DEFAULT 'pending',
  consent_text text NOT NULL DEFAULT '',
  consent_version text NOT NULL DEFAULT '',
  signed_at timestamptz,
  signed_ip text NOT NULL DEFAULT '',
  signed_user_agent text NOT NULL DEFAULT '',
  netcash_ref text NOT NULL DEFAULT '',
  masterfile_batch_id text NOT NULL DEFAULT '',
  masterfile_uploaded_at timestamptz,
  starts_on date,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT gym_debit_mandates_status CHECK (status IN ('pending', 'active', 'suspended', 'cancelled')),
  CONSTRAINT gym_debit_mandates_validation CHECK (validation_status IN ('unchecked', 'valid', 'invalid', 'error')),
  CONSTRAINT gym_debit_mandates_type CHECK (account_type IN ('cheque', 'current', 'savings', 'transmission')),
  CONSTRAINT gym_debit_mandates_day CHECK (debit_day BETWEEN 1 AND 31)
);

CREATE INDEX IF NOT EXISTS gym_debit_mandates_company_status
  ON public.gym_debit_mandates (company_id, status);
CREATE INDEX IF NOT EXISTS gym_debit_mandates_company_member
  ON public.gym_debit_mandates (company_id, member_id);
CREATE UNIQUE INDEX IF NOT EXISTS gym_debit_mandates_one_open
  ON public.gym_debit_mandates (company_id, member_id)
  WHERE status IN ('pending', 'active', 'suspended');

CREATE TABLE IF NOT EXISTS public.gym_billing_runs (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  period_key text NOT NULL,
  period_start date,
  period_end date,
  status text NOT NULL DEFAULT 'preview',
  requested_action_date date,
  action_date date,
  cutoff_applied boolean NOT NULL DEFAULT false,
  holiday_shifted boolean NOT NULL DEFAULT false,
  action_date_note text NOT NULL DEFAULT '',
  expected_cents bigint NOT NULL DEFAULT 0,
  collected_cents bigint NOT NULL DEFAULT 0,
  unpaid_cents bigint NOT NULL DEFAULT 0,
  member_count integer NOT NULL DEFAULT 0,
  batch_count integer NOT NULL DEFAULT 0,
  idempotency_key text NOT NULL,
  netcash_batch_id text NOT NULL DEFAULT '',
  file_sha256 text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  reconciled_at timestamptz,
  approved_at timestamptz,
  approved_by text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT '',
  error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT gym_billing_runs_status CHECK (status IN ('preview', 'submitted', 'polling', 'reconciled', 'failed', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS gym_billing_runs_idem
  ON public.gym_billing_runs (company_id, idempotency_key);
CREATE INDEX IF NOT EXISTS gym_billing_runs_company_action
  ON public.gym_billing_runs (company_id, action_date DESC);

CREATE TABLE IF NOT EXISTS public.gym_billing_lines (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  run_id text NOT NULL REFERENCES public.gym_billing_runs (id) ON DELETE CASCADE,
  mandate_id text,
  member_id text NOT NULL,
  member_name text NOT NULL DEFAULT '',
  member_email text NOT NULL DEFAULT '',
  member_phone text NOT NULL DEFAULT '',
  crm_customer_id bigint,
  description text NOT NULL DEFAULT '',
  plan_cents bigint NOT NULL DEFAULT 0,
  addon_cents bigint NOT NULL DEFAULT 0,
  discount_cents bigint NOT NULL DEFAULT 0,
  prorata_cents bigint NOT NULL DEFAULT 0,
  fee_cents bigint NOT NULL DEFAULT 0,
  net_cents bigint NOT NULL DEFAULT 0,
  vat_cents bigint NOT NULL DEFAULT 0,
  total_cents bigint NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  invoice_id bigint,
  invoice_number text NOT NULL DEFAULT '',
  credit_note_id bigint,
  credit_note_number text NOT NULL DEFAULT '',
  collection_status text NOT NULL DEFAULT 'scheduled',
  skip_reason text NOT NULL DEFAULT '',
  netcash_reason_code text NOT NULL DEFAULT '',
  netcash_reason_text text NOT NULL DEFAULT '',
  retry_of_line_id text,
  attempt integer NOT NULL DEFAULT 1,
  access_suspended boolean NOT NULL DEFAULT false,
  notified_at timestamptz,
  whatsapp_path text NOT NULL DEFAULT '',
  idempotency_key text NOT NULL,
  finance_status text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT gym_billing_lines_status CHECK (collection_status IN ('scheduled', 'submitted', 'paid', 'unpaid', 'reversed', 'skipped', 'review'))
);

CREATE UNIQUE INDEX IF NOT EXISTS gym_billing_lines_idem
  ON public.gym_billing_lines (company_id, idempotency_key);
CREATE INDEX IF NOT EXISTS gym_billing_lines_run
  ON public.gym_billing_lines (company_id, run_id);
CREATE INDEX IF NOT EXISTS gym_billing_lines_member
  ON public.gym_billing_lines (company_id, member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.gym_netcash_batches (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  run_id text NOT NULL DEFAULT '',
  kind text NOT NULL,
  sha256 text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  total_cents bigint NOT NULL DEFAULT 0,
  file_enc text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT gym_netcash_batches_kind CHECK (kind IN ('masterfile', 'debit_batch', 'statement', 'unpaid'))
);

CREATE INDEX IF NOT EXISTS gym_netcash_batches_company
  ON public.gym_netcash_batches (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.gym_netcash_audit (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  actor text NOT NULL DEFAULT '',
  action text NOT NULL,
  entity text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  ip text NOT NULL DEFAULT '',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS gym_netcash_audit_company
  ON public.gym_netcash_audit (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.gym_netcash_jobs (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  run_id text,
  last_error text NOT NULL DEFAULT '',
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT gym_netcash_jobs_status CHECK (status IN ('queued', 'running', 'succeeded', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS gym_netcash_jobs_idem
  ON public.gym_netcash_jobs (company_id, idempotency_key);
CREATE INDEX IF NOT EXISTS gym_netcash_jobs_status
  ON public.gym_netcash_jobs (company_id, status, locked_at);

CREATE TABLE IF NOT EXISTS public.gym_invoice_sequences (
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.gym_member_access_holds (
  id text PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  member_id text NOT NULL,
  member_name text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  released_at timestamptz
);

CREATE INDEX IF NOT EXISTS gym_member_access_holds_open
  ON public.gym_member_access_holds (company_id, member_id)
  WHERE active = true;

CREATE OR REPLACE FUNCTION public.gym_netcash_next_number(p_company_id bigint, p_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  IF p_company_id IS NULL OR p_company_id <= 0 OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'company and sequence name are required';
  END IF;
  INSERT INTO public.gym_invoice_sequences (company_id, name, value)
  VALUES (p_company_id, left(trim(p_name), 32), 1)
  ON CONFLICT (company_id, name)
  DO UPDATE SET value = public.gym_invoice_sequences.value + 1,
                updated_at = pg_catalog.now()
  RETURNING value INTO n;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.gym_netcash_next_number(bigint, text) FROM PUBLIC;
DO $seq_grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.gym_netcash_next_number(bigint, text) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.gym_netcash_next_number(bigint, text) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.gym_netcash_next_number(bigint, text) TO service_role;
  END IF;
END
$seq_grant$;

COMMENT ON TABLE public.gym_netcash_settings IS
  'Per-company Netcash Debit Order settings. service_key_enc is sealed and not granted to the browser roles.';
COMMENT ON TABLE public.gym_debit_mandates IS
  'Member debit order mandates. account_number_enc is sealed. One open mandate per member.';
COMMENT ON TABLE public.gym_billing_runs IS
  'Idempotent billing runs. One row per company, cadence, and period.';
COMMENT ON TABLE public.gym_billing_lines IS
  'One collection line per member per attempt. Thousands of members are indexed by company and run.';
COMMENT ON TABLE public.gym_netcash_batches IS
  'Audit of every masterfile and debit batch. file_enc is the sealed file. The hash and counts are the readable audit.';
COMMENT ON TABLE public.gym_netcash_audit IS
  'Append-only audit of settings, mandates, submissions, and reconciliation. No secrets.';
COMMENT ON TABLE public.gym_netcash_jobs IS
  'Retry-safe job claims. A succeeded idempotency key is not run again.';
COMMENT ON TABLE public.gym_invoice_sequences IS
  'Per-company invoice and credit-note numbers.';
COMMENT ON TABLE public.gym_member_access_holds IS
  'Optional GymAdvisor access hold after a failed debit order.';

DO $rls$
DECLARE
  rel text;
BEGIN
  FOREACH rel IN ARRAY ARRAY[
    'gym_netcash_settings',
    'gym_debit_mandates',
    'gym_billing_runs',
    'gym_billing_lines',
    'gym_netcash_batches',
    'gym_netcash_audit',
    'gym_netcash_jobs',
    'gym_invoice_sequences',
    'gym_member_access_holds'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', rel);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', rel);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rel || '_admin_read', rel);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (app_private.gym_netcash_owner_admin(company_id))',
      rel || '_admin_read',
      rel
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rel || '_deny_anon', rel);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
      rel || '_deny_anon',
      rel
    );
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', rel);
  END LOOP;
END
$rls$;

GRANT SELECT (
  company_id, merchant_account, service_key_last4, mode, debit_day, cadence,
  lead_business_days, cutoff_hour_sast, cutoff_minute, prices_include_vat, vat_bps,
  invoice_prefix, credit_prefix, late_fee_cents, retry_max_attempts, auto_submit,
  auto_suspend_access, dunning_email, allow_amount_variance, gl_bank_code, gl_ar_code,
  gl_revenue_code, gl_vat_code, gl_fee_code, updated_at, updated_by
) ON public.gym_netcash_settings TO authenticated;

GRANT SELECT (
  id, company_id, member_id, member_name, member_email, member_phone, account_holder,
  bank_name, branch_code, account_type, account_last4, validation_status, validation_ref,
  debit_day, amount_cents, currency, status, consent_text, consent_version, signed_at,
  signed_ip, signed_user_agent, netcash_ref, masterfile_batch_id, masterfile_uploaded_at,
  starts_on, ends_on, created_at, updated_at
) ON public.gym_debit_mandates TO authenticated;

GRANT SELECT ON public.gym_billing_runs TO authenticated;
GRANT SELECT ON public.gym_billing_lines TO authenticated;
GRANT SELECT (
  id, company_id, run_id, kind, sha256, count, total_cents, created_at
) ON public.gym_netcash_batches TO authenticated;
GRANT SELECT ON public.gym_netcash_audit TO authenticated;
GRANT SELECT ON public.gym_netcash_jobs TO authenticated;
GRANT SELECT ON public.gym_member_access_holds TO authenticated;

DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.gym_netcash_settings TO service_role;
    GRANT ALL ON public.gym_debit_mandates TO service_role;
    GRANT ALL ON public.gym_billing_runs TO service_role;
    GRANT ALL ON public.gym_billing_lines TO service_role;
    GRANT ALL ON public.gym_netcash_batches TO service_role;
    GRANT ALL ON public.gym_netcash_audit TO service_role;
    GRANT ALL ON public.gym_netcash_jobs TO service_role;
    GRANT ALL ON public.gym_invoice_sequences TO service_role;
    GRANT ALL ON public.gym_member_access_holds TO service_role;
  END IF;
END
$grants$;
