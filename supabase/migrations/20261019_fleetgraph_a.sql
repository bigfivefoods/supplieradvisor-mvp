-- FleetAdvisor® foundation (Brief 114).
-- Apply manually in the Supabase SQL editor after review.
-- Re-runnable. No seed rows. No truncate. No drop table.
-- Purpose: deny-all fleet tables, an append-only ledger, a portal skeleton,
-- and the cost-per-kilometre settings a later brief will fill with real rows.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fleet_portal') THEN
    CREATE ROLE fleet_portal NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.fg_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  operator_type text NOT NULL DEFAULT 'haulier',
  depot_label text NOT NULL DEFAULT '',
  expiring_window_days integer NOT NULL DEFAULT 30,
  dispatcher_sees_rates boolean NOT NULL DEFAULT false,
  waybill_prefix text NOT NULL DEFAULT '',
  retention_days integer,
  vat_rate_bps integer,
  comms_flags jsonb NOT NULL DEFAULT '{"email":false,"whatsapp":false,"sms":false}'::jsonb,
  real_data_enabled boolean NOT NULL DEFAULT false,
  real_data_confirmed_by text,
  real_data_confirmed_at timestamptz,
  cpk_window_days integer NOT NULL DEFAULT 90,
  cpk_min_km integer NOT NULL DEFAULT 100,
  cpk_min_trips_per_lane integer NOT NULL DEFAULT 3,
  overhead_basis text NOT NULL DEFAULT 'equal_vehicle_days',
  fines_in_cpk boolean NOT NULL DEFAULT false,
  tyre_mode_default text NOT NULL DEFAULT 'accrual',
  overhead_include_subcontractors boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_workspaces_operator CHECK (operator_type IN ('haulier', 'courier', 'bulk', 'in_house', 'mixed')),
  CONSTRAINT fg_workspaces_window CHECK (expiring_window_days BETWEEN 1 AND 365),
  CONSTRAINT fg_workspaces_retention CHECK (retention_days IS NULL OR retention_days BETWEEN 1 AND 3650),
  CONSTRAINT fg_workspaces_vat CHECK (vat_rate_bps IS NULL OR vat_rate_bps BETWEEN 0 AND 10000),
  CONSTRAINT fg_workspaces_cpk_window CHECK (cpk_window_days BETWEEN 1 AND 3660),
  CONSTRAINT fg_workspaces_min_km CHECK (cpk_min_km >= 0),
  CONSTRAINT fg_workspaces_min_trips CHECK (cpk_min_trips_per_lane >= 1),
  CONSTRAINT fg_workspaces_overhead CHECK (overhead_basis IN ('equal_vehicle_days', 'km', 'revenue')),
  CONSTRAINT fg_workspaces_tyre CHECK (tyre_mode_default IN ('accrual', 'ledger'))
);

CREATE TABLE IF NOT EXISTS public.fg_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  reg_no text NOT NULL,
  kind text NOT NULL DEFAULT 'rigid',
  ownership text NOT NULL DEFAULT 'owned',
  make text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  year integer,
  vin text NOT NULL DEFAULT '',
  gvm_kg integer,
  tare_kg integer,
  payload_kg integer,
  fuel_type text NOT NULL DEFAULT '',
  tank_litres numeric,
  odometer_km numeric,
  odometer_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  depot_label text NOT NULL DEFAULT '',
  tracker_fitted boolean NOT NULL DEFAULT false,
  tracker_provider text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_vehicles_kind CHECK (kind IN ('rigid', 'tractor', 'trailer', 'tipper', 'van', 'other')),
  CONSTRAINT fg_vehicles_ownership CHECK (ownership IN ('owned', 'leased', 'subcontractor')),
  CONSTRAINT fg_vehicles_status CHECK (status IN ('active', 'workshop', 'off_road', 'sold')),
  CONSTRAINT fg_vehicles_year CHECK (year IS NULL OR year BETWEEN 1950 AND 2100),
  CONSTRAINT fg_vehicles_odometer CHECK (odometer_km IS NULL OR odometer_km >= 0)
);

