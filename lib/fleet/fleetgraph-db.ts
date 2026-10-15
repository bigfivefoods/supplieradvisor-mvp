/**
 * FleetAdvisor® staff data access. Service role, server only.
 * Every read and write is filtered by the verified company id.
 */
import { getSupabaseAdmin } from '../supabase/admin';
import { emptyFleetBook } from './empty-book';
import { applyFleetOp, type OpContext, type OpOutcome } from './ops';
import type {
  FleetBook,
  FleetCompliance,
  FleetCostEntry,
  FleetCostProfile,
  FleetDriver,
  FleetJob,
  FleetLoad,
  FleetOdometer,
  FleetOp,
  FleetOverhead,
  FleetStatusEvent,
  FleetStop,
  FleetTarget,
  FleetVehicle,
  FleetWorkspace,
} from './types';
import { sameCompanyCustomer } from './validation';

type DbError = { code?: string; message?: string } | null;

export function isFleetSchemaMissing(error: DbError): boolean {
  if (!error) return false;
  const text = `${error.code || ''} ${error.message || ''}`;
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache|could not find the table/i.test(text);
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function text(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value);
}

export async function loadFleetBook(companyId: number): Promise<FleetLoad> {
  const admin = getSupabaseAdmin();
  const tables = [
    'fg_workspaces',
    'fg_vehicles',
    'fg_drivers',
    'fg_compliance_items',
    'fg_jobs',
    'fg_job_stops',
    'fg_cost_profiles',
    'fg_cost_entries',
    'fg_odometer_readings',
    'fg_vehicle_status_events',
    'fg_overhead_pools',
    'fg_cpk_targets',
    'fg_audit_log',
  ] as const;
  const rows: Record<string, unknown[]> = {};
  for (const table of tables) {
    const { data, error } = await admin.from(table).select('*').eq('company_id', companyId);
    if (isFleetSchemaMissing(error)) return { ready: false, reason: 'migration_pending' };
    if (error) return { ready: false, reason: 'migration_pending' };
    rows[table] = data || [];
  }
  const workspaceRow = (rows.fg_workspaces[0] || null) as Record<string, unknown> | null;
  const book = emptyFleetBook(companyId);
  if (workspaceRow) book.workspace = mapWorkspace(workspaceRow);
  book.vehicles = (rows.fg_vehicles as Record<string, unknown>[]).map(mapVehicle);
  book.drivers = (rows.fg_drivers as Record<string, unknown>[]).map(mapDriver);
  book.compliance = (rows.fg_compliance_items as Record<string, unknown>[]).map(mapCompliance);
  book.jobs = (rows.fg_jobs as Record<string, unknown>[]).map(mapJob);
  book.stops = (rows.fg_job_stops as Record<string, unknown>[]).map(mapStop);
  book.cost_profiles = (rows.fg_cost_profiles as Record<string, unknown>[]).map(mapProfile);
  book.cost_entries = (rows.fg_cost_entries as Record<string, unknown>[]).map(mapEntry);
  book.odometer_readings = (rows.fg_odometer_readings as Record<string, unknown>[]).map(mapOdo);
  book.status_events = (rows.fg_vehicle_status_events as Record<string, unknown>[]).map(mapStatus);
  book.overhead_pools = (rows.fg_overhead_pools as Record<string, unknown>[]).map(mapPool);
  book.cpk_targets = (rows.fg_cpk_targets as Record<string, unknown>[]).map(mapTarget);
  book.audit = [];
  return { ready: true, book };
}

export async function customerBelongsToCompany(customerId: number, companyId: number): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('customers').select('id, profile_id').eq('id', customerId).maybeSingle();
  if (error || !data) return false;
  return sameCompanyCustomer(num((data as { profile_id?: unknown }).profile_id), companyId);
}

export async function nextJobNumber(companyId: number): Promise<number | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('fg_next_number', { p_company_id: companyId, p_name: 'job' });
  if (error || data == null) return null;
  const value = Number(data);
  return Number.isFinite(value) ? value : null;
}

export async function commitFleetOp(
  before: FleetBook,
  op: FleetOp,
  ctx: OpContext,
  expectedUpdatedAt?: string | null
): Promise<OpOutcome> {
  const outcome = applyFleetOp(before, op, ctx, expectedUpdatedAt);
  if (!outcome.ok) return outcome;
  const saved = await persistDiff(before, outcome.book);
  if (!saved.ok) return { ok: false, status: saved.status, error: saved.error };
  return outcome;
}

