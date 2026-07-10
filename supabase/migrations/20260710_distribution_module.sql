-- Distribution module: carriers, fleet, drivers, shipments, tracking events.
-- Extends world_class shipments/carriers. Safe to re-run.

-- ── Carriers (extend) ────────────────────────────────────────────────────────
SELECT public.sa_add_column('carriers', 'code', 'text');
SELECT public.sa_add_column('carriers', 'carrier_type', 'text', '''3pl'''); -- 3pl | courier | ocean | air | rail | last_mile | own_fleet
SELECT public.sa_add_column('carriers', 'modes', 'text[]', '''{road}''');
SELECT public.sa_add_column('carriers', 'service_level', 'text'); -- standard | express | economy | reefer
SELECT public.sa_add_column('carriers', 'coverage_regions', 'text');
SELECT public.sa_add_column('carriers', 'otif_pct', 'numeric(6,2)');
SELECT public.sa_add_column('carriers', 'avg_transit_days', 'numeric(8,2)');
SELECT public.sa_add_column('carriers', 'rating', 'numeric(4,2)');
SELECT public.sa_add_column('carriers', 'website', 'text');
SELECT public.sa_add_column('carriers', 'notes', 'text');
SELECT public.sa_add_column('carriers', 'status', 'text', '''active'''); -- active | suspended | inactive
SELECT public.sa_add_column('carriers', 'updated_at', 'timestamptz', 'now()');
SELECT public.sa_create_index('idx_carriers_profile', 'carriers', 'profile_id');