DROP INDEX IF EXISTS public.fg_vehicles_reg_unique;
CREATE UNIQUE INDEX fg_vehicles_reg_unique ON public.fg_vehicles (company_id, lower(reg_no)) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS fg_vehicles_company ON public.fg_vehicles (company_id, status);

CREATE TABLE IF NOT EXISTS public.fg_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  employment text NOT NULL DEFAULT 'employee',
  licence_code text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  person_id bigint,
  notes text NOT NULL DEFAULT '',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_drivers_employment CHECK (employment IN ('employee', 'contractor', 'owner_operator')),
  CONSTRAINT fg_drivers_status CHECK (status IN ('active', 'on_leave', 'inactive')),
  CONSTRAINT fg_drivers_email_lower CHECK (email = lower(email))
);

CREATE INDEX IF NOT EXISTS fg_drivers_company ON public.fg_drivers (company_id, status);

CREATE TABLE IF NOT EXISTS public.fg_compliance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  subject_kind text NOT NULL,
  subject_id uuid,
  kind text NOT NULL,
  reference text NOT NULL DEFAULT '',
  issued_on date,
  expires_on date,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_note text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT '',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_compliance_subject CHECK (subject_kind IN ('vehicle', 'driver', 'company')),
  CONSTRAINT fg_compliance_kind CHECK (kind IN (
    'licence_disc', 'roadworthy', 'operator_card', 'insurance', 'cross_border_permit',
    'abnormal_permit', 'other_permit', 'driver_licence', 'prdp', 'medical', 'induction', 'other'
  )),
  CONSTRAINT fg_compliance_reference CHECK (char_length(reference) <= 64)
);

CREATE INDEX IF NOT EXISTS fg_compliance_company ON public.fg_compliance_items (company_id, subject_kind, expires_on);

CREATE TABLE IF NOT EXISTS public.fg_counters (
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  value bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.fg_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  reference text NOT NULL,
  customer_id bigint REFERENCES public.customers (id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  service_type text NOT NULL DEFAULT '',
  cargo_description text NOT NULL DEFAULT '',
  cargo_kg numeric,
  cargo_volume_m3 numeric,
  packages integer,
  status text NOT NULL DEFAULT 'draft',
  dangerous_goods boolean NOT NULL DEFAULT false,
  abnormal boolean NOT NULL DEFAULT false,
  abnormal_dims jsonb,
  cross_border boolean NOT NULL DEFAULT false,
  countries text[] NOT NULL DEFAULT ARRAY[]::text[],
  price_cents bigint,
  notes text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT '',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_jobs_status CHECK (status IN ('draft', 'booked', 'planned', 'in_transit', 'delivered', 'invoiced', 'cancelled')),
  CONSTRAINT fg_jobs_reference_unique UNIQUE (company_id, reference)
);

CREATE INDEX IF NOT EXISTS fg_jobs_company ON public.fg_jobs (company_id, status);

CREATE TABLE IF NOT EXISTS public.fg_job_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.fg_jobs (id) ON DELETE CASCADE,
  seq integer NOT NULL,
  kind text NOT NULL,
  place_name text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  suburb text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  province text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'ZA',
  window_start timestamptz,
  window_end timestamptz,
  contact_name text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_job_stops_kind CHECK (kind IN ('pickup', 'delivery', 'via'))
);

CREATE INDEX IF NOT EXISTS fg_job_stops_company ON public.fg_job_stops (company_id, job_id);

CREATE TABLE IF NOT EXISTS public.fg_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  actor_kind text NOT NULL,
  actor_id text NOT NULL DEFAULT '',
  action text NOT NULL,
  target_kind text NOT NULL DEFAULT '',
  target_id text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_audit_actor CHECK (actor_kind IN ('staff', 'system', 'portal'))
);

CREATE INDEX IF NOT EXISTS fg_audit_company ON public.fg_audit_log (company_id, at DESC);