async function persistDiff(before: FleetBook, after: FleetBook): Promise<{ ok: true } | { ok: false; status: 409 | 400; error: string }> {
  const admin = getSupabaseAdmin();
  const companyId = after.workspace.company_id;
  if (after.workspace.display_name || after.workspace.id) {
    const saved = await upsertRow(admin, 'fg_workspaces', workspaceRow(after.workspace), before.workspace.id ? before.workspace.updated_at : null, companyId);
    if (!saved.ok) return saved;
  }
  const checks = [
    await syncRows(admin, 'fg_vehicles', before.vehicles, after.vehicles, companyId, vehicleRow),
    await syncRows(admin, 'fg_drivers', before.drivers, after.drivers, companyId, driverRow),
    await syncRows(admin, 'fg_compliance_items', before.compliance, after.compliance, companyId, complianceRow),
    await syncRows(admin, 'fg_jobs', before.jobs, after.jobs, companyId, jobRow),
    await syncRows(admin, 'fg_job_stops', before.stops, after.stops, companyId, stopRow),
    await syncRows(admin, 'fg_cost_profiles', before.cost_profiles, after.cost_profiles, companyId, profileRow),
    await syncRows(admin, 'fg_overhead_pools', before.overhead_pools, after.overhead_pools, companyId, poolRow),
    await syncRows(admin, 'fg_cpk_targets', before.cpk_targets, after.cpk_targets, companyId, targetRow),
  ];
  for (const check of checks) if (!check.ok) return check;
  const appended = [
    await insertNew(admin, 'fg_cost_entries', before.cost_entries, after.cost_entries, entryRow),
    await insertNew(admin, 'fg_odometer_readings', before.odometer_readings, after.odometer_readings, odoRow),
    await insertNew(admin, 'fg_vehicle_status_events', before.status_events, after.status_events, statusRow),
    await insertNew(admin, 'fg_audit_log', before.audit, after.audit, auditRow),
  ];
  for (const check of appended) if (!check.ok) return check;
  const removedStops = before.stops.filter((stop) => !after.stops.some((row) => row.id === stop.id));
  for (const stop of removedStops) {
    const { error } = await admin.from('fg_job_stops').delete().eq('company_id', companyId).eq('id', stop.id);
    if (error) return { ok: false, status: 400, error: 'The desk could not save that.' };
  }
  return { ok: true };
}

type Admin = ReturnType<typeof getSupabaseAdmin>;

async function upsertRow(
  admin: Admin,
  table: string,
  row: Record<string, unknown>,
  previousUpdatedAt: string | null,
  companyId: number
): Promise<{ ok: true } | { ok: false; status: 409 | 400; error: string }> {
  if (!row.id) {
    const { error } = await admin.from(table).insert(row);
    if (error) return { ok: false, status: 400, error: 'The desk could not save that.' };
    return { ok: true };
  }
  const { data: existing, error: readError } = await admin.from(table).select('id').eq('id', row.id).eq('company_id', companyId).maybeSingle();
  if (readError) return { ok: false, status: 400, error: 'The desk could not save that.' };
  if (!existing) {
    const { error } = await admin.from(table).insert(row);
    if (error) return { ok: false, status: 400, error: 'The desk could not save that.' };
    return { ok: true };
  }
  let query = admin.from(table).update(row).eq('id', row.id).eq('company_id', companyId);
  if (previousUpdatedAt) query = query.eq('updated_at', previousUpdatedAt);
  const { data, error } = await query.select('id');
  if (error) return { ok: false, status: 400, error: 'The desk could not save that.' };
  if (!data || data.length === 0) return { ok: false, status: 409, error: 'This record changed. Reload and try again.' };
  return { ok: true };
}

async function syncRows<T extends { id: string; updated_at?: string }>(
  admin: Admin,
  table: string,
  before: T[],
  after: T[],
  companyId: number,
  toRow: (row: T) => Record<string, unknown>
): Promise<{ ok: true } | { ok: false; status: 409 | 400; error: string }> {
  for (const row of after) {
    const prior = before.find((item) => item.id === row.id);
    if (prior && prior.updated_at === row.updated_at) continue;
    const saved = await upsertRow(admin, table, toRow(row), prior?.updated_at || null, companyId);
    if (!saved.ok) return saved;
  }
  return { ok: true };
}

