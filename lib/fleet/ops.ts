/**
 * FleetAdvisor® desk writes. Pure reducer: one entity, then an audit row.
 * Preview and the staff route both call this. No network.
 */
import { emptyFleetBook } from './empty-book';
import { prdpCategoryMissing } from './compliance';
import { sastDate } from './format';
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
  assertNoIdentityText,
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
  | { ok: false; status: 400 | 403 | 409 | 500; error: string; pending?: boolean };

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
  const screened = screenPayloadText(op.payload);
  if (screened) return screened;
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
  if (op.op === 'overhead_pool.set') return setPool(book, op, ctx, expectedUpdatedAt);
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
  const kept = <T,>(key: string, next: T, prior: T): T => (key in payload ? next : prior);
  const row: FleetVehicle = {
    id: existing?.id || id(),
    company_id: ctx.companyId,
    reg_no: reg,
    kind: kind as FleetVehicle['kind'],
    ownership: ownership as FleetVehicle['ownership'],
    make: kept('make', cleanText(payload.make, 80), existing?.make || ''),
    model: kept('model', cleanText(payload.model, 80), existing?.model || ''),
    year: kept('year', yearOf(payload.year), existing?.year ?? null),
    vin: kept('vin', cleanText(payload.vin, 32), existing?.vin || ''),
    gvm_kg: kept('gvm_kg', intOf(payload.gvm_kg), existing?.gvm_kg ?? null),
    tare_kg: kept('tare_kg', intOf(payload.tare_kg), existing?.tare_kg ?? null),
    payload_kg: kept('payload_kg', intOf(payload.payload_kg), existing?.payload_kg ?? null),
    fuel_type: kept('fuel_type', cleanText(payload.fuel_type, 40), existing?.fuel_type || ''),
    tank_litres: kept('tank_litres', numOf(payload.tank_litres), existing?.tank_litres ?? null),
    odometer_km: existing?.odometer_km ?? null,
    odometer_at: existing?.odometer_at ?? null,
    status: status as VehicleStatus,
    depot_label: kept('depot_label', cleanText(payload.depot_label, 80), existing?.depot_label || ''),
    tracker_fitted: kept('tracker_fitted', Boolean(payload.tracker_fitted), existing?.tracker_fitted ?? false),
    tracker_provider: kept('tracker_provider', cleanText(payload.tracker_provider, 80), existing?.tracker_provider || ''),
    notes: kept('notes', cleanText(payload.notes, 2000), existing?.notes || ''),
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
          from_at: todayOf(ctx),
          note: '',
          by_actor: ctx.actorId,
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
        from_at: todayOf(ctx),
        note: cleanText(op.payload.note, 400),
        by_actor: ctx.actorId,
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
  return done({ ...book, drivers }, ctx, 'driver.upsert', 'driver', row.id, { driver_id: row.id });
}