CREATE TABLE IF NOT EXISTS public.fg_cost_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.fg_vehicles (id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  effective_to date,
  purchase_price_cents bigint,
  residual_cents bigint,
  depreciation_method text NOT NULL DEFAULT 'time',
  life_months integer,
  life_km integer,
  in_service_on date,
  disposed_on date,
  finance_monthly_cents bigint NOT NULL DEFAULT 0,
  insurance_annual_cents bigint NOT NULL DEFAULT 0,
  licences_annual_cents bigint NOT NULL DEFAULT 0,
  tracker_monthly_cents bigint NOT NULL DEFAULT 0,
  other_standing_monthly_cents bigint NOT NULL DEFAULT 0,
  driver_cost_monthly_cents bigint NOT NULL DEFAULT 0,
  tyre_mode text NOT NULL DEFAULT 'accrual',
  tyre_set_cost_cents bigint,
  tyre_life_km integer,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_cost_profiles_method CHECK (depreciation_method IN ('time', 'distance')),
  CONSTRAINT fg_cost_profiles_tyre CHECK (tyre_mode IN ('accrual', 'ledger')),
  CONSTRAINT fg_cost_profiles_range CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX IF NOT EXISTS fg_cost_profiles_vehicle ON public.fg_cost_profiles (company_id, vehicle_id, effective_from);

ALTER TABLE public.fg_cost_profiles DROP CONSTRAINT IF EXISTS fg_cost_profiles_no_overlap;
ALTER TABLE public.fg_cost_profiles
  ADD CONSTRAINT fg_cost_profiles_no_overlap
  EXCLUDE USING gist (
    company_id WITH =,
    vehicle_id WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[)') WITH &&
  );

CREATE TABLE IF NOT EXISTS public.fg_cost_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.fg_vehicles (id) ON DELETE CASCADE,
  trip_id uuid,
  driver_id uuid,
  category text NOT NULL,
  occurred_on date NOT NULL,
  amount_cents bigint NOT NULL,
  vat_cents bigint NOT NULL DEFAULT 0,
  vat_claimable boolean NOT NULL DEFAULT false,
  litres numeric,
  odometer_km numeric,
  full_tank boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual',
  reference text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  reverses_id uuid,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_cost_entries_category CHECK (category IN ('fuel', 'toll', 'border', 'maintenance', 'tyres', 'other_running', 'fine', 'other')),
  CONSTRAINT fg_cost_entries_source CHECK (source IN ('manual', 'import', 'system')),
  CONSTRAINT fg_cost_entries_odo CHECK (odometer_km IS NULL OR odometer_km >= 0)
);

CREATE INDEX IF NOT EXISTS fg_cost_entries_vehicle ON public.fg_cost_entries (company_id, vehicle_id, occurred_on);

CREATE TABLE IF NOT EXISTS public.fg_odometer_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.fg_vehicles (id) ON DELETE CASCADE,
  reading_km numeric NOT NULL,
  read_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  recorded_by text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_odometer_km CHECK (reading_km >= 0),
  CONSTRAINT fg_odometer_source CHECK (source IN ('manual', 'trip_start', 'trip_end', 'fuel', 'service', 'import', 'telematics'))
);

CREATE INDEX IF NOT EXISTS fg_odometer_vehicle ON public.fg_odometer_readings (company_id, vehicle_id, read_at);

CREATE TABLE IF NOT EXISTS public.fg_vehicle_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.fg_vehicles (id) ON DELETE CASCADE,
  status text NOT NULL,
  from_at timestamptz NOT NULL,
  by_actor text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_status_events_status CHECK (status IN ('active', 'workshop', 'off_road', 'sold'))
);

CREATE INDEX IF NOT EXISTS fg_status_events_vehicle ON public.fg_vehicle_status_events (company_id, vehicle_id, from_at);