async function insertNew<T extends { id: string }>(
  admin: Admin,
  table: string,
  before: T[],
  after: T[],
  toRow: (row: T) => Record<string, unknown>
): Promise<{ ok: true } | { ok: false; status: 409 | 400; error: string }> {
  const known = new Set(before.map((row) => row.id));
  for (const row of after) {
    if (known.has(row.id)) continue;
    const { error } = await admin.from(table).insert(toRow(row));
    if (error) return { ok: false, status: 400, error: 'The desk could not save that.' };
  }
  return { ok: true };
}

function mapWorkspace(row: Record<string, unknown>): FleetWorkspace {
  const flags = (row.comms_flags || {}) as { email?: boolean; whatsapp?: boolean; sms?: boolean };
  return {
    id: text(row.id),
    company_id: Number(row.company_id),
    display_name: text(row.display_name),
    operator_type: text(row.operator_type, 'haulier') as FleetWorkspace['operator_type'],
    depot_label: text(row.depot_label),
    expiring_window_days: Number(row.expiring_window_days || 30),
    dispatcher_sees_rates: bool(row.dispatcher_sees_rates),
    waybill_prefix: text(row.waybill_prefix),
    retention_days: num(row.retention_days),
    vat_rate_bps: num(row.vat_rate_bps),
    comms_flags: { email: Boolean(flags.email), whatsapp: Boolean(flags.whatsapp), sms: Boolean(flags.sms) },
    real_data_enabled: bool(row.real_data_enabled),
    real_data_confirmed_by: row.real_data_confirmed_by ? text(row.real_data_confirmed_by) : null,
    real_data_confirmed_at: row.real_data_confirmed_at ? text(row.real_data_confirmed_at) : null,
    cpk_window_days: Number(row.cpk_window_days || 90),
    cpk_min_km: Number(row.cpk_min_km || 100),
    cpk_min_trips_per_lane: Number(row.cpk_min_trips_per_lane || 3),
    overhead_basis: text(row.overhead_basis, 'equal_vehicle_days') as FleetWorkspace['overhead_basis'],
    fines_in_cpk: bool(row.fines_in_cpk),
    tyre_mode_default: text(row.tyre_mode_default, 'accrual') as FleetWorkspace['tyre_mode_default'],
    overhead_include_subcontractors: bool(row.overhead_include_subcontractors),
    updated_at: text(row.updated_at),
  };
}

function mapVehicle(row: Record<string, unknown>): FleetVehicle {
  return {
    id: text(row.id),
    company_id: Number(row.company_id),
    reg_no: text(row.reg_no),
    kind: text(row.kind, 'rigid') as FleetVehicle['kind'],
    ownership: text(row.ownership, 'owned') as FleetVehicle['ownership'],
    make: text(row.make),
    model: text(row.model),
    year: num(row.year),
    vin: text(row.vin),
    gvm_kg: num(row.gvm_kg),
    tare_kg: num(row.tare_kg),
    payload_kg: num(row.payload_kg),
    fuel_type: text(row.fuel_type),
    tank_litres: num(row.tank_litres),
    odometer_km: num(row.odometer_km),
    odometer_at: row.odometer_at ? text(row.odometer_at) : null,
    status: text(row.status, 'active') as FleetVehicle['status'],
    depot_label: text(row.depot_label),
    tracker_fitted: bool(row.tracker_fitted),
    tracker_provider: text(row.tracker_provider),
    notes: text(row.notes),
    archived_at: row.archived_at ? text(row.archived_at) : null,
    updated_at: text(row.updated_at),
  };
}

function mapDriver(row: Record<string, unknown>): FleetDriver {
  return {
    id: text(row.id),
    company_id: Number(row.company_id),
    full_name: text(row.full_name),
    phone: text(row.phone),
    email: text(row.email),
    employment: text(row.employment, 'employee') as FleetDriver['employment'],
    licence_code: text(row.licence_code),
    status: text(row.status, 'active') as FleetDriver['status'],
    person_id: num(row.person_id),
    notes: text(row.notes),
    archived_at: row.archived_at ? text(row.archived_at) : null,
    updated_at: text(row.updated_at),
  };
}

