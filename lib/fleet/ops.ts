/**
 * FleetAdvisor® desk writes. Pure reducer: one entity, then an audit row.
 * Preview and the staff route both call this. No network.
 */
import { emptyFleetBook } from './empty-book';
import { prdpCategoryMissing } from './compliance';
import { assertRealDataAllowed } from './real-data-guard';
import { allowedOpsForRole } from './roles';
import type {
  FleetAudit,
  FleetBook,
  FleetCompliance,
  FleetCostEntry,
  FleetCostProfile,
  FleetDriver,
  FleetJob,
  FleetOp,
  FleetRole,
  FleetStop,
  FleetVehicle,
  OverheadBasis,
  RunningCategory,
  TyreMode,
  VehicleStatus,
} from './types';
import {
  assertBounded,
  assertLedgerCategory,
  assertNoIdentity,
  cleanEmail,
  cleanMoney,
  cleanText,
} from './validation';

export type OpContext = {
  role: FleetRole;
  actorId: string;
  now: string;
  companyId: number;
  enforceRealData: boolean;
};

export type OpOutcome =
  | {
      ok: true;
      book: FleetBook;
      audit: Pick<FleetAudit, 'action' | 'target_kind' | 'target_id' | 'payload'>;
    }
  | { ok: false; status: 400 | 403 | 409; error: string };

const KINDS = new Set(['rigid', 'tractor', 'trailer', 'tipper', 'van', 'other']);
const OWNERSHIP = new Set(['owned', 'leased', 'subcontractor']);
const VEHICLE_STATUS = new Set(['active', 'workshop', 'off_road', 'sold']);
const EMPLOYMENT = new Set(['employee', 'contractor', 'owner_operator']);
const DRIVER_STATUS = new Set(['active', 'on_leave', 'inactive']);
const JOB_STATUS = new Set(['draft', 'booked', 'cancelled']);
const STOP_KIND = new Set(['pickup', 'delivery', 'via']);
const COMPLIANCE_KIND = new Set([
  'licence_disc',
  'roadworthy',
  'operator_card',
  'insurance',
  'cross_border_permit',
  'abnormal_permit',
  'other_permit',
  'driver_licence',
  'prdp',
  'medical',
  'induction',
  'other',
]);
const SUBJECT = new Set(['vehicle', 'driver', 'company']);

function deny(status: 400 | 403 | 409, error: string): OpOutcome {
  return { ok: false, status, error };
}

function id(): string {
  return crypto.randomUUID();
}

function cas(current: string, expected: string | null | undefined): OpOutcome | null {
  if (!expected || expected !== current) return deny(409, 'This record changed. Reload and try again.');
  return null;
}

function auditOf(book: FleetBook, ctx: OpContext, action: string, targetKind: string, targetId: string, payload: Record<string, unknown>): FleetBook {
  const row: FleetAudit = {
    id: id(),
    company_id: ctx.companyId,
    actor_kind: 'staff',
    actor_id: ctx.actorId,
    action,
    target_kind: targetKind,
    target_id: targetId,
    payload,
    at: ctx.now,
  };
  return { ...book, audit: [...book.audit, row] };
}

function done(book: FleetBook, ctx: OpContext, action: string, targetKind: string, targetId: string, payload: Record<string, unknown> = {}): OpOutcome {
  const next = auditOf(book, ctx, action, targetKind, targetId, payload);
  return { ok: true, book: next, audit: { action, target_kind: targetKind, target_id: targetId, payload } };
}