function upsertCompliance(book: FleetBook, op: FleetOp, ctx: OpContext, expected?: string | null): OpOutcome {
  const kind = cleanText(op.payload.kind, 40);
  const subject = cleanText(op.payload.subject_kind, 20);
  if (!COMPLIANCE_KIND.has(kind) || !SUBJECT.has(subject)) return deny(400, 'Choose what this date belongs to.');
  const detail = op.payload.detail && typeof op.payload.detail === 'object' ? (op.payload.detail as Record<string, unknown>) : {};
  if (prdpCategoryMissing(kind, detail)) return deny(400, 'PrDP needs a category.');
  const subjectId = subject === 'company' ? null : cleanText(op.payload.subject_id, 80) || null;
  const existing =
    book.compliance.find((row) => row.id === op.payload.id) ||
    book.compliance.find(
      (row) =>
        !row.archived_at &&
        row.subject_kind === subject &&
        row.subject_id === subjectId &&
        row.kind === kind
    );
  const expires = dateOrNull(op.payload.expires_on);
  if (!expires) return deny(400, 'Add an expiry date.');
  if (existing && !expected) return deny(409, 'This date is already on file. Reload it and save again.');
  if (existing) {
    const clash = cas(existing.updated_at, expected);
    if (clash) return clash;
  }
  const row: FleetCompliance = {
    id: existing?.id || id(),
    company_id: ctx.companyId,
    subject_kind: subject as FleetCompliance['subject_kind'],
    subject_id: subjectId,
    kind: kind as FleetCompliance['kind'],
    reference: cleanText(op.payload.reference, 64),
    issued_on: dateOrNull(op.payload.issued_on),
    expires_on: expires,
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
    if (op.payload.price_cents == null || op.payload.price_cents === '') price = null;
    else {
      price = cleanMoney(op.payload.price_cents);
      if (price == null || price <= 0) return deny(400, 'Check the price.');
    }
  }
  let customers = book.customers;
  let customerId = intOf(op.payload.customer_id);
  let customerName = cleanText(op.payload.customer_name, 160);
  const named = cleanText(op.payload.new_customer_name, 160);
  if (!customerId && named && !ctx.enforceRealData) {
    customerId = customers.reduce((max, row) => Math.max(max, row.id), 0) + 1;
    customerName = named;
    customers = [...customers, { id: customerId, trading_name: named }];
  } else if (customerId) {
    const known = customers.find((row) => row.id === customerId);
    if (!known) return deny(400, 'Choose a customer from this company.');
    if (!customerName) customerName = known.trading_name;
  }
  const vehicleId = memberId(book, 'vehicle', op.payload.vehicle_id);
  if (typeof vehicleId !== 'string' && vehicleId !== null) return vehicleId;
  const driverId = memberId(book, 'driver', op.payload.driver_id);
  if (typeof driverId !== 'string' && driverId !== null) return driverId;
  const reference = existing?.reference || cleanText(op.payload.reference, 40) || nextJobReference(book);
  const row: FleetJob = {
    id: existing?.id || id(),
    company_id: ctx.companyId,
    reference,
    customer_id: customerId,
    customer_name: customerName,
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
    vehicle_id: vehicleId,
    driver_id: driverId,
    archived_at: null,
    updated_at: ctx.now,
  };
  const stops = readStops(book, op.payload.stops, row.id, ctx);
  if (!stops.ok) return { ok: false, status: stops.status, error: stops.error };
  const namedStop = stops.rows.some((stop) => stop.place_name);
  if (!existing && !customerId && !customerName && !named && !row.cargo_description && !namedStop) {
    return deny(400, 'Add a customer, cargo or a stop.');
  }
  const jobs = existing ? book.jobs.map((item) => (item.id === row.id ? row : item)) : [...book.jobs, row];
  const keptStops = book.stops.filter((stop) => stop.job_id !== row.id);
  return done({ ...book, customers, jobs, stops: [...keptStops, ...stops.rows] }, ctx, 'job.upsert', 'job', row.id, { reference: row.reference });
}

function readStops(
  book: FleetBook,
  value: unknown,
  jobId: string,
  ctx: OpContext
): { ok: true; rows: FleetStop[] } | { ok: false; status: 400 | 403 | 409; error: string } {
  if (value == null) return { ok: true, rows: [] };
  if (!Array.isArray(value)) return { ok: false, status: 400, error: 'Check the stops.' };
  const rows: FleetStop[] = [];
  for (const [index, item] of value.slice(0, 12).entries()) {
    if (!item || typeof item !== 'object') return { ok: false, status: 400, error: 'Check the stops.' };
    const raw = item as Record<string, unknown>;
    const kind = cleanText(raw.kind || 'pickup', 20);
    if (!STOP_KIND.has(kind)) return { ok: false, status: 400, error: 'Check the stops.' };
    const supplied = cleanText(raw.id, 80);
    let stopId = id();
    if (supplied) {
      const owned = book.stops.find((stop) => stop.id === supplied);
      if (owned && owned.job_id !== jobId) return { ok: false, status: 400, error: 'That stop belongs to another job.' };
      if (!owned && !isUuid(supplied)) return { ok: false, status: 400, error: 'Check the stop.' };
      stopId = supplied;
    }
    const windowStart = raw.window_start == null || raw.window_start === '' ? null : boundedDay(raw.window_start, ctx);
    const windowEnd = raw.window_end == null || raw.window_end === '' ? null : boundedDay(raw.window_end, ctx);
    if (windowStart === false || windowEnd === false) return { ok: false, status: 400, error: 'Check the stop dates.' };
    rows.push({
      id: stopId,
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
      window_start: windowStart,
      window_end: windowEnd,
      contact_name: cleanText(raw.contact_name, 120),
      contact_phone: cleanText(raw.contact_phone, 40),
      instructions: cleanText(raw.instructions, 400),
      updated_at: ctx.now,
    });
  }
  return { ok: true, rows };
}