function mapCompliance(row: Record<string, unknown>): FleetCompliance {
  return {
    id: text(row.id),
    company_id: Number(row.company_id),
    subject_kind: text(row.subject_kind) as FleetCompliance['subject_kind'],
    subject_id: row.subject_id ? text(row.subject_id) : null,
    kind: text(row.kind) as FleetCompliance['kind'],
    reference: text(row.reference),
    issued_on: row.issued_on ? text(row.issued_on) : null,
    expires_on: row.expires_on ? text(row.expires_on) : null,
    detail: (row.detail && typeof row.detail === 'object' ? row.detail : {}) as Record<string, unknown>,
    status_note: text(row.status_note),
    archived_at: row.archived_at ? text(row.archived_at) : null,
    updated_at: text(row.updated_at),
  };
}

function mapJob(row: Record<string, unknown>): FleetJob {
  return {
    id: text(row.id),
    company_id: Number(row.company_id),
    reference: text(row.reference),
    customer_id: num(row.customer_id),
    customer_name: text(row.customer_name),
    service_type: text(row.service_type),
    cargo_description: text(row.cargo_description),
    cargo_kg: num(row.cargo_kg),
    cargo_volume_m3: num(row.cargo_volume_m3),
    packages: num(row.packages),
    status: text(row.status, 'draft') as FleetJob['status'],
    dangerous_goods: bool(row.dangerous_goods),
    abnormal: bool(row.abnormal),
    abnormal_dims: row.abnormal_dims && typeof row.abnormal_dims === 'object' ? (row.abnormal_dims as Record<string, unknown>) : null,
    cross_border: bool(row.cross_border),
    countries: Array.isArray(row.countries) ? row.countries.map((item) => String(item)) : [],
    price_cents: num(row.price_cents) == null ? null : Math.trunc(Number(row.price_cents)),
    notes: text(row.notes),
    archived_at: row.archived_at ? text(row.archived_at) : null,
    updated_at: text(row.updated_at),
  };
}

function mapStop(row: Record<string, unknown>): FleetStop {
  return {
    id: text(row.id),
    company_id: Number(row.company_id),
    job_id: text(row.job_id),
    seq: Number(row.seq || 1),
    kind: text(row.kind, 'pickup') as FleetStop['kind'],
    place_name: text(row.place_name),
    address: text(row.address),
    suburb: text(row.suburb),
    city: text(row.city),
    province: text(row.province),
    country: text(row.country, 'ZA'),
    window_start: row.window_start ? text(row.window_start) : null,
    window_end: row.window_end ? text(row.window_end) : null,
    contact_name: text(row.contact_name),
    contact_phone: text(row.contact_phone),
    instructions: text(row.instructions),
    updated_at: text(row.updated_at),
  };
}

function mapProfile(row: Record<string, unknown>): FleetCostProfile {
  return {
    id: text(row.id),
    company_id: Number(row.company_id),
    vehicle_id: text(row.vehicle_id),
    effective_from: text(row.effective_from).slice(0, 10),
    effective_to: row.effective_to ? text(row.effective_to).slice(0, 10) : null,
    purchase_price_cents: num(row.purchase_price_cents),
    residual_cents: num(row.residual_cents),
    depreciation_method: text(row.depreciation_method, 'time') as FleetCostProfile['depreciation_method'],
    life_months: num(row.life_months),
    life_km: num(row.life_km),
    in_service_on: row.in_service_on ? text(row.in_service_on).slice(0, 10) : null,
    disposed_on: row.disposed_on ? text(row.disposed_on).slice(0, 10) : null,
    finance_monthly_cents: Number(row.finance_monthly_cents || 0),
    insurance_annual_cents: Number(row.insurance_annual_cents || 0),
    licences_annual_cents: Number(row.licences_annual_cents || 0),
    tracker_monthly_cents: Number(row.tracker_monthly_cents || 0),
    other_standing_monthly_cents: Number(row.other_standing_monthly_cents || 0),
    driver_cost_monthly_cents: Number(row.driver_cost_monthly_cents || 0),
    tyre_mode: text(row.tyre_mode, 'accrual') as FleetCostProfile['tyre_mode'],
    tyre_set_cost_cents: num(row.tyre_set_cost_cents),
    tyre_life_km: num(row.tyre_life_km),
    updated_at: text(row.updated_at),
  };
}