export function applyFleetOp(book: FleetBook, op: FleetOp, ctx: OpContext, expectedUpdatedAt?: string | null): OpOutcome {
  if (!allowedOpsForRole(ctx.role).includes(op.op)) return deny(403, 'You cannot do that.');
  const identity = assertNoIdentity(op.payload);
  if (!identity.ok) return deny(400, identity.error);
  if (ctx.enforceRealData) {
    const gate = assertRealDataAllowed(book.workspace, op);
    if (!gate.ok) return deny(400, gate.error);
  }
  const bounded = assertBounded(op.payload, 'The form');
  if (!bounded.ok) return deny(400, bounded.error);
  if (op.op === 'vehicle.upsert') return upsertVehicle(book, op, ctx, expectedUpdatedAt);
  if (op.op === 'vehicle.set_status') return setStatus(book, op, ctx, expectedUpdatedAt);
  if (op.op === 'driver.upsert') return upsertDriver(book, op, ctx, expectedUpdatedAt);
  if (op.op === 'compliance.upsert') return upsertCompliance(book, op, ctx, expectedUpdatedAt);
  if (op.op === 'job.upsert') return upsertJob(book, op, ctx, expectedUpdatedAt);
  if (op.op === 'odometer.add') return addOdometer(book, op, ctx);
  if (op.op === 'cost_entry.add') return addCost(book, op, ctx, false);
  if (op.op === 'cost_entry.reverse') return addCost(book, op, ctx, true);
  if (op.op === 'cost_profile.set') return setProfile(book, op, ctx);
  if (op.op === 'overhead_pool.set') return setPool(book, op, ctx);
  if (op.op === 'cpk_target.set') return setTarget(book, op, ctx);
  if (op.op === 'settings.update') return updateSettings(book, op, ctx, expectedUpdatedAt);
  if (op.op === 'real_data.confirm') return confirmRealData(book, op, ctx);
  return deny(400, 'That action is not available.');
}

function upsertVehicle(book: FleetBook, op: FleetOp, ctx: OpContext, expected?: string | null): OpOutcome {
  const payload = op.payload;
  const reg = cleanText(payload.reg_no, 32).toUpperCase();
  if (!reg) return deny(400, 'Add a registration.');
  const kind = cleanText(payload.kind, 32);
  const ownership = cleanText(payload.ownership, 32);
  const status = cleanText(payload.status || 'active', 32);
  if (!KINDS.has(kind) || !OWNERSHIP.has(ownership) || !VEHICLE_STATUS.has(status)) return deny(400, 'Check the vehicle type, ownership and status.');
  if (payload.archived_at && ctx.role === 'dispatcher') return deny(403, 'You cannot archive a vehicle.');
  const duplicate = book.vehicles.some((row) => row.reg_no.toLowerCase() === reg.toLowerCase() && row.id !== payload.id && !row.archived_at);
  if (duplicate) return deny(400, 'That registration is already on the fleet.');
  const existing = book.vehicles.find((row) => row.id === payload.id);
  if (existing) {
    const clash = cas(existing.updated_at, expected);
    if (clash) return clash;
  }
  const row: FleetVehicle = {
    id: existing?.id || id(),
    company_id: ctx.companyId,
    reg_no: reg,
    kind: kind as FleetVehicle['kind'],
    ownership: ownership as FleetVehicle['ownership'],
    make: cleanText(payload.make, 80),
    model: cleanText(payload.model, 80),
    year: yearOf(payload.year),
    vin: cleanText(payload.vin, 32),
    gvm_kg: intOf(payload.gvm_kg),
    tare_kg: intOf(payload.tare_kg),
    payload_kg: intOf(payload.payload_kg),
    fuel_type: cleanText(payload.fuel_type, 40),
    tank_litres: numOf(payload.tank_litres),
    odometer_km: existing?.odometer_km ?? null,
    odometer_at: existing?.odometer_at ?? null,
    status: status as VehicleStatus,
    depot_label: cleanText(payload.depot_label, 80),
    tracker_fitted: Boolean(payload.tracker_fitted),
    tracker_provider: cleanText(payload.tracker_provider, 80),
    notes: cleanText(payload.notes, 2000),
    archived_at: payload.archived_at ? ctx.now : existing?.archived_at || null,
    updated_at: ctx.now,
  };
  const vehicles = existing ? book.vehicles.map((item) => (item.id === row.id ? row : item)) : [...book.vehicles, row];
  let next: FleetBook = { ...book, vehicles };
  if (!existing || existing.status !== row.status) {
    next = {
      ...next,
      status_events: [
        ...next.status_events,
        {
          id: id(),
          company_id: ctx.companyId,
          vehicle_id: row.id,
          status: row.status,
          from_at: ctx.now.slice(0, 10),
          note: '',
          created_at: ctx.now,
        },
      ],
    };
  }
  return done(next, ctx, 'vehicle.upsert', 'vehicle', row.id, { reg_no: row.reg_no, status: row.status });
}