function addOdometer(book: FleetBook, op: FleetOp, ctx: OpContext): OpOutcome {
  const vehicle = book.vehicles.find((row) => row.id === op.payload.vehicle_id);
  if (!vehicle) return deny(400, 'Choose a vehicle.');
  const reading = numOf(op.payload.reading_km);
  if (reading == null || reading <= 0 || reading > 10_000_000) return deny(400, 'Check the odometer reading.');
  const readAt = op.payload.read_at == null || op.payload.read_at === '' ? todayOf(ctx) : boundedDay(op.payload.read_at, ctx);
  if (readAt === false) return deny(400, 'Check the odometer date.');
  const entryId = id();
  const priorAt = vehicle.odometer_at ? vehicle.odometer_at.slice(0, 10) : '';
  const priorKm = vehicle.odometer_km;
  const anomaly = priorKm != null && (readAt < priorAt || reading <= priorKm);
  const advance = !anomaly && (priorKm == null || (readAt >= priorAt && reading > priorKm));
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
        recorded_by: ctx.actorId,
        anomaly,
        created_at: ctx.now,
      },
    ],
    vehicles: book.vehicles.map((row) =>
      row.id === vehicle.id && advance
        ? { ...row, odometer_km: reading, odometer_at: readAt, updated_at: ctx.now }
        : row
    ),
  };
  return done(next, ctx, 'odometer.add', 'odometer', entryId, { vehicle_id: vehicle.id, reading_km: reading });
}