function mapEntry(row: Record<string, unknown>): FleetCostEntry {
  return {
    id: text(row.id),
    company_id: Number(row.company_id),
    vehicle_id: text(row.vehicle_id),
    trip_id: row.trip_id ? text(row.trip_id) : null,
    driver_id: row.driver_id ? text(row.driver_id) : null,
    category: text(row.category) as FleetCostEntry['category'],
    occurred_on: text(row.occurred_on).slice(0, 10),
    amount_cents: Number(row.amount_cents || 0),
    vat_cents: Number(row.vat_cents || 0),
    vat_claimable: bool(row.vat_claimable),
    litres: num(row.litres),
    odometer_km: num(row.odometer_km),
    full_tank: bool(row.full_tank),
    source: text(row.source, 'manual') as FleetCostEntry['source'],
    reference: text(row.reference),
    note: text(row.note),
    reverses_id: row.reverses_id ? text(row.reverses_id) : null,
    created_at: text(row.created_at),
  };
}

function mapOdo(row: Record<string, unknown>): FleetOdometer {
  return {
    id: text(row.id),
    company_id: Number(row.company_id),
    vehicle_id: text(row.vehicle_id),
    reading_km: Number(row.reading_km || 0),
    read_at: text(row.read_at),
    source: text(row.source, 'manual') as FleetOdometer['source'],
    note: text(row.note),
    created_at: text(row.created_at),
  };
}

function mapStatus(row: Record<string, unknown>): FleetStatusEvent {
  return {
    id: text(row.id),
    company_id: Number(row.company_id),
    vehicle_id: text(row.vehicle_id),
    status: text(row.status) as FleetStatusEvent['status'],
    from_at: text(row.from_at),
    note: text(row.note),
    created_at: text(row.created_at),
  };
}

function mapPool(row: Record<string, unknown>): FleetOverhead {
  return {
    id: text(row.id),
    company_id: Number(row.company_id),
    period_month: text(row.period_month).slice(0, 10),
    amount_cents: Number(row.amount_cents || 0),
    basis: text(row.basis, 'equal_vehicle_days') as FleetOverhead['basis'],
    updated_at: text(row.updated_at),
  };
}

function mapTarget(row: Record<string, unknown>): FleetTarget {
  return {
    id: text(row.id),
    company_id: Number(row.company_id),
    scope_kind: text(row.scope_kind, 'fleet') as FleetTarget['scope_kind'],
    scope_ref: text(row.scope_ref),
    layer: text(row.layer, 'fully_loaded') as FleetTarget['layer'],
    target_cents_per_km: Number(row.target_cents_per_km || 0),
    effective_from: text(row.effective_from).slice(0, 10),
    updated_at: text(row.updated_at),
  };
}

function workspaceRow(row: FleetWorkspace): Record<string, unknown> {
  return { ...row, comms_flags: row.comms_flags };
}

function vehicleRow(row: FleetVehicle): Record<string, unknown> {
  return { ...row };
}
function driverRow(row: FleetDriver): Record<string, unknown> {
  return { ...row };
}
function complianceRow(row: FleetCompliance): Record<string, unknown> {
  return { ...row };
}
function jobRow(row: FleetJob): Record<string, unknown> {
  return { ...row };
}
function stopRow(row: FleetStop): Record<string, unknown> {
  return { ...row };
}
function profileRow(row: FleetCostProfile): Record<string, unknown> {
  return { ...row };
}
function poolRow(row: FleetOverhead): Record<string, unknown> {
  return { ...row };
}
function targetRow(row: FleetTarget): Record<string, unknown> {
  return { ...row };
}
function entryRow(row: FleetCostEntry): Record<string, unknown> {
  return { ...row, updated_at: row.created_at };
}
function odoRow(row: FleetOdometer): Record<string, unknown> {
  return { ...row, updated_at: row.created_at, recorded_by: '' };
}
function statusRow(row: FleetStatusEvent): Record<string, unknown> {
  return { ...row, updated_at: row.created_at, by_actor: '' };
}
function auditRow(row: FleetBook['audit'][number]): Record<string, unknown> {
  return { ...row, created_at: row.at };
}