function setStatus(book: FleetBook, op: FleetOp, ctx: OpContext, expected?: string | null): OpOutcome {
  const vehicle = book.vehicles.find((row) => row.id === op.payload.id);
  if (!vehicle) return deny(400, 'Choose a vehicle.');
  const clash = cas(vehicle.updated_at, expected);
  if (clash) return clash;
  const status = cleanText(op.payload.status, 32);
  if (!VEHICLE_STATUS.has(status)) return deny(400, 'Choose a status.');
  const row = { ...vehicle, status: status as VehicleStatus, updated_at: ctx.now };
  const next: FleetBook = {
    ...book,
    vehicles: book.vehicles.map((item) => (item.id === row.id ? row : item)),
    status_events: [
      ...book.status_events,
      {
        id: id(),
        company_id: ctx.companyId,
        vehicle_id: row.id,
        status: row.status,
        from_at: ctx.now.slice(0, 10),
        note: cleanText(op.payload.note, 400),
        created_at: ctx.now,
      },
    ],
  };
  return done(next, ctx, 'vehicle.set_status', 'vehicle', row.id, { status: row.status });
}

function upsertDriver(book: FleetBook, op: FleetOp, ctx: OpContext, expected?: string | null): OpOutcome {
  const name = cleanText(op.payload.full_name, 120);
  if (!name) return deny(400, 'Add the driver name.');
  const employment = cleanText(op.payload.employment || 'employee', 32);
  const status = cleanText(op.payload.status || 'active', 32);
  if (!EMPLOYMENT.has(employment) || !DRIVER_STATUS.has(status)) return deny(400, 'Check employment and status.');
  const existing = book.drivers.find((row) => row.id === op.payload.id);
  if (existing) {
    const clash = cas(existing.updated_at, expected);
    if (clash) return clash;
  }
  const row: FleetDriver = {
    id: existing?.id || id(),
    company_id: ctx.companyId,
    full_name: name,
    phone: cleanText(op.payload.phone, 40),
    email: cleanEmail(op.payload.email),
    employment: employment as FleetDriver['employment'],
    licence_code: cleanText(op.payload.licence_code, 16),
    status: status as FleetDriver['status'],
    person_id: intOf(op.payload.person_id),
    notes: cleanText(op.payload.notes, 2000),
    archived_at: op.payload.archived_at ? ctx.now : existing?.archived_at || null,
    updated_at: ctx.now,
  };
  if (row.archived_at && ctx.role === 'dispatcher') return deny(403, 'You cannot archive a driver.');
  const drivers = existing ? book.drivers.map((item) => (item.id === row.id ? row : item)) : [...book.drivers, row];
  return done({ ...book, drivers }, ctx, 'driver.upsert', 'driver', row.id, { full_name: row.full_name });
}

function upsertCompliance(book: FleetBook, op: FleetOp, ctx: OpContext, expected?: string | null): OpOutcome {
  const kind = cleanText(op.payload.kind, 40);
  const subject = cleanText(op.payload.subject_kind, 20);
  if (!COMPLIANCE_KIND.has(kind) || !SUBJECT.has(subject)) return deny(400, 'Choose what this date belongs to.');
  const detail = op.payload.detail && typeof op.payload.detail === 'object' ? (op.payload.detail as Record<string, unknown>) : {};
  if (prdpCategoryMissing(kind, detail)) return deny(400, 'PrDP needs a category.');
  const existing = book.compliance.find((row) => row.id === op.payload.id);
  if (existing) {
    const clash = cas(existing.updated_at, expected);
    if (clash) return clash;
  }
  const row: FleetCompliance = {
    id: existing?.id || id(),
    company_id: ctx.companyId,
    subject_kind: subject as FleetCompliance['subject_kind'],
    subject_id: subject === 'company' ? null : cleanText(op.payload.subject_id, 80) || null,
    kind: kind as FleetCompliance['kind'],
    reference: cleanText(op.payload.reference, 64),
    issued_on: dateOrNull(op.payload.issued_on),
    expires_on: dateOrNull(op.payload.expires_on),
    detail,
    status_note: cleanText(op.payload.status_note, 400),
    archived_at: null,
    updated_at: ctx.now,
  };
  const compliance = existing ? book.compliance.map((item) => (item.id === row.id ? row : item)) : [...book.compliance, row];
  return done({ ...book, compliance }, ctx, 'compliance.upsert', 'compliance', row.id, { kind: row.kind });
}

