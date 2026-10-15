export type FleetRole = 'owner' | 'manager' | 'dispatcher' | 'office' | 'viewer' | 'none';

export type OperatorType = 'haulier' | 'courier' | 'bulk' | 'in_house' | 'mixed';
export type VehicleKind = 'rigid' | 'tractor' | 'trailer' | 'tipper' | 'van' | 'other';
export type Ownership = 'owned' | 'leased' | 'subcontractor';
export type VehicleStatus = 'active' | 'workshop' | 'off_road' | 'sold';
export type Employment = 'employee' | 'contractor' | 'owner_operator';
export type DriverStatus = 'active' | 'on_leave' | 'inactive';
export type JobStatus = 'draft' | 'booked' | 'cancelled';
export type StopKind = 'pickup' | 'delivery' | 'via';
export type SubjectKind = 'vehicle' | 'driver' | 'company';
export type ComplianceKind =
  | 'licence_disc'
  | 'roadworthy'
  | 'operator_card'
  | 'insurance'
  | 'cross_border_permit'
  | 'abnormal_permit'
  | 'other_permit'
  | 'driver_licence'
  | 'prdp'
  | 'medical'
  | 'induction'
  | 'other';
export type OverheadBasis = 'equal_vehicle_days' | 'km' | 'revenue';
export type TyreMode = 'accrual' | 'ledger';
export type DepreciationMethod = 'time' | 'distance';
export type RunningCategory = 'fuel' | 'toll' | 'border' | 'maintenance' | 'tyres' | 'other_running' | 'fine' | 'other';
export type OdometerSource = 'manual' | 'trip_start' | 'trip_end' | 'fuel' | 'service' | 'import' | 'telematics';

export type FleetWorkspace = {
  id: string;
  company_id: number;
  display_name: string;
  operator_type: OperatorType;
  depot_label: string;
  expiring_window_days: number;
  dispatcher_sees_rates: boolean;
  waybill_prefix: string;
  retention_days: number | null;
  vat_rate_bps: number | null;
  comms_flags: { email: boolean; whatsapp: boolean; sms: boolean };
  real_data_enabled: boolean;
  real_data_confirmed_by: string | null;
  real_data_confirmed_at: string | null;
  cpk_window_days: number;
  cpk_min_km: number;
  cpk_min_trips_per_lane: number;
  overhead_basis: OverheadBasis;
  fines_in_cpk: boolean;
  tyre_mode_default: TyreMode;
  overhead_include_subcontractors: boolean;
  /** Basis points. 1000 is a 10% margin on the required rate. */
  required_margin_bps: number;
  updated_at: string;
};

export type FleetVehicle = {
  id: string;
  company_id: number;
  reg_no: string;
  kind: VehicleKind;
  ownership: Ownership;
  make: string;
  model: string;
  year: number | null;
  vin: string;
  gvm_kg: number | null;
  tare_kg: number | null;
  payload_kg: number | null;
  fuel_type: string;
  tank_litres: number | null;
  odometer_km: number | null;
  odometer_at: string | null;
  status: VehicleStatus;
  depot_label: string;
  tracker_fitted: boolean;
  tracker_provider: string;
  notes: string;
  archived_at: string | null;
  updated_at: string;
};

export type FleetDriver = {
  id: string;
  company_id: number;
  full_name: string;
  phone: string;
  email: string;
  employment: Employment;
  licence_code: string;
  status: DriverStatus;
  person_id: number | null;
  notes: string;
  archived_at: string | null;
  updated_at: string;
};

export type FleetCompliance = {
  id: string;
  company_id: number;
  subject_kind: SubjectKind;
  subject_id: string | null;
  kind: ComplianceKind;
  reference: string;
  issued_on: string | null;
  expires_on: string | null;
  detail: Record<string, unknown>;
  status_note: string;
  archived_at: string | null;
  updated_at: string;
};

export type FleetJob = {
  id: string;
  company_id: number;
  reference: string;
  customer_id: number | null;
  customer_name: string;
  service_type: string;
  cargo_description: string;
  cargo_kg: number | null;
  cargo_volume_m3: number | null;
  packages: number | null;
  status: JobStatus;
  dangerous_goods: boolean;
  abnormal: boolean;
  abnormal_dims: Record<string, unknown> | null;
  cross_border: boolean;
  countries: string[];
  price_cents: number | null;
  notes: string;
  vehicle_id: string | null;
  driver_id: string | null;
  archived_at: string | null;
  updated_at: string;
};

