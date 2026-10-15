import type { FleetBook, FleetWorkspace } from './types';

export function emptyWorkspace(companyId: number, now = ''): FleetWorkspace {
  return {
    id: '',
    company_id: companyId,
    display_name: '',
    operator_type: 'haulier',
    depot_label: '',
    expiring_window_days: 30,
    dispatcher_sees_rates: false,
    waybill_prefix: '',
    retention_days: null,
    vat_rate_bps: null,
    comms_flags: { email: false, whatsapp: false, sms: false },
    real_data_enabled: false,
    real_data_confirmed_by: null,
    real_data_confirmed_at: null,
    cpk_window_days: 90,
    cpk_min_km: 100,
    cpk_min_trips_per_lane: 3,
    overhead_basis: 'equal_vehicle_days',
    fines_in_cpk: false,
    tyre_mode_default: 'accrual',
    overhead_include_subcontractors: false,
    required_margin_bps: 1000,
    expected_vehicle_kinds: ['licence_disc', 'roadworthy', 'insurance'],
    expected_driver_kinds: ['driver_licence', 'prdp', 'medical'],
    prdp_gvm_threshold_kg: 3500,
    updated_at: now,
  };
}

export function emptyFleetBook(companyId = 0, now = ''): FleetBook {
  return {
    workspace: emptyWorkspace(companyId, now),
    vehicles: [],
    drivers: [],
    customers: [],
    trips: [],
    compliance: [],
    jobs: [],
    stops: [],
    cost_profiles: [],
    cost_entries: [],
    odometer_readings: [],
    status_events: [],
    overhead_pools: [],
    cpk_targets: [],
    audit: [],
    reminders: [],
    reminder_log: [],
    trailer_links: [],
    import_runs: [],
    members: [],
  };
}