function upsertJob(book: FleetBook, op: FleetOp, ctx: OpContext, expected?: string | null): OpOutcome {
  const status = cleanText(op.payload.status || 'draft', 32);
  if (!JOB_STATUS.has(status)) return deny(400, 'Choose a job status.');
  const existing = book.jobs.find((row) => row.id === op.payload.id);
  if (existing) {
    const clash = cas(existing.updated_at, expected);
    if (clash) return clash;
  }
  const seesPrice = ctx.role === 'owner' || ctx.role === 'manager' || ctx.role === 'office' || ctx.role === 'viewer' || (ctx.role === 'dispatcher' && book.workspace.dispatcher_sees_rates);
  let price: number | null = existing?.price_cents ?? null;
  if (seesPrice && 'price_cents' in op.payload) {
    price = op.payload.price_cents == null || op.payload.price_cents === '' ? null : cleanMoney(op.payload.price_cents);
    if (op.payload.price_cents != null && op.payload.price_cents !== '' && price == null) return deny(400, 'Check the price.');
  }
  const reference = existing?.reference || cleanText(op.payload.reference, 40) || nextJobReference(book);
  const row: FleetJob = {
    id: existing?.id || id(),
    company_id: ctx.companyId,
    reference,
    customer_id: intOf(op.payload.customer_id),
    customer_name: cleanText(op.payload.customer_name, 160),
    service_type: cleanText(op.payload.service_type, 80),
    cargo_description: cleanText(op.payload.cargo_description, 400),
    cargo_kg: numOf(op.payload.cargo_kg),
    cargo_volume_m3: numOf(op.payload.cargo_volume_m3),
    packages: intOf(op.payload.packages),
    status: status as FleetJob['status'],
    dangerous_goods: Boolean(op.payload.dangerous_goods),
    abnormal: Boolean(op.payload.abnormal),
    abnormal_dims: op.payload.abnormal_dims && typeof op.payload.abnormal_dims === 'object' ? (op.payload.abnormal_dims as Record<string, unknown>) : null,
    cross_border: Boolean(op.payload.cross_border),
    countries: Array.isArray(op.payload.countries) ? op.payload.countries.map((item) => cleanText(item, 8)).filter(Boolean).slice(0, 12) : [],
    price_cents: price,
    notes: cleanText(op.payload.notes, 2000),
    archived_at: null,
    updated_at: ctx.now,
  };
  const stops = readStops(op.payload.stops, row.id, ctx);
  if (!stops.ok) return { ok: false, status: stops.status, error: stops.error };
  const jobs = existing ? book.jobs.map((item) => (item.id === row.id ? row : item)) : [...book.jobs, row];
  const kept = book.stops.filter((stop) => stop.job_id !== row.id);
  return done({ ...book, jobs, stops: [...kept, ...stops.rows] }, ctx, 'job.upsert', 'job', row.id, { reference: row.reference });
}

function readStops(
  value: unknown,
  jobId: string,
  ctx: OpContext
): { ok: true; rows: FleetStop[] } | { ok: false; status: 400 | 403 | 409; error: string } {
  if (value == null) return { ok: true, rows: [] };
  if (!Array.isArray(value)) return { ok: false, status: 400, error: 'Check the stops.' };
  const rows: FleetStop[] = [];
  value.slice(0, 12).forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const raw = item as Record<string, unknown>;
    const kind = cleanText(raw.kind || 'pickup', 20);
    if (!STOP_KIND.has(kind)) return;
    rows.push({
      id: cleanText(raw.id, 80) || id(),
      company_id: ctx.companyId,
      job_id: jobId,
      seq: index + 1,
      kind: kind as FleetStop['kind'],
      place_name: cleanText(raw.place_name, 120),
      address: cleanText(raw.address, 200),
      suburb: cleanText(raw.suburb, 80),
      city: cleanText(raw.city, 80),
      province: cleanText(raw.province, 80),
      country: cleanText(raw.country || 'ZA', 8) || 'ZA',
      window_start: dateOrNull(raw.window_start),
      window_end: dateOrNull(raw.window_end),
      contact_name: cleanText(raw.contact_name, 120),
      contact_phone: cleanText(raw.contact_phone, 40),
      instructions: cleanText(raw.instructions, 400),
      updated_at: ctx.now,
    });
  });
  return { ok: true, rows };
}