CREATE TABLE IF NOT EXISTS public.fg_overhead_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  period_month date NOT NULL,
  amount_cents bigint NOT NULL,
  basis text NOT NULL DEFAULT 'equal_vehicle_days',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_overhead_basis CHECK (basis IN ('equal_vehicle_days', 'km', 'revenue')),
  CONSTRAINT fg_overhead_month UNIQUE (company_id, period_month)
);

CREATE TABLE IF NOT EXISTS public.fg_cpk_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  scope_kind text NOT NULL,
  scope_ref text NOT NULL DEFAULT '',
  layer text NOT NULL,
  target_cents_per_km numeric(12, 4) NOT NULL,
  effective_from date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_cpk_targets_scope CHECK (scope_kind IN ('fleet', 'vehicle_class', 'vehicle', 'lane')),
  CONSTRAINT fg_cpk_targets_layer CHECK (layer IN ('fully_loaded', 'operating'))
);

CREATE INDEX IF NOT EXISTS fg_cpk_targets_company ON public.fg_cpk_targets (company_id, scope_kind, effective_from);

CREATE TABLE IF NOT EXISTS public.fg_position_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.fg_vehicles (id) ON DELETE CASCADE,
  trip_id uuid,
  at timestamptz NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  speed_kmh numeric,
  heading numeric,
  ignition boolean,
  accuracy_m numeric,
  source text NOT NULL,
  import_run_id uuid,
  provider_ref text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_position_source CHECK (source IN ('driver_phone', 'telematics', 'csv_import', 'gpx_import', 'manual'))
);

CREATE INDEX IF NOT EXISTS fg_position_vehicle_at ON public.fg_position_events (company_id, vehicle_id, at DESC);

CREATE TABLE IF NOT EXISTS public.fg_telematics_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.fg_vehicles (id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT '',
  external_vehicle_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'inactive',
  secret_hash text NOT NULL DEFAULT '',
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS fg_telematics_company ON public.fg_telematics_links (company_id, vehicle_id);

CREATE TABLE IF NOT EXISTS public.fg_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  row_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_hash text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT '',
  dry_run boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_import_kind CHECK (kind IN ('gps_csv', 'gpx', 'ship_vehicles', 'ship_drivers', 'fuel_csv', 'toll_csv'))
);

CREATE INDEX IF NOT EXISTS fg_import_company ON public.fg_import_runs (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.fg_portal_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  portal text NOT NULL,
  subject_kind text NOT NULL DEFAULT '',
  subject_id uuid,
  email text,
  token_hash text NOT NULL,
  token_hint text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_portal_invites_portal CHECK (portal IN ('driver', 'consignor', 'tracking')),
  CONSTRAINT fg_portal_invites_hint CHECK (char_length(token_hint) = 4)
);

CREATE INDEX IF NOT EXISTS fg_portal_invites_hash ON public.fg_portal_invites (token_hash);

CREATE TABLE IF NOT EXISTS public.fg_portal_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  invite_id uuid REFERENCES public.fg_portal_invites (id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS fg_portal_otps_invite ON public.fg_portal_otps (company_id, invite_id);

CREATE TABLE IF NOT EXISTS public.fg_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  portal text NOT NULL,
  subject_kind text NOT NULL DEFAULT '',
  subject_id uuid,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_portal_sessions_portal CHECK (portal IN ('driver', 'consignor', 'tracking'))
);

CREATE TABLE IF NOT EXISTS public.fg_portal_attempts (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  portal text NOT NULL DEFAULT '',
  scope text NOT NULL,
  key_hash text NOT NULL,
  at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT fg_portal_attempts_scope CHECK (scope IN ('email', 'invite', 'ip'))
);

CREATE INDEX IF NOT EXISTS fg_portal_attempts_window ON public.fg_portal_attempts (company_id, at);
CREATE INDEX IF NOT EXISTS fg_portal_attempts_key ON public.fg_portal_attempts (company_id, scope, key_hash, at);

CREATE TABLE IF NOT EXISTS public.fg_erase_guard (
  id integer PRIMARY KEY,
  token text
);