function addCost(book: FleetBook, op: FleetOp, ctx: OpContext, reverse: boolean): OpOutcome {
  const vehicle = book.vehicles.find((row) => row.id === op.payload.vehicle_id);
  if (!vehicle) return deny(400, 'Choose a vehicle.');
  let category = cleanText(op.payload.category, 40);
  let amount = cleanMoney(op.payload.amount_cents);
  let vat = 0;
  let litres = numOf(op.payload.litres);
  let odometer = numOf(op.payload.odometer_km);
  let fullTank = Boolean(op.payload.full_tank);
  let claimable = Boolean(op.payload.vat_claimable);
  let occurred = todayOf(ctx);
  let reverses: string | null = null;
  if (reverse) {
    const prior = book.cost_entries.find((row) => row.id === op.payload.reverses_id && row.vehicle_id === vehicle.id);
    if (!prior) return deny(400, 'Choose the cost entry to reverse.');
    if (prior.reverses_id) return deny(400, 'A reversal cannot be reversed.');
    if (book.cost_entries.some((row) => row.reverses_id === prior.id)) return deny(400, 'That cost entry is already reversed.');
    category = prior.category;
    amount = -prior.amount_cents;
    vat = -prior.vat_cents;
    litres = prior.litres == null ? null : -prior.litres;
    odometer = prior.odometer_km;
    fullTank = prior.full_tank;
    claimable = prior.vat_claimable;
    occurred = prior.occurred_on;
    reverses = prior.id;
  } else {
    if (amount == null || amount <= 0) return deny(400, 'Check the amount.');
    const dated = op.payload.occurred_on == null || op.payload.occurred_on === '' ? todayOf(ctx) : boundedDay(op.payload.occurred_on, ctx);
    if (dated === false) return deny(400, 'Check the date.');
    occurred = dated;
    if (presentNumber(op.payload.litres) && (litres == null || litres < 0 || litres > 5000)) return deny(400, 'Check the litres.');
    if (presentNumber(op.payload.odometer_km) && (odometer == null || odometer < 0 || odometer > 10_000_000)) return deny(400, 'Check the odometer.');
    if (presentNumber(op.payload.vat_cents)) {
      const parsed = cleanMoney(op.payload.vat_cents);
      if (parsed == null || parsed < 0) return deny(400, 'Check the VAT.');
      vat = parsed;
    } else if (claimable) {
      const bps = book.workspace.vat_rate_bps ?? 1500;
      vat = Math.round((amount * bps) / 10000);
    }
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
    occurred_on: occurred,
    amount_cents: amount,
    vat_cents: vat,
    vat_claimable: claimable,
    litres,
    odometer_km: odometer,
    full_tank: fullTank,
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
  const from = op.payload.effective_from == null || op.payload.effective_from === '' ? todayOf(ctx) : boundedDay(op.payload.effective_from, ctx);
  if (from === false) return deny(400, 'Check the effective date.');
  const method = cleanText(op.payload.depreciation_method || 'time', 20);
  const tyre = cleanText(op.payload.tyre_mode || book.workspace.tyre_mode_default, 20);
  if ((method !== 'time' && method !== 'distance') || (tyre !== 'accrual' && tyre !== 'ledger')) {
    return deny(400, 'Check depreciation and tyre settings.');
  }
  const money = profileMoney(op.payload);
  if (!money.ok) return money.outcome;
  const hasCost =
    money.values.purchase_price_cents != null ||
    money.values.residual_cents != null ||
    money.values.tyre_set_cost_cents != null ||
    money.values.finance_monthly_cents > 0 ||
    money.values.insurance_annual_cents > 0 ||
    money.values.licences_annual_cents > 0 ||
    money.values.tracker_monthly_cents > 0 ||
    money.values.other_standing_monthly_cents > 0 ||
    money.values.driver_cost_monthly_cents > 0;
  if (!hasCost) return deny(400, 'Add at least one cost.');
  const profiles = book.cost_profiles.map((row) => {
    if (row.vehicle_id !== vehicle.id) return row;
    if (row.effective_from === from && row.effective_to !== from) return { ...row, effective_to: from, updated_at: ctx.now };
    if (!row.effective_to && row.effective_from < from) return { ...row, effective_to: from, updated_at: ctx.now };
    return row;
  });
  const inService = op.payload.in_service_on == null || op.payload.in_service_on === '' ? from : boundedDay(op.payload.in_service_on, ctx);
  if (inService === false) return deny(400, 'Check the in-service date.');
  const disposed = op.payload.disposed_on == null || op.payload.disposed_on === '' ? null : boundedDay(op.payload.disposed_on, ctx);
  if (disposed === false) return deny(400, 'Check the disposal date.');
  const later = profiles
    .filter((row) => row.vehicle_id === vehicle.id && row.effective_from > from && row.effective_to !== row.effective_from)
    .map((row) => row.effective_from)
    .sort();
  const effectiveTo = later[0] || null;
  const overlap = profiles.some((row) => row.vehicle_id === vehicle.id && rangesOverlap(from, effectiveTo, row.effective_from, row.effective_to));
  if (overlap) return deny(409, 'That cost profile overlaps an existing one.');
  const row: FleetCostProfile = {
    id: id(),
    company_id: ctx.companyId,
    vehicle_id: vehicle.id,
    effective_from: from,
    effective_to: effectiveTo,
    purchase_price_cents: money.values.purchase_price_cents,
    residual_cents: money.values.residual_cents,
    depreciation_method: method,
    life_months: intOf(op.payload.life_months),
    life_km: intOf(op.payload.life_km),
    in_service_on: inService,
    disposed_on: disposed,
    finance_monthly_cents: money.values.finance_monthly_cents,
    insurance_annual_cents: money.values.insurance_annual_cents,
    licences_annual_cents: money.values.licences_annual_cents,
    tracker_monthly_cents: money.values.tracker_monthly_cents,
    other_standing_monthly_cents: money.values.other_standing_monthly_cents,
    driver_cost_monthly_cents: money.values.driver_cost_monthly_cents,
    tyre_mode: tyre as TyreMode,
    tyre_set_cost_cents: cleanMoney(op.payload.tyre_set_cost_cents),
    tyre_life_km: intOf(op.payload.tyre_life_km),
    updated_at: ctx.now,
  };
  return done({ ...book, cost_profiles: [...profiles, row] }, ctx, 'cost_profile.set', 'cost_profile', row.id, { vehicle_id: vehicle.id });
}

function setPool(book: FleetBook, op: FleetOp, ctx: OpContext, expected?: string | null): OpOutcome {
  const month = boundedDay(op.payload.period_month, ctx);
  if (month === false || !month) return deny(400, 'Choose a month.');
  const period = `${month.slice(0, 7)}-01`;
  const amount = cleanMoney(op.payload.amount_cents);
  if (amount == null || amount <= 0) return deny(400, 'Check the overhead amount.');
  const basis = cleanText(op.payload.basis || book.workspace.overhead_basis, 32) as OverheadBasis;
  if (!['equal_vehicle_days', 'km', 'revenue'].includes(basis)) return deny(400, 'Choose how overhead is shared.');
  const existing = book.overhead_pools.find((row) => row.period_month.slice(0, 7) === period.slice(0, 7));
  if (existing) {
    const clash = cas(existing.updated_at, expected);
    if (clash) return clash;
  }
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
  if (target == null || target <= 0) return deny(400, 'Check the target.');
  const effective = op.payload.effective_from == null || op.payload.effective_from === '' ? todayOf(ctx) : boundedDay(op.payload.effective_from, ctx);
  if (effective === false) return deny(400, 'Check the effective date.');
  const row = {
    id: id(),
    company_id: ctx.companyId,
    scope_kind: scope as 'fleet' | 'vehicle_class' | 'vehicle' | 'lane',
    scope_ref: cleanText(op.payload.scope_ref, 80),
    layer: layer as 'fully_loaded' | 'operating',
    target_cents_per_km: target,
    effective_from: effective,
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
  if ('display_name' in op.payload && !cleanText(op.payload.display_name, 120)) return deny(400, 'Add a workspace name.');
  const windowDays = intOf(op.payload.expiring_window_days);
  const cpkWindow = intOf(op.payload.cpk_window_days);
  const minKm = intOf(op.payload.cpk_min_km);
  if (windowDays != null && (windowDays < 1 || windowDays > 365)) return deny(400, 'The expiry window must be between 1 and 365 days.');
  if (cpkWindow != null && (cpkWindow < 1 || cpkWindow > 3660)) return deny(400, 'Check the cost window.');
  if (minKm != null && minKm < 0) return deny(400, 'Check the minimum distance.');
  if ('overhead_basis' in op.payload && !['equal_vehicle_days', 'km', 'revenue'].includes(cleanText(op.payload.overhead_basis, 32))) {
    return deny(400, 'Choose how overhead is shared.');
  }
  const laneTrips = intOf(op.payload.cpk_min_trips_per_lane);
  if ('cpk_min_trips_per_lane' in op.payload && (laneTrips == null || laneTrips < 1)) return deny(400, 'Check the minimum trips per lane.');
  const retention = intOf(op.payload.retention_days);
  if ('retention_days' in op.payload && ctx.role === 'owner' && (retention == null || retention < 1 || retention > 3650)) {
    return deny(400, 'Retention must be between 1 and 3650 days.');
  }
  const margin = intOf(op.payload.required_margin_bps);
  if ('required_margin_bps' in op.payload && (margin == null || margin < 0 || margin > 9999)) return deny(400, 'Check the required margin.');
  if ('tyre_mode_default' in op.payload && !['accrual', 'ledger'].includes(cleanText(op.payload.tyre_mode_default, 20))) {
    return deny(400, 'Choose a tyre setting.');
  }
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
    cpk_min_trips_per_lane: laneTrips ?? book.workspace.cpk_min_trips_per_lane,
    overhead_basis: ('overhead_basis' in op.payload ? cleanText(op.payload.overhead_basis, 32) : book.workspace.overhead_basis) as OverheadBasis,
    required_margin_bps: margin ?? book.workspace.required_margin_bps,
    fines_in_cpk: 'fines_in_cpk' in op.payload ? Boolean(op.payload.fines_in_cpk) : book.workspace.fines_in_cpk,
    tyre_mode_default: (cleanText(op.payload.tyre_mode_default || book.workspace.tyre_mode_default, 20) || book.workspace.tyre_mode_default) as TyreMode,
    dispatcher_sees_rates:
      ctx.role === 'owner' && 'dispatcher_sees_rates' in op.payload
        ? Boolean(op.payload.dispatcher_sees_rates)
        : book.workspace.dispatcher_sees_rates,
    retention_days: ctx.role === 'owner' && 'retention_days' in op.payload ? retention : book.workspace.retention_days,
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function memberId(book: FleetBook, kind: 'vehicle' | 'driver', value: unknown): string | null | OpOutcome {
  const text = cleanText(value, 80);
  if (!text) return null;
  const rows = kind === 'vehicle' ? book.vehicles : book.drivers;
  if (!rows.some((row) => row.id === text && !row.archived_at)) {
    return deny(400, kind === 'vehicle' ? 'Choose a vehicle from this fleet.' : 'Choose a driver from this fleet.');
  }
  return text;
}

function todayOf(ctx: OpContext): string {
  return sastDate(ctx.now) || ctx.now.slice(0, 10);
}

function addCalendarDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function boundedDay(value: unknown, ctx: OpContext): string | false {
  const day = dateOrNull(value);
  if (!day) return false;
  const latest = addCalendarDays(todayOf(ctx), 1);
  if (day < '2000-01-01' || day > latest) return false;
  return day;
}

function dateOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return sastDate(value);
}

const FREE_TEXT_KEYS = new Set([
  'reference',
  'notes',
  'note',
  'status_note',
  'cargo_description',
  'customer_name',
  'place_name',
  'detail',
  'new_customer_name',
  'instructions',
]);

function screenPayloadText(payload: Record<string, unknown>): OpOutcome | null {
  const hit = screenValue(payload);
  if (hit) return hit;
  if (Array.isArray(payload.stops)) {
    for (const stop of payload.stops) {
      const nested = screenValue(stop);
      if (nested) return nested;
    }
  }
  return null;
}

function screenValue(value: unknown): OpOutcome | null {
  if (typeof value === 'string') {
    const hit = assertNoIdentityText(value);
    if (!hit.ok) return deny(400, hit.error);
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = screenValue(item);
      if (hit) return hit;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (!FREE_TEXT_KEYS.has(key)) continue;
    const hit = screenValue(child);
    if (hit) return hit;
  }
  return null;
}

function presentNumber(value: unknown): boolean {
  return value != null && value !== '';
}

function rangesOverlap(from: string, to: string | null, otherFrom: string, otherTo: string | null): boolean {
  const end = to || '9999-12-31';
  const otherEnd = otherTo || '9999-12-31';
  return from < otherEnd && otherFrom < end;
}

const OPTIONAL_MONEY = ['purchase_price_cents', 'residual_cents', 'tyre_set_cost_cents'] as const;
const REQUIRED_MONEY = [
  'finance_monthly_cents',
  'insurance_annual_cents',
  'licences_annual_cents',
  'tracker_monthly_cents',
  'other_standing_monthly_cents',
  'driver_cost_monthly_cents',
] as const;

function profileMoney(payload: Record<string, unknown>):
  | { ok: true; values: Record<(typeof OPTIONAL_MONEY)[number], number | null> & Record<(typeof REQUIRED_MONEY)[number], number> }
  | { ok: false; outcome: OpOutcome } {
  const values = {} as Record<string, number | null>;
  for (const key of OPTIONAL_MONEY) {
    if (!(key in payload) || payload[key] == null || payload[key] === '') {
      values[key] = null;
      continue;
    }
    const amount = cleanMoney(payload[key]);
    if (amount == null || amount < 0) return { ok: false, outcome: deny(400, 'Check the amount.') };
    values[key] = amount;
  }
  for (const key of REQUIRED_MONEY) {
    if (!(key in payload) || payload[key] == null || payload[key] === '') {
      values[key] = 0;
      continue;
    }
    const amount = cleanMoney(payload[key]);
    if (amount == null || amount < 0) return { ok: false, outcome: deny(400, 'Check the amount.') };
    values[key] = amount;
  }
  return { ok: true, values: values as Record<(typeof OPTIONAL_MONEY)[number], number | null> & Record<(typeof REQUIRED_MONEY)[number], number> };
}

export function cloneBook(book: FleetBook = emptyFleetBook()): FleetBook {
  return structuredClone(book);
}