function addOdometer(book: FleetBook, op: FleetOp, ctx: OpContext): OpOutcome {
  const vehicle = book.vehicles.find((row) => row.id === op.payload.vehicle_id);
  if (!vehicle) return deny(400, 'Choose a vehicle.');
  const reading = numOf(op.payload.reading_km);
  if (reading == null || reading < 0 || reading > 10_000_000) return deny(400, 'Check the odometer reading.');
  const readAt = dateOrNull(op.payload.read_at) || ctx.now.slice(0, 10);
  const entryId = id();
  const next: FleetBook = {
    ...book,
    odometer_readings: [
      ...book.odometer_readings,
      {
        id: entryId,
        company_id: ctx.companyId,
        vehicle_id: vehicle.id,
        reading_km: reading,
        read_at: readAt,
        source: 'manual',
        note: cleanText(op.payload.note, 400),
        created_at: ctx.now,
      },
    ],
    vehicles: book.vehicles.map((row) =>
      row.id === vehicle.id ? { ...row, odometer_km: reading, odometer_at: readAt, updated_at: ctx.now } : row
    ),
  };
  return done(next, ctx, 'odometer.add', 'odometer', entryId, { vehicle_id: vehicle.id, reading_km: reading });
}

function addCost(book: FleetBook, op: FleetOp, ctx: OpContext, reverse: boolean): OpOutcome {
  const vehicle = book.vehicles.find((row) => row.id === op.payload.vehicle_id);
  if (!vehicle) return deny(400, 'Choose a vehicle.');
  let category = cleanText(op.payload.category, 40);
  let amount = cleanMoney(op.payload.amount_cents);
  let vat = cleanMoney(op.payload.vat_cents) ?? 0;
  let reverses: string | null = null;
  if (reverse) {
    const prior = book.cost_entries.find((row) => row.id === op.payload.reverses_id && row.vehicle_id === vehicle.id);
    if (!prior) return deny(400, 'Choose the cost entry to reverse.');
    category = prior.category;
    amount = -prior.amount_cents;
    vat = -prior.vat_cents;
    reverses = prior.id;
  }
  const categoryCheck = assertLedgerCategory(category);
  if (!categoryCheck.ok) return deny(400, categoryCheck.error);
  if (amount == null) return deny(400, 'Check the amount.');
  const entry: FleetCostEntry = {
    id: id(),
    company_id: ctx.companyId,
    vehicle_id: vehicle.id,
    trip_id: null,
    driver_id: null,
    category: category as RunningCategory,
    occurred_on: dateOrNull(op.payload.occurred_on) || ctx.now.slice(0, 10),
    amount_cents: amount,
    vat_cents: vat,
    vat_claimable: Boolean(op.payload.vat_claimable),
    litres: numOf(op.payload.litres),
    odometer_km: numOf(op.payload.odometer_km),
    full_tank: Boolean(op.payload.full_tank),
    source: 'manual',
    reference: cleanText(op.payload.reference, 64),
    note: cleanText(op.payload.note, 400),
    reverses_id: reverses,
    created_at: ctx.now,
  };
  return done(
    { ...book, cost_entries: [...book.cost_entries, entry] },
    ctx,
    reverse ? 'cost_entry.reverse' : 'cost_entry.add',
    'cost_entry',
    entry.id,
    { vehicle_id: vehicle.id, category: entry.category }
  );
}

