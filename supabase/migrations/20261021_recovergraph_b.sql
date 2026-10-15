-- RecoverAdvisor® book (Brief B). Written for the SQL editor.
-- Apply manually after review. Not applied to any live database by this change.
-- Do not run it from the app.
--
-- Re-runnable. Tables use IF NOT EXISTS, columns use ADD COLUMN IF NOT EXISTS,
-- functions are CREATE OR REPLACE, and constraints are dropped and re-added.
-- There are no seed rows and no customer data.
--
-- company_id is bigint because public.profiles.id is bigint.
-- New row ids are uuid. Money is bigint cents. currency is ZAR.
--
-- Append-only choice for recover_account_events:
-- company_id and account_id use ON DELETE SET NULL, with the same nested-trigger
-- exemption Brief A used on recover_audit_log, so deleting a company profile
-- nulls those keys instead of asking the trigger to delete evidence.
-- A direct UPDATE or DELETE still raises. DELETE is allowed only while the
-- transaction-local recover.erase_token matches recover_erase_guard. That token
-- is set by recover_erase_company, recover_rollback_batch, and recover_clear_demo.
-- recover_forbid_mutation is replaced here only to honour that same token on
-- DELETE of recover_audit_log, so a test-company erase can clear audit rows.
-- The nested UPDATE exemption for profile deletion is unchanged.
-- The guard table has no grants and no row policy. The migration role (a
-- superuser in the SQL editor) owns the definer functions and can read it.
-- service_role cannot.
--
-- Debtor ID numbers are not stored in plaintext. The application writes
-- id_number_enc, id_hash, id_last4, and id_key_version. This file has no key.
--
-- ROLLBACK (run manually, in this order, only after review).
-- ROLLBACK_START
-- Drop the new functions first (book, import, rollback, demo, erase, agent read,
-- next number, staff expiry, assignment block, demo-row check, flag check,
-- event mutation). Then drop triggers added on recover_workspaces,
-- recover_accounts, and recover_account_events. Then drop the new tables:
-- recover_account_events, recover_accounts, recover_contact_points,
-- recover_batches, recover_debtors, recover_counters, recover_erase_guard.
-- Then drop the additive columns and constraints on recover_creditors,
-- recover_mandates, recover_staff, and recover_workspaces.
-- Do not drop Brief A tables. Do not drop recover_desk_commit.
-- ROLLBACK_END

-- ---------------------------------------------------------------------------
-- Additive columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.recover_creditors ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE public.recover_creditors ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.recover_creditors ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE public.recover_creditors ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.recover_creditors ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.recover_creditors DROP CONSTRAINT IF EXISTS recover_creditors_email_check;
ALTER TABLE public.recover_creditors
  ADD CONSTRAINT recover_creditors_email_check CHECK (
    contact_email IS NULL
    OR (
      contact_email = lower(contact_email)
      AND position('@' IN contact_email) > 1
      AND char_length(contact_email) <= 320
    )
  );