-- ── Fleet vehicles ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.distribution_vehicles (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text,
  vehicle_type text DEFAULT 'van', -- van | truck | reefer | trailer | bike | container
  plate_number text,
  make_model text,
  capacity_kg numeric(14,2),
  capacity_cbm numeric(14,4),
  status text NOT NULL DEFAULT 'available', -- available | in_use | maintenance | offline
  current_driver_id bigint,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, code)
);
SELECT public.sa_add_column('distribution_vehicles', 'profile_id', 'bigint');
SELECT public.sa_add_column('distribution_vehicles', 'code', 'text');
SELECT public.sa_add_column('distribution_vehicles', 'name', 'text');
SELECT public.sa_add_column('distribution_vehicles', 'vehicle_type', 'text', '''van''');
SELECT public.sa_add_column('distribution_vehicles', 'plate_number', 'text');
SELECT public.sa_add_column('distribution_vehicles', 'make_model', 'text');
SELECT public.sa_add_column('distribution_vehicles', 'capacity_kg', 'numeric(14,2)');
SELECT public.sa_add_column('distribution_vehicles', 'capacity_cbm', 'numeric(14,4)');
SELECT public.sa_add_column('distribution_vehicles', 'status', 'text', '''available''');
SELECT public.sa_add_column('distribution_vehicles', 'current_driver_id', 'bigint');
SELECT public.sa_add_column('distribution_vehicles', 'notes', 'text');
SELECT public.sa_add_column('distribution_vehicles', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_create_index('idx_dist_vehicles_profile', 'distribution_vehicles', 'profile_id');

-- ── Drivers ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.distribution_drivers (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  full_name text NOT NULL,
  phone text,
  email text,
  license_number text,
  license_class text,
  status text NOT NULL DEFAULT 'available', -- available | on_route | off_duty | suspended
  vehicle_id bigint,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, code)
);
SELECT public.sa_add_column('distribution_drivers', 'profile_id', 'bigint');
SELECT public.sa_add_column('distribution_drivers', 'code', 'text');
SELECT public.sa_add_column('distribution_drivers', 'full_name', 'text');
SELECT public.sa_add_column('distribution_drivers', 'phone', 'text');
SELECT public.sa_add_column('distribution_drivers', 'email', 'text');
SELECT public.sa_add_column('distribution_drivers', 'license_number', 'text');
SELECT public.sa_add_column('distribution_drivers', 'license_class', 'text');
SELECT public.sa_add_column('distribution_drivers', 'status', 'text', '''available''');
SELECT public.sa_add_column('distribution_drivers', 'vehicle_id', 'bigint');
SELECT public.sa_add_column('distribution_drivers', 'notes', 'text');
SELECT public.sa_add_column('distribution_drivers', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_create_index('idx_dist_drivers_profile', 'distribution_drivers', 'profile_id');

-- ── Shipments (extend world_class) ───────────────────────────────────────────
SELECT public.sa_add_column('shipments', 'shipment_number', 'text');
SELECT public.sa_add_column('shipments', 'carrier_id', 'bigint');
SELECT public.sa_add_column('shipments', 'vehicle_id', 'bigint');
SELECT public.sa_add_column('shipments', 'driver_id', 'bigint');
SELECT public.sa_add_column('shipments', 'mode', 'text', '''road'''); -- road | rail | ocean | air | multimodal | last_mile
SELECT public.sa_add_column('shipments', 'service_level', 'text', '''standard''');
SELECT public.sa_add_column('shipments', 'priority', 'int', '50');
SELECT public.sa_add_column('shipments', 'origin_name', 'text');
SELECT public.sa_add_column('shipments', 'origin_city', 'text');
SELECT public.sa_add_column('shipments', 'origin_country', 'text');
SELECT public.sa_add_column('shipments', 'origin_lat', 'numeric(10,7)');
SELECT public.sa_add_column('shipments', 'origin_lng', 'numeric(10,7)');
SELECT public.sa_add_column('shipments', 'destination_name', 'text');
SELECT public.sa_add_column('shipments', 'destination_city', 'text');
SELECT public.sa_add_column('shipments', 'destination_country', 'text');
SELECT public.sa_add_column('shipments', 'destination_lat', 'numeric(10,7)');
SELECT public.sa_add_column('shipments', 'destination_lng', 'numeric(10,7)');
SELECT public.sa_add_column('shipments', 'eta', 'timestamptz');
SELECT public.sa_add_column('shipments', 'ata', 'timestamptz'); -- actual arrival
SELECT public.sa_add_column('shipments', 'weight_kg', 'numeric(14,3)');
SELECT public.sa_add_column('shipments', 'volume_cbm', 'numeric(14,4)');
SELECT public.sa_add_column('shipments', 'packages', 'int');
SELECT public.sa_add_column('shipments', 'container_number', 'text');
SELECT public.sa_add_column('shipments', 'bol_number', 'text');
SELECT public.sa_add_column('shipments', 'awb_number', 'text');
SELECT public.sa_add_column('shipments', 'po_reference', 'text');
SELECT public.sa_add_column('shipments', 'customer_ref', 'text');
SELECT public.sa_add_column('shipments', 'supplier_ref', 'text');
SELECT public.sa_add_column('shipments', 'notes', 'text');
SELECT public.sa_add_column('shipments', 'progress_pct', 'numeric(6,2)', '0');
SELECT public.sa_add_column('shipments', 'last_event_at', 'timestamptz');
SELECT public.sa_add_column('shipments', 'last_event_label', 'text');
SELECT public.sa_create_index('idx_shipments_profile', 'shipments', 'profile_id');
SELECT public.sa_create_index('idx_shipments_direction', 'shipments', 'profile_id, direction');
SELECT public.sa_create_index('idx_shipments_status', 'shipments', 'profile_id, status');

-- ── Tracking events (supply-chain visibility spine) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.distribution_shipment_events (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shipment_id bigint NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  event_code text NOT NULL DEFAULT 'update', -- booked | picked_up | departed | arrived_hub | customs | out_for_delivery | delivered | exception | note
  label text NOT NULL,
  location text,
  city text,
  country text,
  lat numeric(10,7),
  lng numeric(10,7),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text DEFAULT 'manual', -- manual | driver | carrier | system | gps
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('distribution_shipment_events', 'profile_id', 'bigint');
SELECT public.sa_add_column('distribution_shipment_events', 'shipment_id', 'bigint');
SELECT public.sa_add_column('distribution_shipment_events', 'event_code', 'text', '''update''');
SELECT public.sa_add_column('distribution_shipment_events', 'label', 'text');
SELECT public.sa_add_column('distribution_shipment_events', 'location', 'text');
SELECT public.sa_add_column('distribution_shipment_events', 'city', 'text');
SELECT public.sa_add_column('distribution_shipment_events', 'country', 'text');
SELECT public.sa_add_column('distribution_shipment_events', 'lat', 'numeric(10,7)');
SELECT public.sa_add_column('distribution_shipment_events', 'lng', 'numeric(10,7)');
SELECT public.sa_add_column('distribution_shipment_events', 'occurred_at', 'timestamptz');
SELECT public.sa_add_column('distribution_shipment_events', 'source', 'text', '''manual''');
SELECT public.sa_add_column('distribution_shipment_events', 'notes', 'text');
SELECT public.sa_add_column('distribution_shipment_events', 'metadata', 'jsonb', '''{}''::jsonb');
SELECT public.sa_create_index('idx_dist_events_shipment', 'distribution_shipment_events', 'shipment_id');
SELECT public.sa_create_index('idx_dist_events_profile', 'distribution_shipment_events', 'profile_id');

-- ── Company distribution prefs (default Incoterms etc.) ──────────────────────
CREATE TABLE IF NOT EXISTS public.distribution_settings (
  id bigserial PRIMARY KEY,
  profile_id bigint UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  default_incoterm text DEFAULT 'DAP',
  default_mode text DEFAULT 'road',
  track_gps boolean DEFAULT true,
  require_pod boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT public.sa_add_column('distribution_settings', 'profile_id', 'bigint');
SELECT public.sa_add_column('distribution_settings', 'default_incoterm', 'text', '''DAP''');
SELECT public.sa_add_column('distribution_settings', 'default_mode', 'text', '''road''');
SELECT public.sa_add_column('distribution_settings', 'track_gps', 'boolean', 'true');
SELECT public.sa_add_column('distribution_settings', 'require_pod', 'boolean', 'true');
SELECT public.sa_add_column('distribution_settings', 'metadata', 'jsonb', '''{}''::jsonb');