function setProfile(book: FleetBook, op: FleetOp, ctx: OpContext): OpOutcome {
  const vehicle = book.vehicles.find((row) => row.id === op.payload.vehicle_id);
  if (!vehicle) return deny(400, 'Choose a vehicle.');
  const from = dateOrNull(op.payload.effective_from) || ctx.now.slice(0, 10);
  const method = cleanText(op.payload.depreciation_method || 'time', 20);
  const tyre = cleanText(op.payload.tyre_mode || book.workspace.tyre_mode_default, 20);
  if ((method !== 'time' && method !== 'distance') || (tyre !== 'accrual' && tyre !== 'ledger')) {
    return deny(400, 'Check depreciation and tyre settings.');
  }
  const profiles = book.cost_profiles.map((row) => {
    if (row.vehicle_id !== vehicle.id || row.effective_to) return row;
    if (row.effective_from >= from) return row;
    return { ...row, effective_to: from, updated_at: ctx.now };
  });
  const overlap = profiles.some((row) => {
    if (row.vehicle_id !== vehicle.id) return false;
    const end = row.effective_to || '9999-12-31';
    return row.effective_from < '9999-12-31' && from < end && from >= row.effective_from && row.effective_to !== from;
  });
  if (overlap) return deny(400, 'That cost profile overlaps an existing one.');
  const row: FleetCostProfile = {
    id: id(),
    company_id: ctx.companyId,
    vehicle_id: vehicle.id,
    effective_from: from,
    effective_to: null,
    purchase_price_cents: cleanMoney(op.payload.purchase_price_cents),
    residual_cents: cleanMoney(op.payload.residual_cents),
    depreciation_method: method,
    life_months: intOf(op.payload.life_months),
    life_km: intOf(op.payload.life_km),
    in_service_on: dateOrNull(op.payload.in_service_on) || from,
    disposed_on: dateOrNull(op.payload.disposed_on),
    finance_monthly_cents: cleanMoney(op.payload.finance_monthly_cents) ?? 0,
    insurance_annual_cents: cleanMoney(op.payload.insurance_annual_cents) ?? 0,
    licences_annual_cents: cleanMoney(op.payload.licences_annual_cents) ?? 0,
    tracker_monthly_cents: cleanMoney(op.payload.tracker_monthly_cents) ?? 0,
    other_standing_monthly_cents: cleanMoney(op.payload.other_standing_monthly_cents) ?? 0,
    driver_cost_monthly_cents: cleanMoney(op.payload.driver_cost_monthly_cents) ?? 0,
    tyre_mode: tyre as TyreMode,
    tyre_set_cost_cents: cleanMoney(op.payload.tyre_set_cost_cents),
    tyre_life_km: intOf(op.payload.tyre_life_km),
    updated_at: ctx.now,
  };
  return done({ ...book, cost_profiles: [...profiles, row] }, ctx, 'cost_profile.set', 'cost_profile', row.id, { vehicle_id: vehicle.id });
}

function setPool(book: FleetBook, op: FleetOp, ctx: OpContext): OpOutcome {
  const month = dateOrNull(op.payload.period_month);
  if (!month) return deny(400, 'Choose a month.');
  const period = `${month.slice(0, 7)}-01`;
  const amount = cleanMoney(op.payload.amount_cents);
  if (amount == null) return deny(400, 'Check the overhead amount.');
  const basis = cleanText(op.payload.basis || book.workspace.overhead_basis, 32) as OverheadBasis;
  if (!['equal_vehicle_days', 'km', 'revenue'].includes(basis)) return deny(400, 'Choose how overhead is shared.');
  const existing = book.overhead_pools.find((row) => row.period_month.slice(0, 7) === period.slice(0, 7));
  const row = {
    id: existing?.id || id(),
    company_id: ctx.companyId,
    period_month: period,
    amount_cents: amount,
    basis,
    updated_at: ctx.now,
  };
  const overhead_pools = existing
    ? book.overhead_pools.map((item) => (item.id === row.id ? row : item))
    : [...book.overhead_pools, row];
  return done({ ...book, overhead_pools }, ctx, 'overhead_pool.set', 'overhead_pool', row.id, { period_month: period });
}

function setTarget(book: FleetBook, op: FleetOp, ctx: OpContext): OpOutcome {
  const scope = cleanText(op.payload.scope_kind, 32);
  const layer = cleanText(op.payload.layer, 32);
  if (!['fleet', 'vehicle_class', 'vehicle', 'lane'].includes(scope)) return deny(400, 'Choose a target scope.');
  if (layer !== 'fully_loaded' && layer !== 'operating') return deny(400, 'Choose a target layer.');
  const target = cleanMoney(op.payload.target_cents_per_km);
  if (target == null || target < 0) return deny(400, 'Check the target.');
  const row = {
    id: id(),
    company_id: ctx.companyId,
    scope_kind: scope as 'fleet' | 'vehicle_class' | 'vehicle' | 'lane',
    scope_ref: cleanText(op.payload.scope_ref, 80),
    layer: layer as 'fully_loaded' | 'operating',
    target_cents_per_km: target,
    effective_from: dateOrNull(op.payload.effective_from) || ctx.now.slice(0, 10),
    updated_at: ctx.now,
  };
  return done({ ...book, cpk_targets: [...book.cpk_targets, row] }, ctx, 'cpk_target.set', 'cpk_target', row.id, { layer });
}