ALTER TABLE public.recover_creditors DROP CONSTRAINT IF EXISTS recover_creditors_notes_check;
ALTER TABLE public.recover_creditors
  ADD CONSTRAINT recover_creditors_notes_check CHECK (
    notes IS NULL OR char_length(notes) <= 2000
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_recover_creditors_name_active
  ON public.recover_creditors (company_id, lower(name))
  WHERE archived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_recover_creditors_customer_active
  ON public.recover_creditors (company_id, customer_id)
  WHERE customer_id IS NOT NULL AND archived_at IS NULL;

ALTER TABLE public.recover_mandates ADD COLUMN IF NOT EXISTS commission_model jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.recover_mandates
  ADD COLUMN IF NOT EXISTS allocation_order jsonb NOT NULL DEFAULT '["costs","interest","fees","principal"]'::jsonb;
ALTER TABLE public.recover_mandates ADD COLUMN IF NOT EXISTS agreement_reference text;
ALTER TABLE public.recover_mandates ADD COLUMN IF NOT EXISTS signed_on date;

ALTER TABLE public.recover_mandates DROP CONSTRAINT IF EXISTS recover_mandates_status_check;
ALTER TABLE public.recover_mandates
  ADD CONSTRAINT recover_mandates_status_check CHECK (
    status IN ('draft', 'active', 'ended')
    AND (
      status <> 'active'
      OR (
        signed_on IS NOT NULL
        AND agreement_reference IS NOT NULL
        AND char_length(btrim(agreement_reference)) > 0
        AND char_length(agreement_reference) <= 120
      )
    )
  );

ALTER TABLE public.recover_mandates DROP CONSTRAINT IF EXISTS recover_mandates_agreement_len;
ALTER TABLE public.recover_mandates
  ADD CONSTRAINT recover_mandates_agreement_len CHECK (
    agreement_reference IS NULL OR char_length(agreement_reference) <= 120
  );

ALTER TABLE public.recover_mandates DROP CONSTRAINT IF EXISTS recover_mandates_commission_check;
ALTER TABLE public.recover_mandates
  ADD CONSTRAINT recover_mandates_commission_check CHECK (
    pg_catalog.jsonb_typeof(commission_model) = 'object'
    AND (
      commission_model = '{}'::jsonb
      OR (
        commission_model->>'kind' IN (
          'pct_of_recovered', 'tiered', 'flat_per_account', 'flat_plus_pct'
        )
        AND (
          NOT (commission_model ? 'bps')
          OR (commission_model->>'bps' ~ '^[0-9]+$')
        )
        AND (
          NOT (commission_model ? 'cents')
          OR (commission_model->>'cents' ~ '^[0-9]+$')
        )
        AND (
          NOT (commission_model ? 'flat_cents')
          OR (commission_model->>'flat_cents' ~ '^[0-9]+$')
        )
      )
    )
  );

ALTER TABLE public.recover_mandates DROP CONSTRAINT IF EXISTS recover_mandates_allocation_check;
ALTER TABLE public.recover_mandates
  ADD CONSTRAINT recover_mandates_allocation_check CHECK (
    pg_catalog.jsonb_typeof(allocation_order) = 'array'
    AND allocation_order <@ '["costs","interest","fees","principal"]'::jsonb
    AND '["costs","interest","fees","principal"]'::jsonb <@ allocation_order
  );

ALTER TABLE public.recover_staff ADD COLUMN IF NOT EXISTS registration_expires_on date;

ALTER TABLE public.recover_workspaces
  ADD COLUMN IF NOT EXISTS block_unregistered_assignment boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- New tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.recover_debtors (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  display_name text NOT NULL,
  first_names text,
  last_name text,
  company_name text,
  id_type text,
  id_number_enc text,
  id_hash text,
  id_last4 text,
  id_key_version smallint,
  dob date,
  language text,
  representative_note text,
  status text NOT NULL DEFAULT 'active',
  merged_into_id uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT recover_debtors_kind_check CHECK (kind IN ('person', 'company')),
  CONSTRAINT recover_debtors_id_type_check CHECK (
    id_type IS NULL OR id_type IN ('sa_id', 'passport', 'company_reg', 'other')
  ),
  CONSTRAINT recover_debtors_status_check CHECK (status IN ('active', 'merged', 'archived')),
  CONSTRAINT recover_debtors_name_check CHECK (
    char_length(btrim(display_name)) >= 1 AND char_length(display_name) <= 200
  ),
  CONSTRAINT recover_debtors_last4_check CHECK (id_last4 IS NULL OR char_length(id_last4) <= 4),
  CONSTRAINT recover_debtors_rep_check CHECK (
    representative_note IS NULL OR char_length(representative_note) <= 500
  )
);

ALTER TABLE public.recover_debtors DROP CONSTRAINT IF EXISTS recover_debtors_merged_into_fkey;
ALTER TABLE public.recover_debtors
  ADD CONSTRAINT recover_debtors_merged_into_fkey
  FOREIGN KEY (merged_into_id) REFERENCES public.recover_debtors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recover_debtors_company
  ON public.recover_debtors (company_id, status);

CREATE INDEX IF NOT EXISTS idx_recover_debtors_id_hash
  ON public.recover_debtors (company_id, id_hash)
  WHERE id_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recover_debtors_name_prefix
  ON public.recover_debtors (company_id, lower(display_name) text_pattern_ops);

CREATE TABLE IF NOT EXISTS public.recover_batches (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creditor_id uuid NOT NULL REFERENCES public.recover_creditors(id) ON DELETE CASCADE,
  mandate_id uuid NOT NULL REFERENCES public.recover_mandates(id) ON DELETE CASCADE,
  source text NOT NULL,
  file_name text NOT NULL,
  file_sha256 text NOT NULL,
  row_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_report jsonb NOT NULL DEFAULT '[]'::jsonb,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'validating',
  imported_by text,
  imported_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT recover_batches_source_check CHECK (source IN ('csv', 'manual', 'demo')),
  CONSTRAINT recover_batches_status_check CHECK (
    status IN ('validating', 'imported', 'rejected', 'rolled_back')
  ),
  CONSTRAINT recover_batches_file_check CHECK (
    char_length(file_name) BETWEEN 1 AND 120
    AND position('/' IN file_name) = 0
    AND position('\' IN file_name) = 0
  ),
  CONSTRAINT recover_batches_sha_check CHECK (file_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_recover_batches_company
  ON public.recover_batches (company_id, creditor_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_recover_batches_imported_file
  ON public.recover_batches (company_id, creditor_id, file_sha256)
  WHERE status = 'imported';

CREATE TABLE IF NOT EXISTS public.recover_contact_points (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  debtor_id uuid NOT NULL REFERENCES public.recover_debtors(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.recover_batches(id) ON DELETE SET NULL,
  kind text NOT NULL,
  value text NOT NULL,
  source text NOT NULL,
  verified_at timestamptz,
  quality text NOT NULL DEFAULT 'unknown',
  consent jsonb NOT NULL DEFAULT '{"phone":false,"email":false,"whatsapp":false,"sms":false}'::jsonb,
  do_not_contact boolean NOT NULL DEFAULT false,
  s129_delivery_method text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT recover_contacts_kind_check CHECK (
    kind IN ('phone', 'whatsapp', 'email', 'address', 'employer')
  ),
  CONSTRAINT recover_contacts_value_check CHECK (char_length(value) BETWEEN 1 AND 320),
  CONSTRAINT recover_contacts_source_check CHECK (
    source IN ('creditor', 'debtor', 'trace', 'import', 'manual')
  ),
  CONSTRAINT recover_contacts_quality_check CHECK (
    quality IN ('unknown', 'good', 'poor', 'wrong')
  ),
  CONSTRAINT recover_contacts_s129_check CHECK (
    s129_delivery_method IS NULL
    OR (
      kind = 'address'
      AND s129_delivery_method IN ('registered_mail', 'hand_delivery')
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_recover_contacts_company
  ON public.recover_contact_points (company_id, debtor_id);

CREATE TABLE IF NOT EXISTS public.recover_accounts (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ref text NOT NULL,
  batch_id uuid REFERENCES public.recover_batches(id) ON DELETE SET NULL,
  creditor_id uuid NOT NULL REFERENCES public.recover_creditors(id) ON DELETE CASCADE,
  mandate_id uuid NOT NULL REFERENCES public.recover_mandates(id) ON DELETE CASCADE,
  debtor_id uuid NOT NULL REFERENCES public.recover_debtors(id) ON DELETE CASCADE,
  creditor_account_ref text NOT NULL,
  product_type text NOT NULL,
  nca_regulated boolean NOT NULL,
  original_cents bigint NOT NULL,
  principal_cents bigint NOT NULL,
  interest_cents bigint NOT NULL DEFAULT 0,
  fees_cents bigint NOT NULL DEFAULT 0,
  costs_cents bigint NOT NULL DEFAULT 0,
  adjustment_cents bigint NOT NULL DEFAULT 0,
  balance_cents bigint GENERATED ALWAYS AS (
    principal_cents + interest_cents + fees_cents + costs_cents + adjustment_cents
  ) STORED,
  currency text NOT NULL DEFAULT 'ZAR',
  default_date date,
  last_payment_at timestamptz,
  stage_key text NOT NULL DEFAULT 'placed',
  state text NOT NULL DEFAULT 'active',
  flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_to uuid REFERENCES public.recover_staff(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.recover_teams(id) ON DELETE SET NULL,
  placed_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  recalled_at timestamptz,
  close_reason text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT recover_accounts_money_check CHECK (
    original_cents >= 0
    AND principal_cents >= 0
    AND interest_cents >= 0
    AND fees_cents >= 0
    AND costs_cents >= 0
    AND balance_cents >= 0
  ),
  CONSTRAINT recover_accounts_currency_check CHECK (currency = 'ZAR'),
  CONSTRAINT recover_accounts_ref_check CHECK (
    char_length(creditor_account_ref) BETWEEN 1 AND 80
  ),
  CONSTRAINT recover_accounts_state_check CHECK (
    state IN (
      'active', 'arrangement', 'dispute', 'legal', 'paid',
      'recalled', 'closed', 'prescribed', 'stopped'
    )
  ),
  CONSTRAINT recover_accounts_product_check CHECK (
    product_type IN ('nca_credit', 'trade', 'levy', 'rent', 'medical', 'utility', 'other')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_recover_accounts_ref
  ON public.recover_accounts (company_id, ref);

CREATE UNIQUE INDEX IF NOT EXISTS uq_recover_accounts_placement
  ON public.recover_accounts (company_id, creditor_id, lower(creditor_account_ref));

CREATE INDEX IF NOT EXISTS idx_recover_accounts_state
  ON public.recover_accounts (company_id, state, placed_at DESC);

CREATE INDEX IF NOT EXISTS idx_recover_accounts_assigned
  ON public.recover_accounts (company_id, assigned_to, state);

CREATE INDEX IF NOT EXISTS idx_recover_accounts_creditor
  ON public.recover_accounts (company_id, creditor_id);

CREATE INDEX IF NOT EXISTS idx_recover_accounts_batch
  ON public.recover_accounts (company_id, batch_id);

CREATE INDEX IF NOT EXISTS idx_recover_accounts_debtor
  ON public.recover_accounts (company_id, debtor_id);

CREATE TABLE IF NOT EXISTS public.recover_account_events (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  company_id bigint REFERENCES public.profiles(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.recover_accounts(id) ON DELETE SET NULL,
  type text NOT NULL,
  actor_kind text NOT NULL,
  actor_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  note_text text,
  at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT recover_events_type_check CHECK (
    type IN ('import', 'note', 'assign', 'flag', 'adjust', 'recall', 'merge', 'view_sensitive')
  ),
  CONSTRAINT recover_events_actor_check CHECK (actor_kind IN ('staff', 'system')),
  CONSTRAINT recover_events_note_check CHECK (
    (type = 'note' AND note_text IS NOT NULL AND char_length(note_text) BETWEEN 1 AND 2000)
    OR (type <> 'note' AND note_text IS NULL)
  ),
  CONSTRAINT recover_events_payload_check CHECK (
    pg_catalog.octet_length(payload::text) <= 4000
  )
);

CREATE INDEX IF NOT EXISTS idx_recover_events_account
  ON public.recover_account_events (account_id, at);

CREATE INDEX IF NOT EXISTS idx_recover_events_company
  ON public.recover_account_events (company_id, at DESC);

CREATE TABLE IF NOT EXISTS public.recover_counters (
  company_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  value bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.recover_erase_guard (
  id integer PRIMARY KEY,
  token text
);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recover_forbid_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_token text;
  v_guard text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_token := NULLIF(pg_catalog.current_setting('recover.erase_token', true), '');
    IF v_token IS NOT NULL THEN
      SELECT g.token INTO v_guard FROM public.recover_erase_guard AS g WHERE g.id = 1;
      IF v_guard IS NOT NULL AND pg_catalog.length(v_guard) >= 32 AND v_token = v_guard THEN
        RETURN OLD;
      END IF;
    END IF;
    RAISE EXCEPTION 'append-only' USING ERRCODE = '55000';
  END IF;
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

CREATE OR REPLACE FUNCTION public.recover_forbid_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_token text;
  v_guard text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_token := NULLIF(pg_catalog.current_setting('recover.erase_token', true), '');
    IF v_token IS NOT NULL THEN
      SELECT g.token INTO v_guard FROM public.recover_erase_guard AS g WHERE g.id = 1;
      IF v_guard IS NOT NULL AND pg_catalog.length(v_guard) >= 32 AND v_token = v_guard THEN
        RETURN OLD;
      END IF;
    END IF;
    RAISE EXCEPTION 'append-only' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE'
     AND pg_catalog.pg_trigger_depth() > 1
     AND NEW.id = OLD.id
     AND NEW.type = OLD.type
     AND NEW.actor_kind = OLD.actor_kind
     AND NEW.actor_id IS NOT DISTINCT FROM OLD.actor_id
     AND NEW.payload = OLD.payload
     AND NEW.note_text IS NOT DISTINCT FROM OLD.note_text
     AND NEW.at = OLD.at
     AND (
       NEW.company_id IS NOT DISTINCT FROM OLD.company_id
       OR (OLD.company_id IS NOT NULL AND NEW.company_id IS NULL)
     )
     AND (
       NEW.account_id IS NOT DISTINCT FROM OLD.account_id
       OR (OLD.account_id IS NOT NULL AND NEW.account_id IS NULL)
     )
     AND (
       NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.account_id IS DISTINCT FROM OLD.account_id
     ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'append-only' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS recover_account_events_append_only ON public.recover_account_events;
CREATE TRIGGER recover_account_events_append_only
  BEFORE UPDATE OR DELETE ON public.recover_account_events
  FOR EACH ROW
  EXECUTE FUNCTION public.recover_forbid_event_mutation();

DROP TRIGGER IF EXISTS recover_account_events_no_truncate ON public.recover_account_events;
CREATE TRIGGER recover_account_events_no_truncate
  BEFORE TRUNCATE ON public.recover_account_events
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.recover_forbid_truncate();

CREATE OR REPLACE FUNCTION public.recover_accounts_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  k text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.nca_regulated IS DISTINCT FROM OLD.nca_regulated
       OR NEW.product_type IS DISTINCT FROM OLD.product_type THEN
      RAISE EXCEPTION 'immutable_placement' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF pg_catalog.jsonb_typeof(NEW.flags) <> 'object' THEN
    RAISE EXCEPTION 'flags' USING ERRCODE = '22023';
  END IF;
  FOR k IN SELECT pg_catalog.jsonb_object_keys(NEW.flags)
  LOOP
    IF k NOT IN (
      'debt_review', 'deceased', 'insolvency', 'represented', 'dispute', 'do_not_contact'
    ) THEN
      RAISE EXCEPTION 'flag_key' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recover_accounts_guard ON public.recover_accounts;
CREATE TRIGGER recover_accounts_guard
  BEFORE INSERT OR UPDATE ON public.recover_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.recover_accounts_guard();

CREATE OR REPLACE FUNCTION public.recover_next_number(p_company_id bigint, p_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v bigint;
BEGIN
  IF p_company_id IS NULL OR p_company_id <= 0 OR p_name IS NULL OR pg_catalog.btrim(p_name) = '' THEN
    RAISE EXCEPTION 'closed' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.recover_counters AS c (company_id, name, value)
  VALUES (p_company_id, p_name, 1)
  ON CONFLICT (company_id, name) DO UPDATE
    SET value = c.value + 1, updated_at = pg_catalog.now()
  RETURNING value INTO v;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_demo_rows_exist(p_company_id bigint)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_company_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.recover_debtors WHERE company_id = p_company_id AND is_demo)
    OR EXISTS (SELECT 1 FROM public.recover_accounts WHERE company_id = p_company_id AND is_demo)
    OR EXISTS (SELECT 1 FROM public.recover_contact_points WHERE company_id = p_company_id AND is_demo)
    OR EXISTS (SELECT 1 FROM public.recover_batches WHERE company_id = p_company_id AND is_demo);
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_block_real_while_demo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.real_data_enabled IS TRUE AND OLD.real_data_enabled IS NOT TRUE THEN
    IF public.recover_demo_rows_exist(NEW.company_id) THEN
      RAISE EXCEPTION 'Clear the demo book first' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recover_workspaces_block_real_while_demo ON public.recover_workspaces;
CREATE TRIGGER recover_workspaces_block_real_while_demo
  BEFORE UPDATE ON public.recover_workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.recover_block_real_while_demo();

CREATE OR REPLACE FUNCTION public.recover_open_erase_token()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := pg_catalog.gen_random_uuid()::text || pg_catalog.gen_random_uuid()::text;
  INSERT INTO public.recover_erase_guard (id, token) VALUES (1, v_token)
  ON CONFLICT (id) DO UPDATE SET token = EXCLUDED.token;
  PERFORM pg_catalog.set_config('recover.erase_token', v_token, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_close_erase_token()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.recover_erase_guard SET token = NULL WHERE id = 1;
  PERFORM pg_catalog.set_config('recover.erase_token', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_write_audit(
  p_company_id bigint,
  p_actor_id text,
  p_action text,
  p_target text,
  p_payload jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.recover_audit_log (company_id, actor_kind, actor_id, action, target, payload)
  VALUES (
    p_company_id,
    'staff',
    p_actor_id,
    p_action,
    p_target,
    COALESCE(p_payload, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_write_event(
  p_company_id bigint,
  p_account_id uuid,
  p_type text,
  p_actor_id text,
  p_payload jsonb,
  p_note text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.recover_account_events (
    company_id, account_id, type, actor_kind, actor_id, payload, note_text
  ) VALUES (
    p_company_id,
    p_account_id,
    p_type,
    'staff',
    p_actor_id,
    COALESCE(p_payload, '{}'::jsonb),
    p_note
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_book_commit(
  p_company_id bigint,
  p_actor_id text,
  p_action text,
  p_target text,
  p_patch jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_found integer;
  v_updated timestamptz;
  v_expected timestamptz;
  v_name text;
  v_email text;
  v_customer bigint;
  v_status text;
  v_creditor uuid;
  v_mandate uuid;
  v_debtor uuid;
  v_source uuid;
  v_staff uuid;
  v_team uuid;
  v_flag text;
  v_reason text;
  v_note text;
  v_cents bigint;
  v_ref text;
  v_nca boolean;
  v_product text;
  v_operator text;
  v_block boolean;
  v_reg text;
  v_expires date;
  v_role text;
  v_staff_status text;
  v_today date;
  v_flags jsonb;
  v_balance bigint;
BEGIN
  IF p_company_id IS NULL OR p_company_id <= 0 OR p_action IS NULL OR p_patch IS NULL
     OR pg_catalog.jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'closed' USING ERRCODE = '22023';
  END IF;
  IF p_patch ? 'company_id' THEN
    RAISE EXCEPTION 'company_id_refused' USING ERRCODE = '22023';
  END IF;
  IF p_action NOT IN (
    'creditor.upsert', 'creditor.archive', 'mandate.upsert', 'mandate.set_status',
    'debtor.upsert', 'contact_point.upsert', 'contact_point.remove',
    'account.create', 'account.assign', 'account.set_flag', 'account.clear_flag',
    'account.add_note', 'account.recall', 'account.adjust', 'debtor.merge', 'account.reveal_id'
  ) THEN
    RAISE EXCEPTION 'unsupported' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.profiles WHERE id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'company' USING ERRCODE = '22023';
  END IF;

  IF p_patch ? 'expected_updated_at' AND NULLIF(p_patch->>'expected_updated_at', '') IS NOT NULL THEN
    v_expected := (p_patch->>'expected_updated_at')::timestamptz;
  END IF;

  IF p_action = 'creditor.upsert' THEN
    v_name := pg_catalog.btrim(COALESCE(p_patch->>'name', ''));
    IF v_name = '' OR char_length(v_name) > 200 THEN
      RAISE EXCEPTION 'name' USING ERRCODE = '22023';
    END IF;
    v_email := NULLIF(lower(pg_catalog.btrim(COALESCE(p_patch->>'contact_email', ''))), '');
    v_customer := NULLIF(p_patch->>'customer_id', '')::bigint;
    IF v_customer IS NOT NULL THEN
      PERFORM 1 FROM public.customers WHERE id = v_customer AND profile_id = p_company_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'customer_company' USING ERRCODE = '23503';
      END IF;
    END IF;
    IF NULLIF(p_patch->>'id', '') IS NOT NULL THEN
      v_id := (p_patch->>'id')::uuid;
      SELECT updated_at INTO v_updated FROM public.recover_creditors
      WHERE id = v_id AND company_id = p_company_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
      END IF;
      IF v_expected IS NOT NULL AND v_updated IS DISTINCT FROM v_expected THEN
        RAISE EXCEPTION 'conflict' USING ERRCODE = '40001';
      END IF;
      UPDATE public.recover_creditors SET
        name = v_name,
        reg_no = COALESCE(p_patch->>'reg_no', reg_no),
        vat_no = COALESCE(p_patch->>'vat_no', vat_no),
        remittance_terms = COALESCE(NULLIF(p_patch->>'remittance_terms', ''), remittance_terms),
        contact_name = COALESCE(p_patch->>'contact_name', contact_name),
        contact_email = v_email,
        contact_phone = NULLIF(p_patch->>'contact_phone', ''),
        notes = NULLIF(p_patch->>'notes', ''),
        customer_id = CASE WHEN p_patch ? 'customer_id' THEN v_customer ELSE customer_id END,
        updated_at = pg_catalog.now()
      WHERE id = v_id AND company_id = p_company_id;
    ELSE
      INSERT INTO public.recover_creditors (
        company_id, customer_id, name, reg_no, vat_no, remittance_terms,
        contact_name, contact_email, contact_phone, notes, status, updated_at
      ) VALUES (
        p_company_id,
        v_customer,
        v_name,
        COALESCE(p_patch->>'reg_no', ''),
        COALESCE(p_patch->>'vat_no', ''),
        COALESCE(NULLIF(p_patch->>'remittance_terms', ''), 'monthly'),
        NULLIF(p_patch->>'contact_name', ''),
        v_email,
        NULLIF(p_patch->>'contact_phone', ''),
        NULLIF(p_patch->>'notes', ''),
        'active',
        pg_catalog.now()
      ) RETURNING id INTO v_id;
    END IF;
    PERFORM public.recover_write_audit(
      p_company_id, p_actor_id, p_action, v_id::text,
      pg_catalog.jsonb_build_object('creditor_id', v_id)
    );
    RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_id);

  ELSIF p_action = 'creditor.archive' THEN
    v_id := NULLIF(p_patch->>'id', '')::uuid;
    SELECT updated_at INTO v_updated FROM public.recover_creditors
    WHERE id = v_id AND company_id = p_company_id;
    GET DIAGNOSTICS v_found = ROW_COUNT;
    IF v_updated IS NULL AND v_found = 0 THEN
      RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
    END IF;
    IF v_expected IS NOT NULL AND v_updated IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'conflict' USING ERRCODE = '40001';
    END IF;
    UPDATE public.recover_creditors
    SET archived_at = pg_catalog.now(), status = 'inactive', updated_at = pg_catalog.now()
    WHERE id = v_id AND company_id = p_company_id;
    PERFORM public.recover_write_audit(
      p_company_id, p_actor_id, p_action, v_id::text,
      pg_catalog.jsonb_build_object('creditor_id', v_id)
    );
    RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_id);

  ELSIF p_action = 'mandate.upsert' THEN
    v_creditor := NULLIF(p_patch->>'creditor_id', '')::uuid;
    PERFORM 1 FROM public.recover_creditors
    WHERE id = v_creditor AND company_id = p_company_id AND archived_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'creditor' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(NULLIF(p_patch->>'programme_type', ''), 'recovery') <> 'recovery' THEN
      RAISE EXCEPTION 'programme' USING ERRCODE = '22023';
    END IF;
    v_status := COALESCE(NULLIF(p_patch->>'status', ''), 'draft');
    IF NULLIF(p_patch->>'id', '') IS NOT NULL THEN
      v_id := (p_patch->>'id')::uuid;
      SELECT updated_at INTO v_updated FROM public.recover_mandates
      WHERE id = v_id AND company_id = p_company_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
      END IF;
      IF v_expected IS NOT NULL AND v_updated IS DISTINCT FROM v_expected THEN
        RAISE EXCEPTION 'conflict' USING ERRCODE = '40001';
      END IF;
      UPDATE public.recover_mandates SET
        creditor_id = v_creditor,
        programme_type = 'recovery',
        product_type = COALESCE(NULLIF(p_patch->>'product_type', ''), product_type),
        nca_regulated = CASE WHEN p_patch ? 'nca_regulated' THEN (p_patch->>'nca_regulated')::boolean ELSE nca_regulated END,
        processing_role = COALESCE(NULLIF(p_patch->>'processing_role', ''), processing_role),
        authority_to_litigate = CASE WHEN p_patch ? 'authority_to_litigate' THEN (p_patch->>'authority_to_litigate')::boolean ELSE authority_to_litigate END,
        bureau_authority = CASE WHEN p_patch ? 'bureau_authority' THEN (p_patch->>'bureau_authority')::boolean ELSE bureau_authority END,
        retention_months = CASE
          WHEN p_patch ? 'retention_months' AND NULLIF(p_patch->>'retention_months', '') IS NULL THEN NULL
          WHEN p_patch ? 'retention_months' THEN (p_patch->>'retention_months')::integer
          ELSE retention_months
        END,
        start_on = CASE WHEN p_patch ? 'start_on' THEN NULLIF(p_patch->>'start_on', '')::date ELSE start_on END,
        end_on = CASE WHEN p_patch ? 'end_on' THEN NULLIF(p_patch->>'end_on', '')::date ELSE end_on END,
        commission_model = CASE WHEN p_patch ? 'commission_model' THEN p_patch->'commission_model' ELSE commission_model END,
        allocation_order = CASE WHEN p_patch ? 'allocation_order' THEN p_patch->'allocation_order' ELSE allocation_order END,
        agreement_reference = CASE WHEN p_patch ? 'agreement_reference' THEN NULLIF(p_patch->>'agreement_reference', '') ELSE agreement_reference END,
        signed_on = CASE WHEN p_patch ? 'signed_on' THEN NULLIF(p_patch->>'signed_on', '')::date ELSE signed_on END,
        status = v_status,
        updated_at = pg_catalog.now()
      WHERE id = v_id AND company_id = p_company_id;
    ELSE
      INSERT INTO public.recover_mandates (
        company_id, creditor_id, programme_type, product_type, nca_regulated, processing_role,
        authority_to_litigate, bureau_authority, retention_months, start_on, end_on, status,
        commission_model, allocation_order, agreement_reference, signed_on, updated_at
      ) VALUES (
        p_company_id,
        v_creditor,
        'recovery',
        p_patch->>'product_type',
        COALESCE((p_patch->>'nca_regulated')::boolean, false),
        COALESCE(NULLIF(p_patch->>'processing_role', ''), 'operator'),
        COALESCE((p_patch->>'authority_to_litigate')::boolean, false),
        COALESCE((p_patch->>'bureau_authority')::boolean, false),
        NULLIF(p_patch->>'retention_months', '')::integer,
        NULLIF(p_patch->>'start_on', '')::date,
        NULLIF(p_patch->>'end_on', '')::date,
        v_status,
        COALESCE(p_patch->'commission_model', '{}'::jsonb),
        COALESCE(p_patch->'allocation_order', '["costs","interest","fees","principal"]'::jsonb),
        NULLIF(p_patch->>'agreement_reference', ''),
        NULLIF(p_patch->>'signed_on', '')::date,
        pg_catalog.now()
      ) RETURNING id INTO v_id;
    END IF;
    PERFORM public.recover_write_audit(
      p_company_id, p_actor_id, p_action, v_id::text,
      pg_catalog.jsonb_build_object('mandate_id', v_id, 'creditor_id', v_creditor, 'status', v_status)
    );
    RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_id);

  ELSIF p_action = 'mandate.set_status' THEN
    v_id := NULLIF(p_patch->>'id', '')::uuid;
    v_status := p_patch->>'status';
    SELECT updated_at INTO v_updated FROM public.recover_mandates
    WHERE id = v_id AND company_id = p_company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
    END IF;
    IF v_expected IS NOT NULL AND v_updated IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'conflict' USING ERRCODE = '40001';
    END IF;
    UPDATE public.recover_mandates SET
      status = v_status,
      agreement_reference = CASE WHEN p_patch ? 'agreement_reference' THEN NULLIF(p_patch->>'agreement_reference', '') ELSE agreement_reference END,
      signed_on = CASE WHEN p_patch ? 'signed_on' THEN NULLIF(p_patch->>'signed_on', '')::date ELSE signed_on END,
      updated_at = pg_catalog.now()
    WHERE id = v_id AND company_id = p_company_id;
    PERFORM public.recover_write_audit(
      p_company_id, p_actor_id, p_action, v_id::text,
      pg_catalog.jsonb_build_object('mandate_id', v_id, 'status', v_status)
    );
    RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_id);

  ELSIF p_action = 'debtor.upsert' THEN
    v_name := pg_catalog.btrim(COALESCE(p_patch->>'display_name', ''));
    IF v_name = '' OR char_length(v_name) > 200 THEN
      RAISE EXCEPTION 'name' USING ERRCODE = '22023';
    END IF;
    IF p_patch ? 'id_number' OR p_patch ? 'passport' THEN
      RAISE EXCEPTION 'plaintext_id' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(p_patch->>'id', '') IS NOT NULL THEN
      v_id := (p_patch->>'id')::uuid;
      SELECT updated_at INTO v_updated FROM public.recover_debtors
      WHERE id = v_id AND company_id = p_company_id AND status <> 'merged';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
      END IF;
      IF v_expected IS NOT NULL AND v_updated IS DISTINCT FROM v_expected THEN
        RAISE EXCEPTION 'conflict' USING ERRCODE = '40001';
      END IF;
      UPDATE public.recover_debtors SET
        kind = COALESCE(NULLIF(p_patch->>'kind', ''), kind),
        display_name = v_name,
        first_names = CASE WHEN p_patch ? 'first_names' THEN NULLIF(p_patch->>'first_names', '') ELSE first_names END,
        last_name = CASE WHEN p_patch ? 'last_name' THEN NULLIF(p_patch->>'last_name', '') ELSE last_name END,
        company_name = CASE WHEN p_patch ? 'company_name' THEN NULLIF(p_patch->>'company_name', '') ELSE company_name END,
        id_type = CASE WHEN p_patch ? 'id_type' THEN NULLIF(p_patch->>'id_type', '') ELSE id_type END,
        id_number_enc = CASE WHEN p_patch ? 'id_number_enc' THEN NULLIF(p_patch->>'id_number_enc', '') ELSE id_number_enc END,
        id_hash = CASE WHEN p_patch ? 'id_hash' THEN NULLIF(p_patch->>'id_hash', '') ELSE id_hash END,
        id_last4 = CASE WHEN p_patch ? 'id_last4' THEN NULLIF(p_patch->>'id_last4', '') ELSE id_last4 END,
        id_key_version = CASE WHEN p_patch ? 'id_key_version' THEN NULLIF(p_patch->>'id_key_version', '')::smallint ELSE id_key_version END,
        dob = CASE WHEN p_patch ? 'dob' THEN NULLIF(p_patch->>'dob', '')::date ELSE dob END,
        language = CASE WHEN p_patch ? 'language' THEN NULLIF(p_patch->>'language', '') ELSE language END,
        representative_note = CASE WHEN p_patch ? 'representative_note' THEN NULLIF(p_patch->>'representative_note', '') ELSE representative_note END,
        is_demo = CASE WHEN p_patch ? 'is_demo' THEN (p_patch->>'is_demo')::boolean ELSE is_demo END,
        updated_at = pg_catalog.now()
      WHERE id = v_id AND company_id = p_company_id;
    ELSE
      INSERT INTO public.recover_debtors (
        company_id, kind, display_name, first_names, last_name, company_name, id_type,
        id_number_enc, id_hash, id_last4, id_key_version, dob, language, representative_note,
        status, is_demo, updated_at
      ) VALUES (
        p_company_id,
        COALESCE(NULLIF(p_patch->>'kind', ''), 'person'),
        v_name,
        NULLIF(p_patch->>'first_names', ''),
        NULLIF(p_patch->>'last_name', ''),
        NULLIF(p_patch->>'company_name', ''),
        NULLIF(p_patch->>'id_type', ''),
        NULLIF(p_patch->>'id_number_enc', ''),
        NULLIF(p_patch->>'id_hash', ''),
        NULLIF(p_patch->>'id_last4', ''),
        NULLIF(p_patch->>'id_key_version', '')::smallint,
        NULLIF(p_patch->>'dob', '')::date,
        NULLIF(p_patch->>'language', ''),
        NULLIF(p_patch->>'representative_note', ''),
        'active',
        COALESCE((p_patch->>'is_demo')::boolean, false),
        pg_catalog.now()
      ) RETURNING id INTO v_id;
    END IF;
    PERFORM public.recover_write_audit(
      p_company_id, p_actor_id, p_action, v_id::text,
      pg_catalog.jsonb_build_object('debtor_id', v_id)
    );
    RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_id);

  ELSIF p_action = 'contact_point.upsert' THEN
    v_debtor := NULLIF(p_patch->>'debtor_id', '')::uuid;
    PERFORM 1 FROM public.recover_debtors WHERE id = v_debtor AND company_id = p_company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'debtor' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(p_patch->>'id', '') IS NOT NULL THEN
      v_id := (p_patch->>'id')::uuid;
      SELECT updated_at INTO v_updated FROM public.recover_contact_points
      WHERE id = v_id AND company_id = p_company_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
      END IF;
      IF v_expected IS NOT NULL AND v_updated IS DISTINCT FROM v_expected THEN
        RAISE EXCEPTION 'conflict' USING ERRCODE = '40001';
      END IF;
      UPDATE public.recover_contact_points SET
        debtor_id = v_debtor,
        kind = COALESCE(NULLIF(p_patch->>'kind', ''), kind),
        value = COALESCE(NULLIF(p_patch->>'value', ''), value),
        source = COALESCE(NULLIF(p_patch->>'source', ''), source),
        quality = COALESCE(NULLIF(p_patch->>'quality', ''), quality),
        consent = CASE WHEN p_patch ? 'consent' THEN p_patch->'consent' ELSE consent END,
        do_not_contact = CASE WHEN p_patch ? 'do_not_contact' THEN (p_patch->>'do_not_contact')::boolean ELSE do_not_contact END,
        s129_delivery_method = CASE WHEN p_patch ? 's129_delivery_method' THEN NULLIF(p_patch->>'s129_delivery_method', '') ELSE s129_delivery_method END,
        updated_at = pg_catalog.now()
      WHERE id = v_id AND company_id = p_company_id;
    ELSE
      INSERT INTO public.recover_contact_points (
        company_id, debtor_id, kind, value, source, quality, consent, do_not_contact,
        s129_delivery_method, is_demo, updated_at
      ) VALUES (
        p_company_id,
        v_debtor,
        p_patch->>'kind',
        p_patch->>'value',
        COALESCE(NULLIF(p_patch->>'source', ''), 'manual'),
        COALESCE(NULLIF(p_patch->>'quality', ''), 'unknown'),
        COALESCE(p_patch->'consent', '{"phone":false,"email":false,"whatsapp":false,"sms":false}'::jsonb),
        COALESCE((p_patch->>'do_not_contact')::boolean, false),
        NULLIF(p_patch->>'s129_delivery_method', ''),
        COALESCE((p_patch->>'is_demo')::boolean, false),
        pg_catalog.now()
      ) RETURNING id INTO v_id;
    END IF;
    PERFORM public.recover_write_audit(
      p_company_id, p_actor_id, p_action, v_id::text,
      pg_catalog.jsonb_build_object('contact_id', v_id, 'debtor_id', v_debtor, 'kind', p_patch->>'kind')
    );
    RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_id);

  ELSIF p_action = 'contact_point.remove' THEN
    v_id := NULLIF(p_patch->>'id', '')::uuid;
    DELETE FROM public.recover_contact_points
    WHERE id = v_id AND company_id = p_company_id;
    GET DIAGNOSTICS v_found = ROW_COUNT;
    IF v_found = 0 THEN
      RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
    END IF;
    PERFORM public.recover_write_audit(
      p_company_id, p_actor_id, p_action, v_id::text,
      pg_catalog.jsonb_build_object('contact_id', v_id)
    );
    RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_id);

  ELSIF p_action = 'account.create' THEN
    v_creditor := NULLIF(p_patch->>'creditor_id', '')::uuid;
    v_mandate := NULLIF(p_patch->>'mandate_id', '')::uuid;
    v_debtor := NULLIF(p_patch->>'debtor_id', '')::uuid;
    SELECT m.nca_regulated, m.product_type INTO v_nca, v_product
    FROM public.recover_mandates m
    JOIN public.recover_creditors c ON c.id = m.creditor_id AND c.company_id = m.company_id
    WHERE m.id = v_mandate AND m.company_id = p_company_id AND m.creditor_id = v_creditor
      AND m.status = 'active' AND c.archived_at IS NULL AND c.status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'mandate' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.recover_debtors WHERE id = v_debtor AND company_id = p_company_id AND status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'debtor' USING ERRCODE = '22023';
    END IF;
    v_ref := 'RC-' || pg_catalog.lpad(public.recover_next_number(p_company_id, 'account')::text, 6, '0');
    INSERT INTO public.recover_accounts (
      company_id, ref, creditor_id, mandate_id, debtor_id, creditor_account_ref,
      product_type, nca_regulated, original_cents, principal_cents, interest_cents,
      fees_cents, costs_cents, adjustment_cents, default_date, is_demo, updated_at
    ) VALUES (
      p_company_id,
      v_ref,
      v_creditor,
      v_mandate,
      v_debtor,
      pg_catalog.btrim(p_patch->>'creditor_account_ref'),
      v_product,
      v_nca,
      (p_patch->>'original_cents')::bigint,
      (p_patch->>'principal_cents')::bigint,
      COALESCE((p_patch->>'interest_cents')::bigint, 0),
      COALESCE((p_patch->>'fees_cents')::bigint, 0),
      COALESCE((p_patch->>'costs_cents')::bigint, 0),
      0,
      NULLIF(p_patch->>'default_date', '')::date,
      COALESCE((p_patch->>'is_demo')::boolean, false),
      pg_catalog.now()
    ) RETURNING id INTO v_id;
    PERFORM public.recover_write_event(
      p_company_id, v_id, 'import', p_actor_id,
      pg_catalog.jsonb_build_object('via', 'manual'),
      NULL
    );
    PERFORM public.recover_write_audit(
      p_company_id, p_actor_id, p_action, v_id::text,
      pg_catalog.jsonb_build_object('account_id', v_id, 'ref', v_ref)
    );
    RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_id, 'ref', v_ref);

  ELSIF p_action = 'account.assign' THEN
    v_id := NULLIF(p_patch->>'id', '')::uuid;
    v_staff := NULLIF(p_patch->>'staff_id', '')::uuid;
    v_team := NULLIF(p_patch->>'team_id', '')::uuid;
    SELECT updated_at INTO v_updated FROM public.recover_accounts
    WHERE id = v_id AND company_id = p_company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
    END IF;
    IF v_expected IS NOT NULL AND v_updated IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'conflict' USING ERRCODE = '40001';
    END IF;
    IF v_staff IS NOT NULL THEN
      SELECT role, status, cfdc_registration_no, registration_expires_on
        INTO v_role, v_staff_status, v_reg, v_expires
      FROM public.recover_staff
      WHERE id = v_staff AND company_id = p_company_id;
      IF NOT FOUND OR v_staff_status <> 'active' THEN
        RAISE EXCEPTION 'staff' USING ERRCODE = '22023';
      END IF;
      SELECT operator_type, block_unregistered_assignment INTO v_operator, v_block
      FROM public.recover_workspaces WHERE company_id = p_company_id;
      v_today := COALESCE(NULLIF(p_patch->>'as_of', '')::date, (pg_catalog.now() AT TIME ZONE 'Africa/Johannesburg')::date);
      IF v_operator = 'agency' AND v_block IS TRUE AND v_role = 'collector' THEN
        IF v_reg IS NULL OR pg_catalog.btrim(v_reg) = '' THEN
          RAISE EXCEPTION 'registration_missing' USING ERRCODE = '23514';
        END IF;
        IF v_expires IS NOT NULL AND v_expires < v_today THEN
          RAISE EXCEPTION 'registration_expired' USING ERRCODE = '23514';
        END IF;
      END IF;
    END IF;
    IF v_team IS NOT NULL THEN
      PERFORM 1 FROM public.recover_teams WHERE id = v_team AND company_id = p_company_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'team' USING ERRCODE = '22023';
      END IF;
    END IF;
    UPDATE public.recover_accounts
    SET assigned_to = v_staff, team_id = v_team, updated_at = pg_catalog.now()
    WHERE id = v_id AND company_id = p_company_id;
    PERFORM public.recover_write_event(
      p_company_id, v_id, 'assign', p_actor_id,
      pg_catalog.jsonb_build_object('staff_id', v_staff, 'team_id', v_team),
      NULL
    );
    PERFORM public.recover_write_audit(
      p_company_id, p_actor_id, p_action, v_id::text,
      pg_catalog.jsonb_build_object('account_id', v_id, 'staff_id', v_staff, 'team_id', v_team)
    );
    RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_id);

  ELSIF p_action = 'account.set_flag' OR p_action = 'account.clear_flag' THEN
    v_id := NULLIF(p_patch->>'id', '')::uuid;
    v_flag := p_patch->>'flag';
    v_reason := pg_catalog.btrim(COALESCE(p_patch->>'reason', ''));
    IF v_flag NOT IN ('debt_review', 'deceased', 'insolvency', 'represented', 'dispute', 'do_not_contact')
       OR v_reason = '' OR char_length(v_reason) > 500 THEN
      RAISE EXCEPTION 'flag' USING ERRCODE = '22023';
    END IF;
    SELECT updated_at, flags INTO v_updated, v_flags FROM public.recover_accounts
    WHERE id = v_id AND company_id = p_company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
    END IF;
    IF v_expected IS NOT NULL AND v_updated IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'conflict' USING ERRCODE = '40001';
    END IF;
    IF p_action = 'account.set_flag' THEN
      v_flags := COALESCE(v_flags, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        v_flag,
        pg_catalog.jsonb_build_object('set_at', pg_catalog.now(), 'set_by', p_actor_id, 'reason', v_reason)
      );
    ELSE
      v_flags := COALESCE(v_flags, '{}'::jsonb) - v_flag;
    END IF;
    UPDATE public.recover_accounts
    SET flags = v_flags, updated_at = pg_catalog.now()
    WHERE id = v_id AND company_id = p_company_id;
    PERFORM public.recover_write_event(
      p_company_id, v_id, 'flag', p_actor_id,
      pg_catalog.jsonb_build_object('flag', v_flag, 'op', CASE WHEN p_action = 'account.set_flag' THEN 'set' ELSE 'clear' END),
      NULL
    );
    PERFORM public.recover_write_audit(
      p_company_id, p_actor_id, p_action, v_id::text,
      pg_catalog.jsonb_build_object('account_id', v_id, 'flag', v_flag)
    );
    RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_id);

  ELSIF p_action = 'account.add_note' THEN
    v_id := NULLIF(p_patch->>'id', '')::uuid;
    v_note := pg_catalog.btrim(COALESCE(p_patch->>'note_text', ''));
    IF v_note = '' OR char_length(v_note) > 2000 THEN
      RAISE EXCEPTION 'note' USING ERRCODE = '22023';
    END IF;
    SELECT updated_at INTO v_updated FROM public.recover_accounts
    WHERE id = v_id AND company_id = p_company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
    END IF;
    IF v_expected IS NOT NULL AND v_updated IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'conflict' USING ERRCODE = '40001';
    END IF;
    UPDATE public.recover_accounts SET updated_at = pg_catalog.now()
    WHERE id = v_id AND company_id = p_company_id;
    PERFORM public.recover_write_event(p_company_id, v_id, 'note', p_actor_id, '{}'::jsonb, v_note);
    PERFORM public.recover_write_audit(
      p_company_id, p_actor_id, p_action, v_id::text,
      pg_catalog.jsonb_build_object('account_id', v_id)
    );
    RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_id);

  ELSIF p_action = 'account.recall' THEN
    v_id := NULLIF(p_patch->>'id', '')::uuid;
    SELECT updated_at, state INTO v_updated, v_status FROM public.recover_accounts
    WHERE id = v_id AND company_id = p_company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
    END IF;
    IF v_expected IS NOT NULL AND v_updated IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'conflict' USING ERRCODE = '40001';
    END IF;
    IF v_status <> 'active' THEN
      RAISE EXCEPTION 'state' USING ERRCODE = '22023';
    END IF;
    UPDATE public.recover_accounts
    SET state = 'recalled',
        recalled_at = pg_catalog.now(),
        close_reason = NULLIF(p_patch->>'close_reason', ''),
        updated_at = pg_catalog.now()
    WHERE id = v_id AND company_id = p_company_id;
    PERFORM public.recover_write_event(
      p_company_id, v_id, 'recall', p_actor_id, '{}'::jsonb, NULL
    );
    PERFORM public.recover_write_audit(
      p_company_id, p_actor_id, p_action, v_id::text,
      pg_catalog.jsonb_build_object('account_id', v_id)
    );
    RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_id);

  ELSIF p_action = 'account.adjust' THEN
    v_id := NULLIF(p_patch->>'id', '')::uuid;
    IF (p_patch->>'adjustment_cents') !~ '^-?[0-9]+$' THEN
      RAISE EXCEPTION 'amount' USING ERRCODE = '22023';
    END IF;
    v_cents := (p_patch->>'adjustment_cents')::bigint;
    SELECT updated_at,
           principal_cents + interest_cents + fees_cents + costs_cents + v_cents
      INTO v_updated, v_balance
    FROM public.recover_accounts
    WHERE id = v_id AND company_id = p_company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
    END IF;
    IF v_expected IS NOT NULL AND v_updated IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'conflict' USING ERRCODE = '40001';
    END IF;
    IF v_balance < 0 THEN
      RAISE EXCEPTION 'balance' USING ERRCODE = '22023';
    END IF;
    UPDATE public.recover_accounts
    SET adjustment_cents = v_cents, updated_at = pg_catalog.now()
    WHERE id = v_id AND company_id = p_company_id;
    PERFORM public.recover_write_event(
      p_company_id, v_id, 'adjust', p_actor_id,
      pg_catalog.jsonb_build_object('adjustment_cents', v_cents),
      NULL
    );
    PERFORM public.recover_write_audit(
      p_company_id, p_actor_id, p_action, v_id::text,
      pg_catalog.jsonb_build_object('account_id', v_id, 'adjustment_cents', v_cents)
    );
    RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_id);

  ELSIF p_action = 'debtor.merge' THEN
    v_source := NULLIF(p_patch->>'source_id', '')::uuid;
    v_debtor := NULLIF(p_patch->>'target_id', '')::uuid;
    IF v_source IS NULL OR v_debtor IS NULL OR v_source = v_debtor THEN
      RAISE EXCEPTION 'merge' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.recover_debtors
    WHERE id = v_source AND company_id = p_company_id AND status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
    END IF;
    PERFORM 1 FROM public.recover_debtors
    WHERE id = v_debtor AND company_id = p_company_id AND status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
    END IF;
    UPDATE public.recover_accounts
    SET debtor_id = v_debtor, updated_at = pg_catalog.now()
    WHERE company_id = p_company_id AND debtor_id = v_source;
    UPDATE public.recover_contact_points
    SET debtor_id = v_debtor, updated_at = pg_catalog.now()
    WHERE company_id = p_company_id AND debtor_id = v_source;
    UPDATE public.recover_debtors
    SET status = 'merged', merged_into_id = v_debtor, updated_at = pg_catalog.now()
    WHERE id = v_source AND company_id = p_company_id;
    FOR v_id IN
      SELECT id FROM public.recover_accounts
      WHERE company_id = p_company_id AND debtor_id = v_debtor
    LOOP
      PERFORM public.recover_write_event(
        p_company_id, v_id, 'merge', p_actor_id,
        pg_catalog.jsonb_build_object('source_id', v_source, 'target_id', v_debtor),
        NULL
      );
    END LOOP;
    PERFORM public.recover_write_audit(
      p_company_id, p_actor_id, p_action, v_debtor::text,
      pg_catalog.jsonb_build_object('source_id', v_source, 'target_id', v_debtor)
    );
    RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_debtor);

  ELSIF p_action = 'account.reveal_id' THEN
    v_id := NULLIF(p_patch->>'id', '')::uuid;
    PERFORM 1 FROM public.recover_accounts WHERE id = v_id AND company_id = p_company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
    END IF;
    IF (
      SELECT count(*) FROM public.recover_account_events
      WHERE company_id = p_company_id
        AND type = 'view_sensitive'
        AND actor_id = p_actor_id
        AND at > pg_catalog.now() - interval '1 hour'
    ) >= 20 THEN
      RAISE EXCEPTION 'throttled' USING ERRCODE = '22023';
    END IF;
    PERFORM public.recover_write_event(
      p_company_id, v_id, 'view_sensitive', p_actor_id,
      pg_catalog.jsonb_build_object('account_id', v_id),
      NULL
    );
    PERFORM public.recover_write_audit(
      p_company_id, p_actor_id, p_action, v_id::text,
      pg_catalog.jsonb_build_object('account_id', v_id)
    );
    RETURN pg_catalog.jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  RAISE EXCEPTION 'unsupported' USING ERRCODE = '22023';
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_import_commit(
  p_company_id bigint,
  p_actor_id text,
  p_batch jsonb,
  p_rows jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_creditor uuid;
  v_mandate uuid;
  v_sha text;
  v_file text;
  v_source text;
  v_demo boolean;
  v_real boolean;
  v_nca boolean;
  v_product text;
  v_batch uuid;
  v_row jsonb;
  v_debtor uuid;
  v_account uuid;
  v_ref text;
  v_hash text;
  v_name text;
  v_acc_ref text;
  v_seen text[] := ARRAY[]::text[];
  v_existing text[];
  v_created integer := 0;
  v_skipped integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_contact jsonb;
  v_n integer := 0;
  v_principal bigint;
  v_interest bigint;
  v_fees bigint;
  v_costs bigint;
  v_original bigint;
BEGIN
  IF p_company_id IS NULL OR p_batch IS NULL OR p_rows IS NULL
     OR pg_catalog.jsonb_typeof(p_batch) <> 'object'
     OR pg_catalog.jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'closed' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.jsonb_array_length(p_rows) < 1 OR pg_catalog.jsonb_array_length(p_rows) > 2000 THEN
    RAISE EXCEPTION 'row_cap' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.octet_length(p_rows::text) > 2500000 OR pg_catalog.octet_length(p_batch::text) > 200000 THEN
    RAISE EXCEPTION 'payload_cap' USING ERRCODE = '22023';
  END IF;
  v_creditor := NULLIF(p_batch->>'creditor_id', '')::uuid;
  v_mandate := NULLIF(p_batch->>'mandate_id', '')::uuid;
  v_sha := lower(COALESCE(p_batch->>'file_sha256', ''));
  v_file := pg_catalog.btrim(COALESCE(p_batch->>'file_name', ''));
  v_source := COALESCE(NULLIF(p_batch->>'source', ''), 'csv');
  v_demo := COALESCE((p_batch->>'is_demo')::boolean, false);
  IF v_sha !~ '^[0-9a-f]{64}$' OR v_file = '' OR char_length(v_file) > 120
     OR position('/' IN v_file) > 0 OR position('\' IN v_file) > 0 THEN
    RAISE EXCEPTION 'file' USING ERRCODE = '22023';
  END IF;
  SELECT real_data_enabled INTO v_real FROM public.recover_workspaces WHERE company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace' USING ERRCODE = 'P0002';
  END IF;
  IF v_demo AND v_real THEN
    RAISE EXCEPTION 'demo_refused' USING ERRCODE = '23514';
  END IF;
  IF NOT v_demo AND NOT v_real THEN
    RAISE EXCEPTION 'demo_data_mode' USING ERRCODE = '23514';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text || ':' || v_sha, 0));
  IF EXISTS (
    SELECT 1 FROM public.recover_batches
    WHERE company_id = p_company_id AND creditor_id = v_creditor AND file_sha256 = v_sha AND status = 'imported'
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'already_imported');
  END IF;
  SELECT m.nca_regulated, m.product_type INTO v_nca, v_product
  FROM public.recover_mandates m
  JOIN public.recover_creditors c ON c.id = m.creditor_id AND c.company_id = m.company_id
  WHERE m.id = v_mandate AND m.company_id = p_company_id AND m.creditor_id = v_creditor
    AND m.status = 'active' AND c.status = 'active' AND c.archived_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mandate' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(lower(creditor_account_ref)), ARRAY[]::text[])
    INTO v_existing
  FROM public.recover_accounts
  WHERE company_id = p_company_id AND creditor_id = v_creditor;

  FOR v_row IN SELECT value FROM pg_catalog.jsonb_array_elements(p_rows)
  LOOP
    v_n := v_n + 1;
    v_acc_ref := pg_catalog.btrim(COALESCE(v_row->>'creditor_account_ref', ''));
    v_name := pg_catalog.btrim(COALESCE(v_row->>'display_name', ''));
    IF v_acc_ref = '' OR char_length(v_acc_ref) > 80 OR v_name = '' OR char_length(v_name) > 200 THEN
      RAISE EXCEPTION 'row_invalid' USING ERRCODE = '22023';
    END IF;
    IF v_row ? 'id_number' OR v_row ? 'passport' THEN
      RAISE EXCEPTION 'plaintext_id' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(v_row->>'principal_cents', '') !~ '^[0-9]+$'
       OR COALESCE(v_row->>'interest_cents', '0') !~ '^[0-9]+$'
       OR COALESCE(v_row->>'fees_cents', '0') !~ '^[0-9]+$'
       OR COALESCE(v_row->>'costs_cents', '0') !~ '^[0-9]+$'
       OR COALESCE(v_row->>'original_cents', v_row->>'principal_cents') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'row_invalid' USING ERRCODE = '22023';
    END IF;
    IF lower(v_acc_ref) = ANY (v_seen) OR lower(v_acc_ref) = ANY (v_existing) THEN
      v_skipped := v_skipped + 1;
      IF pg_catalog.jsonb_array_length(v_errors) < 200 THEN
        v_errors := v_errors || pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'row', COALESCE((v_row->>'row_number')::integer, v_n),
            'field', 'creditor_account_ref',
            'code', 'duplicate_account'
          )
        );
      END IF;
      CONTINUE;
    END IF;
    v_seen := v_seen || lower(v_acc_ref);
  END LOOP;

  INSERT INTO public.recover_batches (
    company_id, creditor_id, mandate_id, source, file_name, file_sha256,
    row_stats, error_report, mapping, status, imported_by, imported_at, is_demo, updated_at
  ) VALUES (
    p_company_id, v_creditor, v_mandate, v_source, v_file, v_sha,
    '{}'::jsonb, '[]'::jsonb, COALESCE(p_batch->'mapping', '{}'::jsonb),
    'validating', p_actor_id, pg_catalog.now(), v_demo, pg_catalog.now()
  ) RETURNING id INTO v_batch;

  v_n := 0;
  v_seen := ARRAY[]::text[];
  FOR v_row IN SELECT value FROM pg_catalog.jsonb_array_elements(p_rows)
  LOOP
    v_n := v_n + 1;
    v_acc_ref := pg_catalog.btrim(v_row->>'creditor_account_ref');
    IF lower(v_acc_ref) = ANY (v_seen) OR lower(v_acc_ref) = ANY (v_existing) THEN
      CONTINUE;
    END IF;
    v_seen := v_seen || lower(v_acc_ref);
    v_hash := NULLIF(v_row->>'id_hash', '');
    v_debtor := NULL;
    IF v_hash IS NOT NULL THEN
      SELECT id INTO v_debtor FROM public.recover_debtors
      WHERE company_id = p_company_id AND id_hash = v_hash AND status <> 'merged'
      LIMIT 1;
    END IF;
    IF v_debtor IS NULL THEN
      INSERT INTO public.recover_debtors (
        company_id, kind, display_name, first_names, last_name, company_name, id_type,
        id_number_enc, id_hash, id_last4, id_key_version, dob, language, status, is_demo, updated_at
      ) VALUES (
        p_company_id,
        COALESCE(NULLIF(v_row->>'kind', ''), 'person'),
        pg_catalog.btrim(v_row->>'display_name'),
        NULLIF(v_row->>'first_names', ''),
        NULLIF(v_row->>'last_name', ''),
        NULLIF(v_row->>'company_name', ''),
        NULLIF(v_row->>'id_type', ''),
        NULLIF(v_row->>'id_number_enc', ''),
        v_hash,
        NULLIF(v_row->>'id_last4', ''),
        NULLIF(v_row->>'id_key_version', '')::smallint,
        NULLIF(v_row->>'dob', '')::date,
        NULLIF(v_row->>'language', ''),
        'active',
        v_demo,
        pg_catalog.now()
      ) RETURNING id INTO v_debtor;
    END IF;
    IF pg_catalog.jsonb_typeof(v_row->'contacts') = 'array' THEN
      FOR v_contact IN SELECT value FROM pg_catalog.jsonb_array_elements(v_row->'contacts')
      LOOP
        INSERT INTO public.recover_contact_points (
          company_id, debtor_id, batch_id, kind, value, source, quality, consent,
          do_not_contact, s129_delivery_method, is_demo, updated_at
        ) VALUES (
          p_company_id,
          v_debtor,
          v_batch,
          v_contact->>'kind',
          v_contact->>'value',
          COALESCE(NULLIF(v_contact->>'source', ''), 'import'),
          COALESCE(NULLIF(v_contact->>'quality', ''), 'unknown'),
          COALESCE(v_contact->'consent', '{"phone":false,"email":false,"whatsapp":false,"sms":false}'::jsonb),
          COALESCE((v_contact->>'do_not_contact')::boolean, false),
          NULLIF(v_contact->>'s129_delivery_method', ''),
          v_demo,
          pg_catalog.now()
        );
      END LOOP;
    END IF;
    v_principal := (v_row->>'principal_cents')::bigint;
    v_interest := COALESCE((v_row->>'interest_cents')::bigint, 0);
    v_fees := COALESCE((v_row->>'fees_cents')::bigint, 0);
    v_costs := COALESCE((v_row->>'costs_cents')::bigint, 0);
    v_original := COALESCE((v_row->>'original_cents')::bigint, v_principal);
    v_ref := 'RC-' || pg_catalog.lpad(public.recover_next_number(p_company_id, 'account')::text, 6, '0');
    INSERT INTO public.recover_accounts (
      company_id, ref, batch_id, creditor_id, mandate_id, debtor_id, creditor_account_ref,
      product_type, nca_regulated, original_cents, principal_cents, interest_cents,
      fees_cents, costs_cents, default_date, is_demo, updated_at
    ) VALUES (
      p_company_id, v_ref, v_batch, v_creditor, v_mandate, v_debtor, v_acc_ref,
      v_product, v_nca, v_original, v_principal, v_interest, v_fees, v_costs,
      NULLIF(v_row->>'default_date', '')::date, v_demo, pg_catalog.now()
    ) RETURNING id INTO v_account;
    PERFORM public.recover_write_event(
      p_company_id, v_account, 'import', p_actor_id,
      pg_catalog.jsonb_build_object(
        'batch_id', v_batch,
        'row', COALESCE((v_row->>'row_number')::integer, v_n)
      ),
      NULL
    );
    v_created := v_created + 1;
  END LOOP;

  UPDATE public.recover_batches SET
    status = 'imported',
    row_stats = pg_catalog.jsonb_build_object(
      'created', v_created,
      'skipped', v_skipped,
      'errors', pg_catalog.jsonb_array_length(v_errors)
    ),
    error_report = v_errors,
    updated_at = pg_catalog.now()
  WHERE id = v_batch;

  PERFORM public.recover_write_audit(
    p_company_id, p_actor_id, 'import.commit', v_batch::text,
    pg_catalog.jsonb_build_object('batch_id', v_batch, 'created', v_created, 'skipped', v_skipped)
  );
  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'code', 'imported',
    'batch_id', v_batch,
    'created', v_created,
    'skipped', v_skipped
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_rollback_batch(
  p_company_id bigint,
  p_actor_id text,
  p_batch_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_bad_state integer;
  v_assigned integer;
  v_flagged integer;
  v_events integer;
  v_accounts integer;
BEGIN
  IF p_company_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'closed' USING ERRCODE = '22023';
  END IF;
  SELECT status INTO v_status FROM public.recover_batches
  WHERE id = p_batch_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'imported' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'rollback_refused', 'reason', v_status);
  END IF;
  SELECT
    count(*) FILTER (WHERE state <> 'active'),
    count(*) FILTER (WHERE assigned_to IS NOT NULL OR team_id IS NOT NULL),
    count(*) FILTER (WHERE flags <> '{}'::jsonb),
    count(*) FILTER (
      WHERE (
        SELECT count(*) FROM public.recover_account_events e WHERE e.account_id = a.id
      ) <> 1
      OR EXISTS (
        SELECT 1 FROM public.recover_account_events e
        WHERE e.account_id = a.id AND e.type <> 'import'
      )
    ),
    count(*)
  INTO v_bad_state, v_assigned, v_flagged, v_events, v_accounts
  FROM public.recover_accounts a
  WHERE a.company_id = p_company_id AND a.batch_id = p_batch_id;

  IF v_bad_state > 0 OR v_assigned > 0 OR v_flagged > 0 OR v_events > 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'rollback_refused',
      'counts', pg_catalog.jsonb_build_object(
        'state', v_bad_state,
        'assigned', v_assigned,
        'flagged', v_flagged,
        'events', v_events
      )
    );
  END IF;

  PERFORM public.recover_open_erase_token();
  DELETE FROM public.recover_account_events e
  USING public.recover_accounts a
  WHERE e.account_id = a.id AND a.company_id = p_company_id AND a.batch_id = p_batch_id;
  DELETE FROM public.recover_accounts WHERE company_id = p_company_id AND batch_id = p_batch_id;
  DELETE FROM public.recover_contact_points WHERE company_id = p_company_id AND batch_id = p_batch_id;
  DELETE FROM public.recover_debtors d
  WHERE d.company_id = p_company_id
    AND NOT EXISTS (SELECT 1 FROM public.recover_accounts a WHERE a.debtor_id = d.id)
    AND NOT EXISTS (SELECT 1 FROM public.recover_contact_points c WHERE c.debtor_id = d.id);
  UPDATE public.recover_batches
  SET status = 'rolled_back', updated_at = pg_catalog.now()
  WHERE id = p_batch_id AND company_id = p_company_id;
  PERFORM public.recover_close_erase_token();
  PERFORM public.recover_write_audit(
    p_company_id, p_actor_id, 'import.rollback', p_batch_id::text,
    pg_catalog.jsonb_build_object('batch_id', p_batch_id, 'accounts', v_accounts)
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'code', 'rolled_back', 'accounts', v_accounts);
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_load_demo_book(
  p_company_id bigint,
  p_actor_id text,
  p_book jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_real boolean;
  v_creditor jsonb;
  v_mandate jsonb;
  v_batch jsonb;
  v_creditor_id uuid;
  v_mandate_id uuid;
  v_result jsonb;
  v_map jsonb := '{}'::jsonb;
  v_mmap jsonb := '{}'::jsonb;
BEGIN
  IF p_company_id IS NULL OR p_book IS NULL OR pg_catalog.jsonb_typeof(p_book) <> 'object' THEN
    RAISE EXCEPTION 'closed' USING ERRCODE = '22023';
  END IF;
  SELECT real_data_enabled INTO v_real FROM public.recover_workspaces WHERE company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace' USING ERRCODE = 'P0002';
  END IF;
  IF v_real THEN
    RAISE EXCEPTION 'demo_refused' USING ERRCODE = '23514';
  END IF;
  IF public.recover_demo_rows_exist(p_company_id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'code', 'already_loaded');
  END IF;

  FOR v_creditor IN SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(p_book->'creditors', '[]'::jsonb))
  LOOP
    SELECT id INTO v_creditor_id FROM public.recover_creditors
    WHERE company_id = p_company_id AND lower(name) = lower(v_creditor->>'name') AND archived_at IS NULL
    LIMIT 1;
    IF v_creditor_id IS NULL THEN
      INSERT INTO public.recover_creditors (
        company_id, name, reg_no, vat_no, remittance_terms, status, updated_at
      ) VALUES (
        p_company_id,
        v_creditor->>'name',
        COALESCE(v_creditor->>'reg_no', ''),
        COALESCE(v_creditor->>'vat_no', ''),
        COALESCE(NULLIF(v_creditor->>'remittance_terms', ''), 'monthly'),
        'active',
        pg_catalog.now()
      ) RETURNING id INTO v_creditor_id;
    END IF;
    v_map := v_map || pg_catalog.jsonb_build_object(v_creditor->>'key', v_creditor_id);
  END LOOP;

  FOR v_mandate IN SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(p_book->'mandates', '[]'::jsonb))
  LOOP
    v_creditor_id := (v_map->> (v_mandate->>'creditor_key'))::uuid;
    SELECT id INTO v_mandate_id FROM public.recover_mandates
    WHERE company_id = p_company_id AND creditor_id = v_creditor_id
      AND agreement_reference = v_mandate->>'agreement_reference'
    LIMIT 1;
    IF v_mandate_id IS NULL THEN
      INSERT INTO public.recover_mandates (
        company_id, creditor_id, programme_type, product_type, nca_regulated, processing_role,
        status, agreement_reference, signed_on, commission_model, allocation_order, updated_at
      ) VALUES (
        p_company_id,
        v_creditor_id,
        'recovery',
        v_mandate->>'product_type',
        COALESCE((v_mandate->>'nca_regulated')::boolean, false),
        COALESCE(NULLIF(v_mandate->>'processing_role', ''), 'operator'),
        'active',
        v_mandate->>'agreement_reference',
        NULLIF(v_mandate->>'signed_on', '')::date,
        COALESCE(v_mandate->'commission_model', '{}'::jsonb),
        COALESCE(v_mandate->'allocation_order', '["costs","interest","fees","principal"]'::jsonb),
        pg_catalog.now()
      ) RETURNING id INTO v_mandate_id;
    END IF;
    v_mmap := v_mmap || pg_catalog.jsonb_build_object(v_mandate->>'key', v_mandate_id);
  END LOOP;

  FOR v_batch IN SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(p_book->'batches', '[]'::jsonb))
  LOOP
    v_result := public.recover_import_commit(
      p_company_id,
      p_actor_id,
      pg_catalog.jsonb_build_object(
        'creditor_id', v_map->> (v_batch->>'creditor_key'),
        'mandate_id', v_mmap->> (v_batch->>'mandate_key'),
        'source', 'demo',
        'file_name', v_batch->>'file_name',
        'file_sha256', v_batch->>'file_sha256',
        'mapping', COALESCE(v_batch->'mapping', '{}'::jsonb),
        'is_demo', true
      ),
      COALESCE(v_batch->'rows', '[]'::jsonb)
    );
  END LOOP;

  PERFORM public.recover_write_audit(
    p_company_id, p_actor_id, 'demo.load', 'recover_batches',
    pg_catalog.jsonb_build_object('code', 'loaded')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'code', 'loaded');
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_clear_demo(
  p_company_id bigint,
  p_actor_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_accounts integer;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'closed' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO v_accounts FROM public.recover_accounts
  WHERE company_id = p_company_id AND is_demo;
  PERFORM public.recover_open_erase_token();
  DELETE FROM public.recover_account_events e
  USING public.recover_accounts a
  WHERE e.account_id = a.id AND a.company_id = p_company_id AND a.is_demo;
  DELETE FROM public.recover_accounts WHERE company_id = p_company_id AND is_demo;
  DELETE FROM public.recover_contact_points WHERE company_id = p_company_id AND is_demo;
  DELETE FROM public.recover_debtors d
  WHERE d.company_id = p_company_id AND d.is_demo
    AND NOT EXISTS (SELECT 1 FROM public.recover_accounts a WHERE a.debtor_id = d.id)
    AND NOT EXISTS (SELECT 1 FROM public.recover_contact_points c WHERE c.debtor_id = d.id);
  DELETE FROM public.recover_batches WHERE company_id = p_company_id AND is_demo;
  PERFORM public.recover_close_erase_token();
  PERFORM public.recover_write_audit(
    p_company_id, p_actor_id, 'demo.clear', 'recover_accounts',
    pg_catalog.jsonb_build_object('accounts', v_accounts)
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'code', 'cleared', 'accounts', v_accounts);
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_accounts_for_agent(
  p_company_id bigint,
  p_staff_id uuid,
  p_limit integer,
  p_after timestamptz,
  p_state text
) RETURNS TABLE (
  id uuid,
  ref text,
  creditor_name text,
  debtor_id uuid,
  display_name text,
  id_last4 text,
  balance_cents bigint,
  state text,
  assigned_to uuid,
  team_id uuid,
  placed_at timestamptz,
  flags jsonb,
  stage_key text,
  creditor_account_ref text,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_team uuid;
  v_limit integer;
BEGIN
  IF p_company_id IS NULL OR p_staff_id IS NULL THEN
    RAISE EXCEPTION 'closed' USING ERRCODE = '22023';
  END IF;
  SELECT s.team_id INTO v_team
  FROM public.recover_staff s
  WHERE s.id = p_staff_id AND s.company_id = p_company_id AND s.status = 'active';
  IF NOT FOUND THEN
    RETURN;
  END IF;
  v_limit := LEAST(COALESCE(p_limit, 50), 50);
  RETURN QUERY
  SELECT
    a.id, a.ref, c.name, a.debtor_id, d.display_name, d.id_last4, a.balance_cents,
    a.state, a.assigned_to, a.team_id, a.placed_at, a.flags, a.stage_key,
    a.creditor_account_ref, a.updated_at
  FROM public.recover_accounts a
  JOIN public.recover_creditors c ON c.id = a.creditor_id AND c.company_id = a.company_id
  JOIN public.recover_debtors d ON d.id = a.debtor_id AND d.company_id = a.company_id
  WHERE a.company_id = p_company_id
    AND (a.assigned_to = p_staff_id OR (v_team IS NOT NULL AND a.team_id = v_team))
    AND (p_state IS NULL OR p_state = '' OR a.state = p_state)
    AND (p_after IS NULL OR a.placed_at < p_after)
  ORDER BY a.placed_at DESC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_set_staff_expiry(
  p_company_id bigint,
  p_actor_id text,
  p_staff_id uuid,
  p_expires date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.recover_staff
  SET registration_expires_on = p_expires, updated_at = pg_catalog.now()
  WHERE id = p_staff_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.recover_write_audit(
    p_company_id, p_actor_id, 'staff.registration_expiry', p_staff_id::text,
    pg_catalog.jsonb_build_object('staff_id', p_staff_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_set_assignment_block(
  p_company_id bigint,
  p_actor_id text,
  p_enabled boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.recover_workspaces
  SET block_unregistered_assignment = COALESCE(p_enabled, true), updated_at = pg_catalog.now()
  WHERE company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'missing' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.recover_write_audit(
    p_company_id, p_actor_id, 'workspace.assignment_block', 'recover_workspaces',
    pg_catalog.jsonb_build_object('enabled', COALESCE(p_enabled, true))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_erase_company(p_company_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_real boolean;
BEGIN
  IF p_company_id IS NULL OR p_company_id <= 0 THEN
    RAISE EXCEPTION 'closed' USING ERRCODE = '22023';
  END IF;
  SELECT real_data_enabled INTO v_real FROM public.recover_workspaces WHERE company_id = p_company_id;
  IF v_real IS TRUE THEN
    RAISE EXCEPTION 'real_data' USING ERRCODE = '23514';
  END IF;
  PERFORM public.recover_open_erase_token();
  DELETE FROM public.recover_account_events WHERE company_id = p_company_id;
  DELETE FROM public.recover_accounts WHERE company_id = p_company_id;
  DELETE FROM public.recover_contact_points WHERE company_id = p_company_id;
  DELETE FROM public.recover_debtors WHERE company_id = p_company_id;
  DELETE FROM public.recover_batches WHERE company_id = p_company_id;
  DELETE FROM public.recover_mandates WHERE company_id = p_company_id;
  DELETE FROM public.recover_creditors WHERE company_id = p_company_id;
  DELETE FROM public.recover_portal_attempts WHERE company_id = p_company_id;
  DELETE FROM public.recover_portal_otps WHERE company_id = p_company_id;
  DELETE FROM public.recover_portal_sessions WHERE company_id = p_company_id;
  DELETE FROM public.recover_portal_invites WHERE company_id = p_company_id;
  DELETE FROM public.recover_audit_log WHERE company_id = p_company_id;
  DELETE FROM public.recover_staff WHERE company_id = p_company_id;
  DELETE FROM public.recover_teams WHERE company_id = p_company_id;
  DELETE FROM public.recover_counters WHERE company_id = p_company_id;
  DELETE FROM public.recover_workspaces WHERE company_id = p_company_id;
  PERFORM public.recover_close_erase_token();
  INSERT INTO public.recover_audit_log (company_id, actor_kind, actor_id, action, target, payload)
  VALUES (
    NULL,
    'system',
    'erase',
    'erase_company',
    'recover',
    pg_catalog.jsonb_build_object('company_id', p_company_id)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Lock-down. Catalog-driven so every recover_% object is covered, including
-- objects created by the earlier migration.
-- ---------------------------------------------------------------------------

DO $lock$
DECLARE
  rel record;
  fn record;
  seq record;
BEGIN
  FOR rel IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'recover\_%'
  LOOP
    IF rel.relname = 'recover_erase_guard' THEN
      EXECUTE 'ALTER TABLE public.recover_erase_guard ENABLE ROW LEVEL SECURITY';
      EXECUTE 'ALTER TABLE public.recover_erase_guard FORCE ROW LEVEL SECURITY';
      EXECUTE 'REVOKE ALL ON TABLE public.recover_erase_guard FROM PUBLIC, anon, authenticated, recover_portal, service_role';
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', rel.relname);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', rel.relname);
    EXECUTE format('DROP POLICY IF EXISTS sa_deny_anon ON public.%I', rel.relname);
    EXECUTE format(
      'CREATE POLICY sa_deny_anon ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
      rel.relname
    );
    EXECUTE format('DROP POLICY IF EXISTS sa_deny_authenticated ON public.%I', rel.relname);
    EXECUTE format(
      'CREATE POLICY sa_deny_authenticated ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
      rel.relname
    );
    EXECUTE format('DROP POLICY IF EXISTS recover_table_owner ON public.%I', rel.relname);
    EXECUTE format(
      'CREATE POLICY recover_table_owner ON public.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
      rel.relname,
      current_user
    );
    EXECUTE format(
      'REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, recover_portal',
      rel.relname
    );
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM service_role', rel.relname);
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role',
        rel.relname
      );
      EXECUTE format(
        'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM service_role',
        rel.relname
      );
    END IF;
    EXECUTE format(
      'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM PUBLIC, anon, authenticated, recover_portal',
      rel.relname
    );
  END LOOP;

  FOR seq IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S' AND c.relname LIKE 'recover\_%'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC, anon, authenticated, recover_portal',
      seq.relname
    );
  END LOOP;

  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'recover\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, recover_portal', fn.sig);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
    END IF;
  END LOOP;
END
$lock$;

REVOKE ALL ON TABLE public.recover_erase_guard FROM PUBLIC, anon, authenticated, recover_portal, service_role;
