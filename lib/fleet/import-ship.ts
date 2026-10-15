/**
 * FleetAdvisor® one-way map from Ship rows. Licence numbers are not a field on this type.
 */
import type { FleetDriver, FleetVehicle, VehicleKind } from './types';

export const SHIP_VEHICLE_COLUMNS = ['id', 'code', 'plate_number', 'make_model', 'vehicle_type', 'capacity_kg', 'status'] as const;
export const SHIP_DRIVER_COLUMNS = ['id', 'code', 'full_name', 'phone', 'email', 'license_class', 'status'] as const;

export const LICENCE_CODES = ['A', 'A1', 'B', 'EB', 'C1', 'C', 'EC1', 'EC'] as const;

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

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number);
}