function updateSettings(book: FleetBook, op: FleetOp, ctx: OpContext, expected?: string | null): OpOutcome {
  if (book.workspace.id && book.workspace.updated_at) {
    const clash = cas(book.workspace.updated_at, expected ?? book.workspace.updated_at);
    if (expected && clash) return clash;
  }
  const ownerOnly = ['retention_days', 'dispatcher_sees_rates', 'real_data_enabled'];
  if (ctx.role !== 'owner' && ownerOnly.some((key) => key in op.payload)) return deny(403, 'Only an owner can change that setting.');
  const windowDays = intOf(op.payload.expiring_window_days);
  const cpkWindow = intOf(op.payload.cpk_window_days);
  const minKm = intOf(op.payload.cpk_min_km);
  if (windowDays != null && (windowDays < 1 || windowDays > 365)) return deny(400, 'The expiry window must be between 1 and 365 days.');
  if (cpkWindow != null && (cpkWindow < 1 || cpkWindow > 3660)) return deny(400, 'Check the cost window.');
  if (minKm != null && minKm < 0) return deny(400, 'Check the minimum distance.');
  const workspace = {
    ...book.workspace,
    id: book.workspace.id || id(),
    company_id: ctx.companyId,
    display_name: 'display_name' in op.payload ? cleanText(op.payload.display_name, 120) : book.workspace.display_name,
    operator_type: (cleanText(op.payload.operator_type || book.workspace.operator_type, 32) || book.workspace.operator_type) as FleetBook['workspace']['operator_type'],
    depot_label: 'depot_label' in op.payload ? cleanText(op.payload.depot_label, 80) : book.workspace.depot_label,
    expiring_window_days: windowDays ?? book.workspace.expiring_window_days,
    waybill_prefix: 'waybill_prefix' in op.payload ? cleanText(op.payload.waybill_prefix, 12) : book.workspace.waybill_prefix,
    cpk_window_days: cpkWindow ?? book.workspace.cpk_window_days,
    cpk_min_km: minKm ?? book.workspace.cpk_min_km,
    cpk_min_trips_per_lane: intOf(op.payload.cpk_min_trips_per_lane) ?? book.workspace.cpk_min_trips_per_lane,
    overhead_basis: (cleanText(op.payload.overhead_basis || book.workspace.overhead_basis, 32) || book.workspace.overhead_basis) as OverheadBasis,
    fines_in_cpk: 'fines_in_cpk' in op.payload ? Boolean(op.payload.fines_in_cpk) : book.workspace.fines_in_cpk,
    tyre_mode_default: (cleanText(op.payload.tyre_mode_default || book.workspace.tyre_mode_default, 20) || book.workspace.tyre_mode_default) as TyreMode,
    dispatcher_sees_rates:
      ctx.role === 'owner' && 'dispatcher_sees_rates' in op.payload
        ? Boolean(op.payload.dispatcher_sees_rates)
        : book.workspace.dispatcher_sees_rates,
    retention_days:
      ctx.role === 'owner' && 'retention_days' in op.payload ? intOf(op.payload.retention_days) : book.workspace.retention_days,
    updated_at: ctx.now,
  };
  if (!['haulier', 'courier', 'bulk', 'in_house', 'mixed'].includes(workspace.operator_type)) return deny(400, 'Choose an operator type.');
  return done({ ...book, workspace }, ctx, 'settings.update', 'workspace', workspace.id, { display_name: workspace.display_name });
}

function confirmRealData(book: FleetBook, op: FleetOp, ctx: OpContext): OpOutcome {
  if (ctx.role !== 'owner') return deny(403, 'Only an owner can confirm real data.');
  if (cleanText(op.payload.phrase, 40) !== 'ENABLE REAL DATA') return deny(400, 'Type the confirmation phrase to continue.');
  const workspace = {
    ...book.workspace,
    id: book.workspace.id || id(),
    company_id: ctx.companyId,
    real_data_enabled: true,
    real_data_confirmed_by: ctx.actorId,
    real_data_confirmed_at: ctx.now,
    updated_at: ctx.now,
  };
  return done({ ...book, workspace }, ctx, 'real_data.confirm', 'workspace', workspace.id, { real_data_enabled: true });
}

function nextJobReference(book: FleetBook): string {
  const prefix = book.workspace.waybill_prefix || 'JOB';
  return `${prefix}-${book.jobs.length + 1}`;
}

function yearOf(value: unknown): number | null {
  const year = intOf(value);
  if (year == null) return null;
  if (year < 1950 || year > 2100) return null;
  return year;
}

function intOf(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.trunc(number);
}

function numOf(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
}

function dateOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, 10);
}

export function cloneBook(book: FleetBook = emptyFleetBook()): FleetBook {
  return structuredClone(book);
}