export type FleetStop = {
  id: string;
  company_id: number;
  job_id: string;
  seq: number;
  kind: StopKind;
  place_name: string;
  address: string;
  suburb: string;
  city: string;
  province: string;
  country: string;
  window_start: string | null;
  window_end: string | null;
  contact_name: string;
  contact_phone: string;
  instructions: string;
  updated_at: string;
};

export type FleetCostProfile = {
  id: string;
  company_id: number;
  vehicle_id: string;
  effective_from: string;
  effective_to: string | null;
  purchase_price_cents: number | null;
  residual_cents: number | null;
  depreciation_method: DepreciationMethod;
  life_months: number | null;
  life_km: number | null;
  in_service_on: string | null;
  disposed_on: string | null;
  finance_monthly_cents: number;
  insurance_annual_cents: number;
  licences_annual_cents: number;
  tracker_monthly_cents: number;
  other_standing_monthly_cents: number;
  driver_cost_monthly_cents: number;
  tyre_mode: TyreMode;
  tyre_set_cost_cents: number | null;
  tyre_life_km: number | null;
  updated_at: string;
};

export type FleetCostEntry = {
  id: string;
  company_id: number;
  vehicle_id: string;
  trip_id: string | null;
  driver_id: string | null;
  category: RunningCategory;
  occurred_on: string;
  amount_cents: number;
  vat_cents: number;
  vat_claimable: boolean;
  litres: number | null;
  odometer_km: number | null;
  full_tank: boolean;
  source: 'manual' | 'import' | 'system';
  reference: string;
  note: string;
  reverses_id: string | null;
  created_at: string;
};

export type FleetOdometer = {
  id: string;
  company_id: number;
  vehicle_id: string;
  reading_km: number;
  read_at: string;
  source: OdometerSource;
  note: string;
  recorded_by: string;
  anomaly: boolean;
  created_at: string;
};

export type FleetStatusEvent = {
  id: string;
  company_id: number;
  vehicle_id: string;
  status: VehicleStatus;
  from_at: string;
  note: string;
  by_actor: string;
  created_at: string;
};

export type FleetOverhead = {
  id: string;
  company_id: number;
  period_month: string;
  amount_cents: number;
  basis: OverheadBasis;
  updated_at: string;
};

export type FleetTarget = {
  id: string;
  company_id: number;
  scope_kind: 'fleet' | 'vehicle_class' | 'vehicle' | 'lane';
  scope_ref: string;
  layer: 'fully_loaded' | 'operating';
  target_cents_per_km: number;
  effective_from: string;
  updated_at: string;
  created_at?: string;
};

export type FleetAudit = {
  id: string;
  company_id: number;
  actor_kind: 'staff' | 'system' | 'portal';
  actor_id: string;
  action: string;
  target_kind: string;
  target_id: string;
  payload: Record<string, unknown>;
  at: string;
};

export type FleetCustomer = {
  id: number;
  trading_name: string;
  status?: string;
};

export type FleetTrip = {
  id: string;
  vehicle_id: string;
  job_id: string | null;
  on_date: string;
  loaded_km: number | null;
};

export type FleetBook = {
  workspace: FleetWorkspace;
  vehicles: FleetVehicle[];
  drivers: FleetDriver[];
  customers: FleetCustomer[];
  trips: FleetTrip[];
  compliance: FleetCompliance[];
  jobs: FleetJob[];
  stops: FleetStop[];
  cost_profiles: FleetCostProfile[];
  cost_entries: FleetCostEntry[];
  odometer_readings: FleetOdometer[];
  status_events: FleetStatusEvent[];
  overhead_pools: FleetOverhead[];
  cpk_targets: FleetTarget[];
  audit: FleetAudit[];
};

export type FleetLoad =
  | { ready: true; book: FleetBook }
  | { ready: false; reason: 'migration_pending' | 'error' };

export const FLEET_OPS = [
  'vehicle.upsert',
  'vehicle.set_status',
  'driver.upsert',
  'compliance.upsert',
  'job.upsert',
  'odometer.add',
  'cost_entry.add',
  'cost_entry.reverse',
  'cost_profile.set',
  'overhead_pool.set',
  'cpk_target.set',
  'settings.update',
  'real_data.confirm',
] as const;

export type FleetOpName = (typeof FLEET_OPS)[number];

export type FleetOp = {
  op: FleetOpName;
  payload: Record<string, unknown>;
  expected_updated_at?: string | null;
};
