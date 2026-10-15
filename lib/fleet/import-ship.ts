/**
 * FleetAdvisor® one-way map from Ship rows. Licence numbers are not a field on this type.
 */
import { createHash } from 'node:crypto';
import type { FleetBook, FleetDriver, FleetVehicle, VehicleKind } from './types';

export const SHIP_VEHICLE_COLUMNS = ['id', 'code', 'plate_number', 'make_model', 'vehicle_type', 'capacity_kg', 'status'] as const;
export const SHIP_DRIVER_COLUMNS = ['id', 'code', 'full_name', 'phone', 'email', 'license_class', 'status'] as const;

export const LICENCE_CODES = ['A', 'A1', 'B', 'EB', 'C1', 'C', 'EC1', 'EC'] as const;

export const PREVIEW_SHIP_VEHICLE_ID = '6f1e2d3c-4b5a-4690-8a7b-6c5d4e3f2a10';
export const PREVIEW_SHIP_DRIVER_ID = '7a2b3c4d-5e6f-4701-8a9b-0c1d2e3f4a5b';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isFleetUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function shipSourceHash(kind: 'ship_vehicles' | 'ship_drivers', rows: Array<ShipVehicleRow | ShipDriverRow>): string {
  const columns = kind === 'ship_vehicles' ? SHIP_VEHICLE_COLUMNS : SHIP_DRIVER_COLUMNS;
  const canonical = rows
    .map((row) => {
      const record = row as unknown as Record<string, unknown>;
      const picked: Record<string, string> = {};
      for (const column of columns) picked[column] = record[column] == null ? '' : String(record[column]);
      return picked;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  return createHash('sha256').update(`${kind}\n${JSON.stringify(canonical)}`).digest('hex');
}

const VEHICLE_KIND: Record<string, VehicleKind> = {
  van: 'van',
  truck: 'rigid',
  reefer: 'rigid',
  trailer: 'trailer',
  bike: 'other',
  container: 'other',
  tractor: 'tractor',
  tipper: 'tipper',
  rigid: 'rigid',
  other: 'other',
};

export type ShipVehicleRow = {
  id: string | number;
  code?: string | null;
  plate_number?: string | null;
  make_model?: string | null;
  vehicle_type?: string | null;
  capacity_kg?: number | string | null;
  status?: string | null;
};

export type ShipDriverRow = {
  id: string | number;
  code?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  license_class?: string | null;
  status?: string | null;
};

export type ShipWarning = { row: number; code: string; field: string };

export function mapShipVehicle(row: ShipVehicleRow, companyId: number, now: string, rowNumber: number): {
  vehicle: Omit<FleetVehicle, 'id'> | null;
  warnings: ShipWarning[];
} {
  const warnings: ShipWarning[] = [];
  const reg = String(row.plate_number || '').trim().toUpperCase();
  if (!reg) return { vehicle: null, warnings: [{ row: rowNumber, code: 'missing_reg', field: 'plate_number' }] };
  const rawKind = String(row.vehicle_type || '').trim().toLowerCase();
  const kind = VEHICLE_KIND[rawKind] || 'other';
  if (!VEHICLE_KIND[rawKind]) warnings.push({ row: rowNumber, code: 'kind_other', field: 'vehicle_type' });
  const split = splitMake(String(row.make_model || ''));
  const payload = numberOrNull(row.capacity_kg);
  return {
    vehicle: {
      company_id: companyId,
      reg_no: reg,
      kind,
      ownership: 'owned',
      make: split.make,
      model: split.model,
      year: null,
      vin: '',
      gvm_kg: null,
      tare_kg: null,
      payload_kg: payload,
      fuel_type: '',
      tank_litres: null,
      odometer_km: null,
      odometer_at: null,
      status: mapVehicleStatus(String(row.status || '')),
      depot_label: '',
      tracker_fitted: false,
      tracker_provider: '',
      notes: '',
      archived_at: null,
      source_system: 'ship',
      source_id: String(row.id).slice(0, 64),
      updated_at: now,
    },
    warnings,
  };
}

export function mapShipDriver(row: ShipDriverRow, companyId: number, now: string, rowNumber: number): {
  driver: Omit<FleetDriver, 'id'> | null;
  warnings: ShipWarning[];
} {
  const warnings: ShipWarning[] = [];
  const name = String(row.full_name || '').trim();
  if (!name) return { driver: null, warnings: [{ row: rowNumber, code: 'missing_name', field: 'full_name' }] };
  const code = String(row.license_class || '').trim().toUpperCase();
  let licence = '';
  if (code) {
    if ((LICENCE_CODES as readonly string[]).includes(code)) licence = code;
    else warnings.push({ row: rowNumber, code: 'licence_code_dropped', field: 'license_class' });
  }
  return {
    driver: {
      company_id: companyId,
      full_name: name,
      phone: String(row.phone || '').trim(),
      email: String(row.email || '').trim().toLowerCase(),
      employment: 'employee',
      licence_code: licence,
      status: mapDriverStatus(String(row.status || '')),
      person_id: null,
      notes: '',
      archived_at: null,
      source_system: 'ship',
      source_id: String(row.id).slice(0, 64),
      updated_at: now,
    },
    warnings,
  };
}

function mapVehicleStatus(status: string): FleetVehicle['status'] {
  const value = status.trim().toLowerCase();
  if (value === 'maintenance') return 'workshop';
  if (value === 'offline') return 'off_road';
  return 'active';
}

function mapDriverStatus(status: string): FleetDriver['status'] {
  const value = status.trim().toLowerCase();
  if (value === 'off_duty') return 'on_leave';
  if (value === 'suspended') return 'inactive';
  return 'active';
}

function splitMake(value: string): { make: string; model: string } {
  const text = value.trim();
  if (!text) return { make: '', model: '' };
  const space = text.indexOf(' ');
  if (space <= 0) return { make: text.slice(0, 80), model: '' };
  return { make: text.slice(0, space).slice(0, 80), model: text.slice(space + 1).trim().slice(0, 80) };
}

export type ShipVehiclePlan = { action: 'create' | 'link'; fill: string[]; vehicle: FleetVehicle };
export type ShipDriverPlan = { action: 'create' | 'link'; fill: string[]; driver: FleetDriver };

export function planShipVehicles(
  rows: ShipVehicleRow[],
  book: FleetBook,
  now: string,
  nextId: () => string = () => crypto.randomUUID()
): { rows: ShipVehiclePlan[]; warnings: ShipWarning[]; summary: { create: number; link: number; fill: number; errors: number } } {
  const plans: ShipVehiclePlan[] = [];
  const warnings: ShipWarning[] = [];
  let errors = 0;
  rows.forEach((row, index) => {
    const mapped = mapShipVehicle(row, book.workspace.company_id, now, index + 2);
    warnings.push(...mapped.warnings);
    if (!mapped.vehicle) {
      errors += 1;
      return;
    }
    const sourceId = mapped.vehicle.source_id || '';
    const bySource = book.vehicles.find((item) => !item.archived_at && item.source_system === 'ship' && item.source_id === sourceId);
    const byReg = book.vehicles.find((item) => !item.archived_at && item.reg_no.toLowerCase() === mapped.vehicle!.reg_no.toLowerCase());
    const match = bySource || byReg;
    if (!match) {
      plans.push({ action: 'create', fill: [], vehicle: { ...mapped.vehicle, id: nextId() } });
      return;
    }
    plans.push({
      action: 'link',
      fill: [],
      vehicle: { ...match, ...mapped.vehicle, id: match.id, company_id: book.workspace.company_id, updated_at: now },
    });
  });
  const summary = {
    create: plans.filter((row) => row.action === 'create').length,
    link: plans.filter((row) => row.action === 'link').length,
    fill: 0,
    errors,
  };
  return { rows: plans, warnings, summary };
}

export function planShipDrivers(
  rows: ShipDriverRow[],
  book: FleetBook,
  now: string,
  nextId: () => string = () => crypto.randomUUID()
): { rows: ShipDriverPlan[]; warnings: ShipWarning[]; summary: { create: number; link: number; fill: number; errors: number } } {
  const plans: ShipDriverPlan[] = [];
  const warnings: ShipWarning[] = [];
  let errors = 0;
  rows.forEach((row, index) => {
    const mapped = mapShipDriver(row, book.workspace.company_id, now, index + 2);
    warnings.push(...mapped.warnings);
    if (!mapped.driver) {
      errors += 1;
      return;
    }
    const sourceId = mapped.driver.source_id || '';
    const bySource = book.drivers.find((item) => !item.archived_at && item.source_system === 'ship' && item.source_id === sourceId);
    const byEmail = mapped.driver.email
      ? book.drivers.find((item) => !item.archived_at && item.email && item.email === mapped.driver!.email)
      : undefined;
    const match = bySource || byEmail;
    if (!match) {
      plans.push({ action: 'create', fill: [], driver: { ...mapped.driver, id: nextId() } });
      return;
    }
    plans.push({
      action: 'link',
      fill: [],
      driver: { ...match, ...mapped.driver, id: match.id, company_id: book.workspace.company_id, updated_at: now },
    });
  });
  const summary = {
    create: plans.filter((row) => row.action === 'create').length,
    link: plans.filter((row) => row.action === 'link').length,
    fill: 0,
    errors,
  };
  return { rows: plans, warnings, summary };
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number);
}

/** Sample Ship rows belong on the signed-out preview. A real desk shows the server counts only. */
export function shipRowsForDesk<T>(preview: boolean, planned: T[]): T[] {
  return preview ? planned : [];
}