CREATE OR REPLACE FUNCTION public.fg_forbid_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text;
  v_guard text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_token := NULLIF(pg_catalog.current_setting('fg.erase_token', true), '');
    IF v_token IS NOT NULL THEN
      SELECT g.token INTO v_guard FROM public.fg_erase_guard AS g WHERE g.id = 1;
      IF v_guard IS NOT NULL AND length(v_guard) >= 32 AND v_token = v_guard THEN
        RETURN OLD;
      END IF;
    END IF;
  END IF;
  RAISE EXCEPTION 'fg_append_only' USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.fg_next_number(p_company_id bigint, p_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v bigint;
BEGIN
  IF p_company_id IS NULL OR p_company_id <= 0 OR p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'fg_next_number_closed' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.fg_counters AS c (company_id, name, value)
  VALUES (p_company_id, p_name, 1)
  ON CONFLICT (company_id, name) DO UPDATE SET value = c.value + 1, updated_at = pg_catalog.now()
  RETURNING value INTO v;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.fg_portal_call(p_portal text, p_token_hash text, p_op text, p_args jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_op = 'ping' THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'op', 'ping');
  END IF;
  RETURN pg_catalog.jsonb_build_object('ok', false, 'error', 'denied');
END;
$$;

CREATE OR REPLACE FUNCTION public.fg_portal_register_failure(
  p_company_id bigint,
  p_scope text,
  p_key_hash text,
  p_otp_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v integer;
BEGIN
  IF p_company_id IS NULL OR p_company_id <= 0 OR p_scope IS NULL OR btrim(p_scope) = '' OR p_key_hash IS NULL OR btrim(p_key_hash) = '' THEN
    RAISE EXCEPTION 'fg_portal_register_failure_closed' USING ERRCODE = '22023';
  END IF;
  IF p_scope NOT IN ('email', 'invite', 'ip') THEN
    RAISE EXCEPTION 'fg_portal_register_failure_closed' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.fg_portal_attempts (company_id, portal, scope, key_hash, at)
  VALUES (p_company_id, '', p_scope, p_key_hash, pg_catalog.now());
  IF p_otp_id IS NULL THEN
    RETURN 0;
  END IF;
  UPDATE public.fg_portal_otps
  SET failed_attempts = failed_attempts + 1,
      used_at = CASE WHEN failed_attempts + 1 >= 5 THEN pg_catalog.now() ELSE used_at END,
      updated_at = pg_catalog.now()
  WHERE id = p_otp_id AND company_id = p_company_id
  RETURNING failed_attempts INTO v;
  RETURN COALESCE(v, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.fg_portal_is_throttled(
  p_company_id bigint,
  p_scope text,
  p_key_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  workspace_count integer;
  key_count integer;
BEGIN
  IF p_company_id IS NULL OR p_company_id <= 0 OR p_scope IS NULL OR btrim(p_scope) = '' OR p_key_hash IS NULL OR btrim(p_key_hash) = '' THEN
    RETURN true;
  END IF;
  IF p_scope NOT IN ('email', 'invite', 'ip') THEN
    RETURN true;
  END IF;
  SELECT count(*) INTO workspace_count
  FROM public.fg_portal_attempts
  WHERE company_id = p_company_id AND at > pg_catalog.now() - interval '15 minutes';
  IF workspace_count > 50 THEN
    RETURN true;
  END IF;
  SELECT count(*) INTO key_count
  FROM public.fg_portal_attempts
  WHERE company_id = p_company_id
    AND scope = p_scope
    AND key_hash = p_key_hash
    AND at > pg_catalog.now() - interval '15 minutes';
  IF key_count > 10 THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.fg_verify_code_ct(p_left text, p_right text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  i integer;
  n integer;
  la integer;
  lb integer;
  diff integer := 0;
  ca integer;
  cb integer;
BEGIN
  IF p_left IS NULL OR p_right IS NULL THEN
    RETURN false;
  END IF;
  la := char_length(p_left);
  lb := char_length(p_right);
  IF la = 0 OR lb = 0 THEN
    RETURN false;
  END IF;
  IF la <> lb THEN
    diff := 1;
  END IF;
  n := GREATEST(la, lb);
  FOR i IN 1..n LOOP
    ca := CASE WHEN i <= la THEN ascii(substr(p_left, i, 1)) ELSE 0 END;
    cb := CASE WHEN i <= lb THEN ascii(substr(p_right, i, 1)) ELSE 0 END;
    diff := diff | (ca # cb);
  END LOOP;
  RETURN diff = 0;
END;
$$;

ALTER TABLE public.fg_jobs ADD COLUMN IF NOT EXISTS vehicle_id uuid;
ALTER TABLE public.fg_jobs ADD COLUMN IF NOT EXISTS driver_id uuid;
ALTER TABLE public.fg_odometer_readings ADD COLUMN IF NOT EXISTS anomaly boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS fg_vehicles_company_id ON public.fg_vehicles (company_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS fg_drivers_company_id ON public.fg_drivers (company_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS fg_jobs_company_id ON public.fg_jobs (company_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS fg_portal_invites_token_hash_key ON public.fg_portal_invites (token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS fg_cost_entries_one_reversal ON public.fg_cost_entries (reverses_id) WHERE reverses_id IS NOT NULL;

DO $fk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fg_cost_profiles_company_vehicle') THEN
    ALTER TABLE public.fg_cost_profiles
      ADD CONSTRAINT fg_cost_profiles_company_vehicle
      FOREIGN KEY (company_id, vehicle_id) REFERENCES public.fg_vehicles (company_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fg_cost_entries_company_vehicle') THEN
    ALTER TABLE public.fg_cost_entries
      ADD CONSTRAINT fg_cost_entries_company_vehicle
      FOREIGN KEY (company_id, vehicle_id) REFERENCES public.fg_vehicles (company_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fg_odometer_company_vehicle') THEN
    ALTER TABLE public.fg_odometer_readings
      ADD CONSTRAINT fg_odometer_company_vehicle
      FOREIGN KEY (company_id, vehicle_id) REFERENCES public.fg_vehicles (company_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fg_status_company_vehicle') THEN
    ALTER TABLE public.fg_vehicle_status_events
      ADD CONSTRAINT fg_status_company_vehicle
      FOREIGN KEY (company_id, vehicle_id) REFERENCES public.fg_vehicles (company_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fg_position_company_vehicle') THEN
    ALTER TABLE public.fg_position_events
      ADD CONSTRAINT fg_position_company_vehicle
      FOREIGN KEY (company_id, vehicle_id) REFERENCES public.fg_vehicles (company_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fg_telematics_company_vehicle') THEN
    ALTER TABLE public.fg_telematics_links
      ADD CONSTRAINT fg_telematics_company_vehicle
      FOREIGN KEY (company_id, vehicle_id) REFERENCES public.fg_vehicles (company_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fg_job_stops_company_job') THEN
    ALTER TABLE public.fg_job_stops
      ADD CONSTRAINT fg_job_stops_company_job
      FOREIGN KEY (company_id, job_id) REFERENCES public.fg_jobs (company_id, id) ON DELETE CASCADE;
  END IF;
END
$fk$;

ALTER TABLE public.fg_jobs DROP CONSTRAINT IF EXISTS fg_jobs_company_vehicle;
ALTER TABLE public.fg_jobs
  ADD CONSTRAINT fg_jobs_company_vehicle
  FOREIGN KEY (company_id, vehicle_id) REFERENCES public.fg_vehicles (company_id, id) ON DELETE SET NULL (vehicle_id);

ALTER TABLE public.fg_jobs DROP CONSTRAINT IF EXISTS fg_jobs_company_driver;
ALTER TABLE public.fg_jobs
  ADD CONSTRAINT fg_jobs_company_driver
  FOREIGN KEY (company_id, driver_id) REFERENCES public.fg_drivers (company_id, id) ON DELETE SET NULL (driver_id);

ALTER TABLE public.fg_cost_entries DROP CONSTRAINT IF EXISTS fg_cost_entries_company_driver;
ALTER TABLE public.fg_cost_entries
  ADD CONSTRAINT fg_cost_entries_company_driver
  FOREIGN KEY (company_id, driver_id) REFERENCES public.fg_drivers (company_id, id) ON DELETE SET NULL (driver_id);

ALTER TABLE public.fg_job_stops DROP CONSTRAINT IF EXISTS fg_job_stops_seq;
ALTER TABLE public.fg_job_stops
  ADD CONSTRAINT fg_job_stops_seq UNIQUE (job_id, seq) DEFERRABLE INITIALLY DEFERRED;

CREATE UNIQUE INDEX IF NOT EXISTS fg_cost_entries_company_id ON public.fg_cost_entries (company_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS customers_profile_id_id ON public.customers (profile_id, id);

DO $reverses_fk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fg_cost_entries_reverses') THEN
    ALTER TABLE public.fg_cost_entries
      ADD CONSTRAINT fg_cost_entries_reverses
      FOREIGN KEY (company_id, reverses_id) REFERENCES public.fg_cost_entries (company_id, id);
  END IF;
END
$reverses_fk$;

DO $customer_fk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fg_jobs_company_customer') THEN
    ALTER TABLE public.fg_jobs
      ADD CONSTRAINT fg_jobs_company_customer
      FOREIGN KEY (company_id, customer_id) REFERENCES public.customers (profile_id, id);
  END IF;
END
$customer_fk$;

ALTER TABLE public.fg_workspaces ADD COLUMN IF NOT EXISTS required_margin_bps integer NOT NULL DEFAULT 1000;
DO $margin$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fg_workspaces_margin') THEN
    ALTER TABLE public.fg_workspaces
      ADD CONSTRAINT fg_workspaces_margin CHECK (required_margin_bps BETWEEN 0 AND 9999);
  END IF;
END
$margin$;

CREATE OR REPLACE FUNCTION public.fg_forbid_truncate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'fg_append_only' USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.fg_reject_reversal_of_reversal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.reverses_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.fg_cost_entries WHERE id = NEW.reverses_id AND reverses_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'fg_reverse_closed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
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

CREATE OR REPLACE FUNCTION public.fg_commit_diff(p_company_id bigint, p_diff jsonb)
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

  IF pg_catalog.jsonb_typeof(p_diff->'delete_stop_ids') = 'array' THEN
    DELETE FROM public.fg_job_stops
    WHERE company_id = p_company_id
      AND id IN (
        SELECT (value #>> '{}')::uuid
        FROM pg_catalog.jsonb_array_elements(p_diff->'delete_stop_ids')
      );
  END IF;

  FOREACH v_table IN ARRAY ARRAY[
    'fg_workspaces', 'fg_vehicles', 'fg_drivers', 'fg_compliance_items', 'fg_jobs', 'fg_job_stops',
    'fg_cost_profiles', 'fg_overhead_pools', 'fg_cpk_targets'
  ]
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

  FOREACH v_table IN ARRAY ARRAY['fg_cost_entries', 'fg_odometer_readings', 'fg_vehicle_status_events', 'fg_audit_log']
  LOOP
    IF pg_catalog.jsonb_typeof(p_diff->'inserts'->v_table) IS DISTINCT FROM 'array' THEN
      CONTINUE;
    END IF;
    FOR v_row IN SELECT value FROM pg_catalog.jsonb_array_elements(p_diff->'inserts'->v_table)
    LOOP
      IF (v_row->>'company_id')::bigint IS DISTINCT FROM p_company_id THEN
        RAISE EXCEPTION 'fg_commit_closed' USING ERRCODE = '22023';
      END IF;
      SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
        INTO v_cols
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = v_table
        AND c.column_name <> 'created_at'
        AND (v_row ? c.column_name);
      IF v_cols IS NULL THEN
        RAISE EXCEPTION 'fg_commit_closed' USING ERRCODE = '22023';
      END IF;
      EXECUTE format(
        'INSERT INTO public.%I (%s) SELECT %s FROM pg_catalog.jsonb_populate_record(NULL::public.%I, $1) AS rec',
        v_table, v_cols, v_cols, v_table
      ) USING v_row;
    END LOOP;
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS fg_audit_log_append_only ON public.fg_audit_log;
CREATE TRIGGER fg_audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.fg_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.fg_forbid_mutation();

DROP TRIGGER IF EXISTS fg_cost_entries_append_only ON public.fg_cost_entries;
CREATE TRIGGER fg_cost_entries_append_only
  BEFORE UPDATE OR DELETE ON public.fg_cost_entries
  FOR EACH ROW EXECUTE FUNCTION public.fg_forbid_mutation();

DROP TRIGGER IF EXISTS fg_odometer_append_only ON public.fg_odometer_readings;
CREATE TRIGGER fg_odometer_append_only
  BEFORE UPDATE OR DELETE ON public.fg_odometer_readings
  FOR EACH ROW EXECUTE FUNCTION public.fg_forbid_mutation();

DROP TRIGGER IF EXISTS fg_status_events_append_only ON public.fg_vehicle_status_events;
CREATE TRIGGER fg_status_events_append_only
  BEFORE UPDATE OR DELETE ON public.fg_vehicle_status_events
  FOR EACH ROW EXECUTE FUNCTION public.fg_forbid_mutation();

DROP TRIGGER IF EXISTS fg_position_append_only ON public.fg_position_events;
CREATE TRIGGER fg_position_append_only
  BEFORE UPDATE OR DELETE ON public.fg_position_events
  FOR EACH ROW EXECUTE FUNCTION public.fg_forbid_mutation();

DROP TRIGGER IF EXISTS fg_audit_log_no_truncate ON public.fg_audit_log;
CREATE TRIGGER fg_audit_log_no_truncate
  BEFORE TRUNCATE ON public.fg_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.fg_forbid_truncate();

DROP TRIGGER IF EXISTS fg_cost_entries_no_truncate ON public.fg_cost_entries;
CREATE TRIGGER fg_cost_entries_no_truncate
  BEFORE TRUNCATE ON public.fg_cost_entries
  FOR EACH STATEMENT EXECUTE FUNCTION public.fg_forbid_truncate();

DROP TRIGGER IF EXISTS fg_odometer_no_truncate ON public.fg_odometer_readings;
CREATE TRIGGER fg_odometer_no_truncate
  BEFORE TRUNCATE ON public.fg_odometer_readings
  FOR EACH STATEMENT EXECUTE FUNCTION public.fg_forbid_truncate();

DROP TRIGGER IF EXISTS fg_status_events_no_truncate ON public.fg_vehicle_status_events;
CREATE TRIGGER fg_status_events_no_truncate
  BEFORE TRUNCATE ON public.fg_vehicle_status_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.fg_forbid_truncate();

DROP TRIGGER IF EXISTS fg_position_no_truncate ON public.fg_position_events;
CREATE TRIGGER fg_position_no_truncate
  BEFORE TRUNCATE ON public.fg_position_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.fg_forbid_truncate();

DROP TRIGGER IF EXISTS fg_cost_entries_no_double_reverse ON public.fg_cost_entries;
CREATE TRIGGER fg_cost_entries_no_double_reverse
  BEFORE INSERT ON public.fg_cost_entries
  FOR EACH ROW EXECUTE FUNCTION public.fg_reject_reversal_of_reversal();

DO $lock$
DECLARE
  rel record;
  fn record;
BEGIN
  FOR rel IN
    SELECT c.relname
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
    IF rel.relname IN (
      'fg_audit_log',
      'fg_cost_entries',
      'fg_odometer_readings',
      'fg_vehicle_status_events',
      'fg_position_events'
    ) THEN
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
