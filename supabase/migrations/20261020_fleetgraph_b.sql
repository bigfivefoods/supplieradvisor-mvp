-- FleetAdvisor® compliance (Brief 115).
-- Apply manually in the Supabase SQL editor after review. Craig approves first.
-- Re-runnable. No seed rows. No customer data. No truncate. No drop table.
-- Purpose: compliance reminders, trailer links, import idempotency, renewal
-- chains, and moving btree_gist out of public into extensions.
--
-- btree_gist safety: the extension is relocatable. ALTER EXTENSION btree_gist
-- SET SCHEMA extensions moves its functions, operator classes and operator
-- families together. The exclusion index on fg_cost_profiles stores operator
-- class OIDs, so the constraint keeps enforcing after the move. Default
-- operator-class lookup for a column type does not depend on search_path, so
-- a later EXCLUDE USING gist still resolves. CREATE EXTENSION IF NOT EXISTS
-- in the Brief 114 file is a no-op once the extension exists in any schema,
-- so re-running that file does not put btree_gist back into public.
-- If the executing role does not own the extension, this file raises a notice
-- and skips only the move. Every other failure aborts the migration.
-- Do not change grants on the extensions schema. Do not create other objects there.
--
-- ROLLBACK (manual, after review): move the extension back only if a review
-- requires it (ALTER EXTENSION btree_gist SET SCHEMA public); remove the new
-- reminder, reminder-log and trailer-link tables; drop the added columns and
-- constraints; restore public.fg_erase_company from 20261019_fleetgraph_a.sql.
-- Take a backup first. Do not run a rollback against a database that already
-- holds company rows you need to keep.

CREATE SCHEMA IF NOT EXISTS extensions;

DO $btree$
DECLARE
  ext_schema text;
  ext_owner oid;
  owner_name text;
BEGIN
  SELECT n.nspname, e.extowner
    INTO ext_schema, ext_owner
  FROM pg_catalog.pg_extension e
  JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'btree_gist';

  IF ext_schema IS NULL THEN
    CREATE EXTENSION btree_gist WITH SCHEMA extensions;
  ELSIF ext_schema = 'extensions' THEN
    NULL;
  ELSIF ext_schema = 'public' THEN
    SELECT r.rolname INTO owner_name FROM pg_catalog.pg_roles r WHERE r.oid = ext_owner;
    IF owner_name IS NULL OR NOT pg_catalog.pg_has_role(CURRENT_USER, owner_name, 'USAGE') THEN
      RAISE NOTICE 'btree_gist is owned by %. Move it manually: ALTER EXTENSION btree_gist SET SCHEMA extensions;', COALESCE(owner_name, 'unknown');
    ELSE
      ALTER EXTENSION btree_gist SET SCHEMA extensions;
    END IF;
  ELSE
    RAISE EXCEPTION 'btree_gist is in unexpected schema %', ext_schema;
  END IF;
END
$btree$;

CREATE OR REPLACE FUNCTION public.fg_kind_list_ok(p_kinds text[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  allowed text[] := ARRAY[
    'licence_disc', 'roadworthy', 'operator_card', 'insurance', 'cross_border_permit',
    'abnormal_permit', 'other_permit', 'driver_licence', 'prdp', 'medical', 'induction', 'other'
  ];
  item text;
BEGIN
  IF p_kinds IS NULL THEN
    RETURN false;
  END IF;
  FOREACH item IN ARRAY p_kinds LOOP
    IF item IS NULL OR NOT (item = ANY (allowed)) THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.fg_thresholds_ok(p_days integer[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  i integer;
BEGIN
  IF p_days IS NULL OR cardinality(p_days) < 1 OR cardinality(p_days) > 6 THEN
    RETURN false;
  END IF;
  FOR i IN 1..cardinality(p_days) LOOP
    IF p_days[i] IS NULL OR p_days[i] < 0 OR p_days[i] > 365 THEN
      RETURN false;
    END IF;
    IF i > 1 AND p_days[i - 1] <= p_days[i] THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.fg_channels_ok(p_channels text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_channels IS NOT NULL AND p_channels <@ ARRAY['email', 'push']::text[];
$$;

CREATE OR REPLACE FUNCTION public.fg_recipients_ok(p_ids text[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item text;
BEGIN
  IF p_ids IS NULL OR cardinality(p_ids) > 20 THEN
    RETURN false;
  END IF;
  FOREACH item IN ARRAY p_ids LOOP
    IF item IS NULL OR btrim(item) = '' OR pg_catalog.strpos(item, '@') > 0 OR char_length(item) > 80 THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

ALTER TABLE public.fg_import_runs ADD COLUMN IF NOT EXISTS source_label text;
ALTER TABLE public.fg_import_runs ADD COLUMN IF NOT EXISTS committed_at timestamptz;

ALTER TABLE public.fg_import_runs DROP CONSTRAINT IF EXISTS fg_import_kind;
ALTER TABLE public.fg_import_runs
  ADD CONSTRAINT fg_import_kind CHECK (kind IN (
    'gps_csv', 'gpx', 'ship_vehicles', 'ship_drivers', 'fuel_csv', 'toll_csv',
    'vehicles_csv', 'drivers_csv', 'compliance_csv'
  ));

ALTER TABLE public.fg_import_runs DROP CONSTRAINT IF EXISTS fg_import_status;
ALTER TABLE public.fg_import_runs
  ADD CONSTRAINT fg_import_status CHECK (status IN ('draft', 'dry_run', 'committed', 'failed'));

ALTER TABLE public.fg_import_runs DROP CONSTRAINT IF EXISTS fg_import_label;
ALTER TABLE public.fg_import_runs
  ADD CONSTRAINT fg_import_label CHECK (source_label IS NULL OR char_length(source_label) <= 120);

CREATE UNIQUE INDEX IF NOT EXISTS fg_import_committed_source
  ON public.fg_import_runs (company_id, kind, source_hash)
  WHERE status = 'committed' AND dry_run = false;

ALTER TABLE public.fg_vehicles ADD COLUMN IF NOT EXISTS source_system text;
ALTER TABLE public.fg_vehicles ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE public.fg_vehicles DROP CONSTRAINT IF EXISTS fg_vehicles_source;
ALTER TABLE public.fg_vehicles
  ADD CONSTRAINT fg_vehicles_source CHECK (
    (source_system IS NULL AND source_id IS NULL)
    OR (source_system = 'ship' AND source_id IS NOT NULL AND char_length(btrim(source_id)) BETWEEN 1 AND 64)
  );
CREATE UNIQUE INDEX IF NOT EXISTS fg_vehicles_source_unique
  ON public.fg_vehicles (company_id, source_system, source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE public.fg_drivers ADD COLUMN IF NOT EXISTS source_system text;
ALTER TABLE public.fg_drivers ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE public.fg_drivers DROP CONSTRAINT IF EXISTS fg_drivers_source;
ALTER TABLE public.fg_drivers
  ADD CONSTRAINT fg_drivers_source CHECK (
    (source_system IS NULL AND source_id IS NULL)
    OR (source_system = 'ship' AND source_id IS NOT NULL AND char_length(btrim(source_id)) BETWEEN 1 AND 64)
  );
CREATE UNIQUE INDEX IF NOT EXISTS fg_drivers_source_unique
  ON public.fg_drivers (company_id, source_system, source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE public.fg_compliance_items ADD COLUMN IF NOT EXISTS renewed_from_id uuid;
DO $renewed$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fg_compliance_renewed_from') THEN
    ALTER TABLE public.fg_compliance_items
      ADD CONSTRAINT fg_compliance_renewed_from
      FOREIGN KEY (renewed_from_id) REFERENCES public.fg_compliance_items (id) ON DELETE SET NULL;
  END IF;
END
$renewed$;
CREATE INDEX IF NOT EXISTS fg_compliance_subject_expiry
  ON public.fg_compliance_items (company_id, subject_kind, subject_id, kind, expires_on DESC);

ALTER TABLE public.fg_workspaces ADD COLUMN IF NOT EXISTS expected_vehicle_kinds text[] NOT NULL DEFAULT ARRAY['licence_disc', 'roadworthy', 'insurance']::text[];
ALTER TABLE public.fg_workspaces ADD COLUMN IF NOT EXISTS expected_driver_kinds text[] NOT NULL DEFAULT ARRAY['driver_licence', 'prdp', 'medical']::text[];
ALTER TABLE public.fg_workspaces ADD COLUMN IF NOT EXISTS prdp_gvm_threshold_kg integer DEFAULT 3500;

ALTER TABLE public.fg_workspaces DROP CONSTRAINT IF EXISTS fg_workspaces_expected_vehicles;
ALTER TABLE public.fg_workspaces
  ADD CONSTRAINT fg_workspaces_expected_vehicles CHECK (public.fg_kind_list_ok(expected_vehicle_kinds));

ALTER TABLE public.fg_workspaces DROP CONSTRAINT IF EXISTS fg_workspaces_expected_drivers;
ALTER TABLE public.fg_workspaces
  ADD CONSTRAINT fg_workspaces_expected_drivers CHECK (public.fg_kind_list_ok(expected_driver_kinds));

ALTER TABLE public.fg_workspaces DROP CONSTRAINT IF EXISTS fg_workspaces_prdp_gvm;
ALTER TABLE public.fg_workspaces
  ADD CONSTRAINT fg_workspaces_prdp_gvm CHECK (
    prdp_gvm_threshold_kg IS NULL OR prdp_gvm_threshold_kg BETWEEN 0 AND 100000
  );

CREATE TABLE IF NOT EXISTS public.fg_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  scope_kind text NOT NULL,
  kind text,
  thresholds_days integer[] NOT NULL DEFAULT ARRAY[30, 14, 7, 0]::integer[],
  channels text[] NOT NULL DEFAULT ARRAY[]::text[],
  recipient_member_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_reminders_scope CHECK (scope_kind IN ('all', 'vehicle', 'driver')),
  CONSTRAINT fg_reminders_kind CHECK (kind IS NULL OR kind IN (
    'licence_disc', 'roadworthy', 'operator_card', 'insurance', 'cross_border_permit',
    'abnormal_permit', 'other_permit', 'driver_licence', 'prdp', 'medical', 'induction', 'other'
  )),
  CONSTRAINT fg_reminders_thresholds CHECK (public.fg_thresholds_ok(thresholds_days)),
  CONSTRAINT fg_reminders_channels CHECK (public.fg_channels_ok(channels)),
  CONSTRAINT fg_reminders_recipients CHECK (public.fg_recipients_ok(recipient_member_ids))
);

CREATE UNIQUE INDEX IF NOT EXISTS fg_reminders_active_scope
  ON public.fg_reminders (company_id, scope_kind, (coalesce(kind, '')))
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS fg_reminders_company ON public.fg_reminders (company_id, enabled);

CREATE TABLE IF NOT EXISTS public.fg_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  rule_id uuid NOT NULL,
  item_id uuid NOT NULL,
  subject_kind text NOT NULL,
  subject_id uuid NOT NULL,
  expires_on date NOT NULL,
  threshold_days integer NOT NULL,
  channel text NOT NULL,
  recipient_key text NOT NULL,
  status text NOT NULL,
  error_code text,
  at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_reminder_log_subject CHECK (subject_kind IN ('vehicle', 'driver')),
  CONSTRAINT fg_reminder_log_channel CHECK (channel IN ('email', 'push')),
  CONSTRAINT fg_reminder_log_status CHECK (status IN ('claimed', 'sent', 'failed', 'skipped_superseded')),
  CONSTRAINT fg_reminder_log_threshold CHECK (threshold_days BETWEEN 0 AND 365),
  CONSTRAINT fg_reminder_log_recipient CHECK (
    recipient_key IS NOT NULL
    AND btrim(recipient_key) <> ''
    AND pg_catalog.strpos(recipient_key, '@') = 0
    AND char_length(recipient_key) <= 80
  ),
  CONSTRAINT fg_reminder_log_error CHECK (error_code IS NULL OR char_length(error_code) <= 40)
);

CREATE UNIQUE INDEX IF NOT EXISTS fg_reminder_log_claim_once
  ON public.fg_reminder_log (company_id, item_id, expires_on, threshold_days, channel, recipient_key)
  WHERE status = 'claimed';
CREATE INDEX IF NOT EXISTS fg_reminder_log_company ON public.fg_reminder_log (company_id, at DESC);

CREATE TABLE IF NOT EXISTS public.fg_trailer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  truck_id uuid NOT NULL REFERENCES public.fg_vehicles (id) ON DELETE CASCADE,
  trailer_id uuid NOT NULL REFERENCES public.fg_vehicles (id) ON DELETE CASCADE,
  from_on date NOT NULL,
  to_on date,
  created_by text NOT NULL DEFAULT '',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_trailer_links_distinct CHECK (truck_id <> trailer_id),
  CONSTRAINT fg_trailer_links_range CHECK (to_on IS NULL OR to_on >= from_on)
);

CREATE INDEX IF NOT EXISTS fg_trailer_links_trailer ON public.fg_trailer_links (company_id, trailer_id, from_on);
CREATE INDEX IF NOT EXISTS fg_trailer_links_truck ON public.fg_trailer_links (company_id, truck_id, from_on);

ALTER TABLE public.fg_trailer_links DROP CONSTRAINT IF EXISTS fg_trailer_links_no_overlap;
ALTER TABLE public.fg_trailer_links
  ADD CONSTRAINT fg_trailer_links_no_overlap
  EXCLUDE USING gist (
    company_id WITH =,
    trailer_id WITH =,
    daterange(from_on, coalesce(to_on, 'infinity'::date), '[]') WITH &&
  );

CREATE OR REPLACE FUNCTION public.fg_trailer_link_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_truck_kind text;
  v_trailer_kind text;
  v_truck_company bigint;
  v_trailer_company bigint;
BEGIN
  SELECT kind, company_id INTO v_truck_kind, v_truck_company
  FROM public.fg_vehicles WHERE id = NEW.truck_id;
  SELECT kind, company_id INTO v_trailer_kind, v_trailer_company
  FROM public.fg_vehicles WHERE id = NEW.trailer_id;
  IF v_truck_company IS NULL OR v_trailer_company IS NULL
     OR v_truck_company IS DISTINCT FROM NEW.company_id
     OR v_trailer_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'fg_trailer_company' USING ERRCODE = '23514';
  END IF;
  IF v_truck_kind = 'trailer' OR v_trailer_kind IS DISTINCT FROM 'trailer' THEN
    RAISE EXCEPTION 'fg_trailer_kind' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fg_trailer_links_guard ON public.fg_trailer_links;
CREATE CONSTRAINT TRIGGER fg_trailer_links_guard
  AFTER INSERT OR UPDATE ON public.fg_trailer_links
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW
  EXECUTE FUNCTION public.fg_trailer_link_guard();

CREATE OR REPLACE FUNCTION public.fg_claim_reminder(
  p_company_id bigint,
  p_rule_id uuid,
  p_item_id uuid,
  p_subject_kind text,
  p_subject_id uuid,
  p_expires_on date,
  p_threshold integer,
  p_channel text,
  p_recipient_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_company_id IS NULL OR p_company_id <= 0
     OR p_rule_id IS NULL
     OR p_item_id IS NULL
     OR p_subject_kind IS NULL OR btrim(p_subject_kind) = ''
     OR p_subject_id IS NULL
     OR p_expires_on IS NULL
     OR p_threshold IS NULL
     OR p_channel IS NULL OR btrim(p_channel) = ''
     OR p_recipient_key IS NULL OR btrim(p_recipient_key) = '' THEN
    RAISE EXCEPTION 'fg_claim_closed' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.fg_reminder_log (
    company_id, rule_id, item_id, subject_kind, subject_id, expires_on,
    threshold_days, channel, recipient_key, status
  ) VALUES (
    p_company_id, p_rule_id, p_item_id, p_subject_kind, p_subject_id, p_expires_on,
    p_threshold, p_channel, p_recipient_key, 'claimed'
  )
  ON CONFLICT (company_id, item_id, expires_on, threshold_days, channel, recipient_key)
    WHERE status = 'claimed'
  DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.fg_commit_b(p_company_id bigint, p_diff jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_table text;
  v_row jsonb;
  v_cols text;
  v_id uuid;
  v_prev text;
  v_found integer;
  v_exists boolean;
BEGIN
  IF p_company_id IS NULL OR p_company_id <= 0 OR p_diff IS NULL OR pg_catalog.jsonb_typeof(p_diff) <> 'object' THEN
    RAISE EXCEPTION 'fg_commit_closed' USING ERRCODE = '22023';
  END IF;
  IF (p_diff->>'company_id')::bigint IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'fg_commit_closed' USING ERRCODE = '22023';
  END IF;

  FOREACH v_table IN ARRAY ARRAY['fg_reminders', 'fg_trailer_links']
  LOOP
    IF pg_catalog.jsonb_typeof(p_diff->'upserts'->v_table) IS DISTINCT FROM 'array' THEN
      CONTINUE;
    END IF;
    FOR v_row IN SELECT value FROM pg_catalog.jsonb_array_elements(p_diff->'upserts'->v_table)
    LOOP
      IF (v_row->>'company_id')::bigint IS DISTINCT FROM p_company_id THEN
        RAISE EXCEPTION 'fg_commit_closed' USING ERRCODE = '22023';
      END IF;
      v_id := NULLIF(v_row->>'id', '')::uuid;
      v_prev := NULLIF(v_row->>'previous_updated_at', '');
      SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
        INTO v_cols
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = v_table
        AND c.column_name <> 'created_at'
        AND (v_row ? c.column_name);
      IF v_cols IS NULL OR v_id IS NULL THEN
        RAISE EXCEPTION 'fg_commit_closed' USING ERRCODE = '22023';
      END IF;
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1 AND company_id = $2)', v_table)
        INTO v_exists USING v_id, p_company_id;
      IF NOT v_exists THEN
        EXECUTE format(
          'INSERT INTO public.%I (%s) SELECT %s FROM pg_catalog.jsonb_populate_record(NULL::public.%I, $1) AS rec',
          v_table, v_cols, v_cols, v_table
        ) USING v_row;
      ELSE
        EXECUTE format(
          'UPDATE public.%I AS t SET (%s) = (SELECT %s FROM pg_catalog.jsonb_populate_record(NULL::public.%I, $1) AS rec) WHERE t.id = $2 AND t.company_id = $3 AND ($4::text IS NULL OR t.updated_at = $4::timestamptz)',
          v_table, v_cols, v_cols, v_table
        ) USING v_row, v_id, p_company_id, v_prev;
        GET DIAGNOSTICS v_found = ROW_COUNT;
        IF v_found = 0 THEN
          RAISE EXCEPTION 'fg_conflict' USING ERRCODE = '40001';
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  IF pg_catalog.jsonb_typeof(p_diff->'inserts'->'fg_reminder_log') = 'array' THEN
    FOR v_row IN SELECT value FROM pg_catalog.jsonb_array_elements(p_diff->'inserts'->'fg_reminder_log')
    LOOP
      IF (v_row->>'company_id')::bigint IS DISTINCT FROM p_company_id THEN
        RAISE EXCEPTION 'fg_commit_closed' USING ERRCODE = '22023';
      END IF;
      SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
        INTO v_cols
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'fg_reminder_log'
        AND c.column_name <> 'created_at'
        AND (v_row ? c.column_name);
      IF v_cols IS NULL THEN
        RAISE EXCEPTION 'fg_commit_closed' USING ERRCODE = '22023';
      END IF;
      EXECUTE format(
        'INSERT INTO public.fg_reminder_log (%s) SELECT %s FROM pg_catalog.jsonb_populate_record(NULL::public.fg_reminder_log, $1) AS rec',
        v_cols, v_cols
      ) USING v_row;
    END LOOP;
  END IF;

  IF pg_catalog.jsonb_typeof(p_diff->'inserts'->'fg_audit_log') = 'array' THEN
    FOR v_row IN SELECT value FROM pg_catalog.jsonb_array_elements(p_diff->'inserts'->'fg_audit_log')
    LOOP
      IF (v_row->>'company_id')::bigint IS DISTINCT FROM p_company_id THEN
        RAISE EXCEPTION 'fg_commit_closed' USING ERRCODE = '22023';
      END IF;
      SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
        INTO v_cols
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'fg_audit_log'
        AND c.column_name <> 'created_at'
        AND (v_row ? c.column_name);
      IF v_cols IS NULL THEN
        RAISE EXCEPTION 'fg_commit_closed' USING ERRCODE = '22023';
      END IF;
      EXECUTE format(
        'INSERT INTO public.fg_audit_log (%s) SELECT %s FROM pg_catalog.jsonb_populate_record(NULL::public.fg_audit_log, $1) AS rec',
        v_cols, v_cols
      ) USING v_row;
    END LOOP;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fg_import_commit(p_company_id bigint, p_run jsonb, p_diff jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_kind text;
  v_hash text;
  v_count integer := 0;
  v_part jsonb;
  v_key text;
BEGIN
  IF p_company_id IS NULL OR p_company_id <= 0 OR p_run IS NULL OR pg_catalog.jsonb_typeof(p_run) <> 'object' THEN
    RAISE EXCEPTION 'fg_import_closed' USING ERRCODE = '22023';
  END IF;
  IF p_diff IS NULL OR pg_catalog.jsonb_typeof(p_diff) <> 'object' THEN
    RAISE EXCEPTION 'fg_import_closed' USING ERRCODE = '22023';
  END IF;
  IF (p_diff->>'company_id')::bigint IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'fg_import_closed' USING ERRCODE = '22023';
  END IF;
  v_kind := NULLIF(btrim(p_run->>'kind'), '');
  v_hash := NULLIF(btrim(p_run->>'source_hash'), '');
  IF v_kind IS NULL OR v_hash IS NULL THEN
    RAISE EXCEPTION 'fg_import_closed' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(p_run->>'source_label', '')) > 120 THEN
    RAISE EXCEPTION 'fg_import_closed' USING ERRCODE = '22023';
  END IF;
  FOREACH v_key IN ARRAY ARRAY['fg_vehicles', 'fg_drivers', 'fg_compliance_items']
  LOOP
    v_part := p_diff->'upserts'->v_key;
    IF pg_catalog.jsonb_typeof(v_part) = 'array' THEN
      v_count := v_count + pg_catalog.jsonb_array_length(v_part);
    END IF;
  END LOOP;
  IF v_count > 500 THEN
    RAISE EXCEPTION 'fg_import_row_cap' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.fg_import_runs (
    id, company_id, kind, status, row_counts, source_hash, created_by, dry_run, source_label, committed_at, updated_at
  ) VALUES (
    coalesce(NULLIF(p_run->>'id', '')::uuid, gen_random_uuid()),
    p_company_id,
    v_kind,
    'committed',
    coalesce(p_run->'row_counts', '{}'::jsonb),
    v_hash,
    coalesce(p_run->>'created_by', ''),
    false,
    NULLIF(p_run->>'source_label', ''),
    pg_catalog.now(),
    pg_catalog.now()
  )
  ON CONFLICT (company_id, kind, source_hash) WHERE status = 'committed' AND dry_run = false
  DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'already_imported', true);
  END IF;

  PERFORM public.fg_commit_diff(p_company_id, p_diff);

  INSERT INTO public.fg_audit_log (company_id, actor_kind, actor_id, action, target_kind, target_id, payload)
  VALUES (
    p_company_id,
    'system',
    coalesce(p_run->>'created_by', ''),
    'import.commit',
    'import',
    v_id::text,
    pg_catalog.jsonb_build_object('kind', v_kind, 'rows', v_count)
  );

  RETURN pg_catalog.jsonb_build_object('ok', true, 'already_imported', false, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.fg_erase_company(p_company_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text;
BEGIN
  IF p_company_id IS NULL OR p_company_id <= 0 THEN
    RAISE EXCEPTION 'fg_erase_closed' USING ERRCODE = '22023';
  END IF;
  v_token := gen_random_uuid()::text || gen_random_uuid()::text;
  INSERT INTO public.fg_erase_guard (id, token) VALUES (1, v_token)
  ON CONFLICT (id) DO UPDATE SET token = EXCLUDED.token;
  PERFORM set_config('fg.erase_token', v_token, true);
  DELETE FROM public.fg_reminder_log WHERE company_id = p_company_id;
  DELETE FROM public.fg_trailer_links WHERE company_id = p_company_id;
  DELETE FROM public.fg_reminders WHERE company_id = p_company_id;
  DELETE FROM public.fg_job_stops WHERE company_id = p_company_id;
  DELETE FROM public.fg_cost_entries WHERE company_id = p_company_id AND reverses_id IS NOT NULL;
  DELETE FROM public.fg_cost_entries WHERE company_id = p_company_id;
  DELETE FROM public.fg_odometer_readings WHERE company_id = p_company_id;
  DELETE FROM public.fg_vehicle_status_events WHERE company_id = p_company_id;
  DELETE FROM public.fg_position_events WHERE company_id = p_company_id;
  DELETE FROM public.fg_audit_log WHERE company_id = p_company_id;
  DELETE FROM public.fg_cost_profiles WHERE company_id = p_company_id;
  DELETE FROM public.fg_compliance_items WHERE company_id = p_company_id;
  DELETE FROM public.fg_overhead_pools WHERE company_id = p_company_id;
  DELETE FROM public.fg_cpk_targets WHERE company_id = p_company_id;
  DELETE FROM public.fg_telematics_links WHERE company_id = p_company_id;
  DELETE FROM public.fg_import_runs WHERE company_id = p_company_id;
  DELETE FROM public.fg_portal_attempts WHERE company_id = p_company_id;
  DELETE FROM public.fg_portal_sessions WHERE company_id = p_company_id;
  DELETE FROM public.fg_portal_otps WHERE company_id = p_company_id;
  DELETE FROM public.fg_portal_invites WHERE company_id = p_company_id;
  DELETE FROM public.fg_jobs WHERE company_id = p_company_id;
  DELETE FROM public.fg_drivers WHERE company_id = p_company_id;
  DELETE FROM public.fg_vehicles WHERE company_id = p_company_id;
  DELETE FROM public.fg_counters WHERE company_id = p_company_id;
  DELETE FROM public.fg_workspaces WHERE company_id = p_company_id;
  UPDATE public.fg_erase_guard SET token = NULL WHERE id = 1;
  PERFORM set_config('fg.erase_token', '', true);
END;
$$;

DROP TRIGGER IF EXISTS fg_reminder_log_append_only ON public.fg_reminder_log;
CREATE TRIGGER fg_reminder_log_append_only
  BEFORE UPDATE OR DELETE ON public.fg_reminder_log
  FOR EACH ROW EXECUTE FUNCTION public.fg_forbid_mutation();

DROP TRIGGER IF EXISTS fg_reminder_log_no_truncate ON public.fg_reminder_log;
CREATE TRIGGER fg_reminder_log_no_truncate
  BEFORE TRUNCATE ON public.fg_reminder_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.fg_forbid_truncate();

DO $lock$
DECLARE
  rel record;
  fn record;
  append_only boolean;
BEGIN
  FOR rel IN
    SELECT c.relname, c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'fg\_%'
  LOOP
    IF rel.relname = 'fg_erase_guard' THEN
      EXECUTE 'ALTER TABLE public.fg_erase_guard ENABLE ROW LEVEL SECURITY';
      EXECUTE 'ALTER TABLE public.fg_erase_guard FORCE ROW LEVEL SECURITY';
      EXECUTE 'REVOKE ALL ON TABLE public.fg_erase_guard FROM PUBLIC, anon, authenticated, fleet_portal, service_role';
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', rel.relname);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', rel.relname);
    EXECUTE format('DROP POLICY IF EXISTS sa_deny_anon ON public.%I', rel.relname);
    EXECUTE format('CREATE POLICY sa_deny_anon ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)', rel.relname);
    EXECUTE format('DROP POLICY IF EXISTS sa_deny_authenticated ON public.%I', rel.relname);
    EXECUTE format(
      'CREATE POLICY sa_deny_authenticated ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
      rel.relname
    );
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, fleet_portal', rel.relname);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', rel.relname);
    SELECT EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE t.tgrelid = rel.oid
        AND NOT t.tgisinternal
        AND p.proname = 'fg_forbid_truncate'
    ) INTO append_only;
    IF append_only THEN
      EXECUTE format(
        'REVOKE TRUNCATE ON TABLE public.%I FROM PUBLIC, anon, authenticated, fleet_portal, service_role',
        rel.relname
      );
    END IF;
  END LOOP;

  FOR rel IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S' AND c.relname LIKE 'fg\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC, anon, authenticated, fleet_portal', rel.relname);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO service_role', rel.relname);
  END LOOP;

  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'fg\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, fleet_portal', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
  END LOOP;
END
$lock$;

REVOKE ALL ON TABLE public.fg_erase_guard FROM PUBLIC, anon, authenticated, fleet_portal, service_role;
