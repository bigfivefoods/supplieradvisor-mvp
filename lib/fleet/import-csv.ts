/**
 * FleetAdvisor® CSV import. Errors carry a row, a field and a code. Values stay out of the error.
 */
import { cell, headerIndex, isoDate, parseCsv, type CsvError } from './csv';
import { sha256Hex } from './sha256';
import { normaliseCountries } from './permits';
import { LICENCE_CODES } from './import-ship';
import type { ComplianceKind, FleetBook, FleetCompliance, FleetDriver, FleetVehicle, ImportKind } from './types';

const VEHICLE_HEADERS = ['reg_no', 'kind', 'ownership', 'make', 'model', 'year', 'vin', 'gvm_kg', 'tare_kg', 'payload_kg', 'fuel_type', 'tank_litres', 'depot_label'];
const DRIVER_HEADERS = ['full_name', 'phone', 'email', 'employment', 'licence_code'];
const COMPLIANCE_HEADERS = ['subject_kind', 'subject_ref', 'kind', 'expires_on', 'issued_on', 'reference', 'category', 'countries', 'notes'];

const KINDS = new Set(['rigid', 'tractor', 'trailer', 'tipper', 'van', 'other']);
const OWNERSHIP = new Set(['owned', 'leased', 'subcontractor']);
const EMPLOYMENT = new Set(['employee', 'contractor', 'owner_operator']);
const COMPLIANCE = new Set<ComplianceKind>([
  'licence_disc', 'roadworthy', 'operator_card', 'insurance', 'cross_border_permit', 'abnormal_permit', 'other_permit',
  'driver_licence', 'prdp', 'medical', 'induction', 'other',
]);

export type ImportIssue = { row: number; code: string; field: string };
export type ImportSummary = { create: number; link: number; fill: number; errors: number };

export type VehiclePlan = { action: 'create' | 'link'; fill: string[]; vehicle: FleetVehicle; previousId?: string };
export type DriverPlan = { action: 'create' | 'link'; fill: string[]; driver: FleetDriver; previousId?: string };
export type CompliancePlan = { action: 'create' | 'link'; fill: string[]; item: FleetCompliance; previousId?: string };

export type CsvImportResult = {
  rows: Array<VehiclePlan | DriverPlan | CompliancePlan>;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  summary: ImportSummary;
  source_hash: string;
};

export function templateCsv(kind: 'vehicles_csv' | 'drivers_csv' | 'compliance_csv'): string {
  if (kind === 'vehicles_csv') return `${VEHICLE_HEADERS.join(',')}\r\nSAMPLE 99,rigid,owned,Sample,Rigid,2019,,16000,8000,8000,Diesel,400,Sample Depot\r\n`;
  if (kind === 'drivers_csv') return `${DRIVER_HEADERS.join(',')}\r\nSample Driver,0000000000,sample.driver@example.com,employee,EC\r\n`;
  return `${COMPLIANCE_HEADERS.join(',')}\r\nvehicle,SAMPLE 99,licence_disc,2027-03-12,2026-03-12,,,,\r\n`;
}

export function validateVehicleCsv(text: string, book: FleetBook, now: string): CsvImportResult {
  return finish(text, 'vehicles_csv', (table) => {
    const index = headerIndex(table.headers);
    const missing = VEHICLE_HEADERS.filter((name) => name === 'reg_no' && !index.has(name));
    if (missing.length) return { plans: [], errors: [{ row: 1, code: 'missing_header', field: 'reg_no' }], warnings: [] };
    const plans: VehiclePlan[] = [];
    const errors: ImportIssue[] = [];
    const warnings: ImportIssue[] = [];
    table.records.forEach((record) => {
      const reg = cell(record, index.get('reg_no')).toUpperCase();
      if (!reg) {
        errors.push({ row: record.row, code: 'missing', field: 'reg_no' });
        return;
      }
      const kind = cell(record, index.get('kind')).toLowerCase() || 'rigid';
      const ownership = cell(record, index.get('ownership')).toLowerCase() || 'owned';
      if (!KINDS.has(kind) || !OWNERSHIP.has(ownership)) {
        errors.push({ row: record.row, code: 'enum', field: !KINDS.has(kind) ? 'kind' : 'ownership' });
        return;
      }
      const year = optionalInt(cell(record, index.get('year')));
      if (year === false) {
        errors.push({ row: record.row, code: 'number', field: 'year' });
        return;
      }
      const gvm = optionalInt(cell(record, index.get('gvm_kg')));
      const tare = optionalInt(cell(record, index.get('tare_kg')));
      const payloadKg = optionalInt(cell(record, index.get('payload_kg')));
      if (gvm === false || tare === false || payloadKg === false) {
        errors.push({ row: record.row, code: 'number', field: gvm === false ? 'gvm_kg' : tare === false ? 'tare_kg' : 'payload_kg' });
        return;
      }
      const incoming: FleetVehicle = {
        id: crypto.randomUUID(),
        company_id: book.workspace.company_id,
        reg_no: reg,
        kind: kind as FleetVehicle['kind'],
        ownership: ownership as FleetVehicle['ownership'],
        make: cell(record, index.get('make')),
        model: cell(record, index.get('model')),
        year,
        vin: cell(record, index.get('vin')),
        gvm_kg: gvm,
        tare_kg: tare,
        payload_kg: payloadKg,
        fuel_type: cell(record, index.get('fuel_type')),
        tank_litres: optionalNumber(cell(record, index.get('tank_litres'))),
        odometer_km: null,
        odometer_at: null,
        status: 'active',
        depot_label: cell(record, index.get('depot_label')),
        tracker_fitted: false,
        tracker_provider: '',
        notes: '',
        archived_at: null,
        updated_at: now,
      };
      const match = book.vehicles.find((row) => !row.archived_at && row.reg_no.toLowerCase() === reg.toLowerCase());
      if (!match) {
        plans.push({ action: 'create', fill: [], vehicle: incoming });
        return;
      }
      const filled = fillBlanks(match, incoming, ['make', 'model', 'year', 'vin', 'gvm_kg', 'tare_kg', 'payload_kg', 'fuel_type', 'tank_litres', 'depot_label']);
      plans.push({ action: 'link', fill: filled.keys, vehicle: { ...filled.row, id: match.id, updated_at: now }, previousId: match.id });
    });
    return { plans, errors, warnings };
  });
}

export function validateDriverCsv(text: string, book: FleetBook, now: string): CsvImportResult {
  return finish(text, 'drivers_csv', (table) => {
    const index = headerIndex(table.headers);
    if (!index.has('full_name')) return { plans: [], errors: [{ row: 1, code: 'missing_header', field: 'full_name' }], warnings: [] };
    const plans: DriverPlan[] = [];
    const errors: ImportIssue[] = [];
    const warnings: ImportIssue[] = [];
    table.records.forEach((record) => {
      const name = cell(record, index.get('full_name'));
      if (!name) {
        errors.push({ row: record.row, code: 'missing', field: 'full_name' });
        return;
      }
      const employment = cell(record, index.get('employment')).toLowerCase() || 'employee';
      if (!EMPLOYMENT.has(employment)) {
        errors.push({ row: record.row, code: 'enum', field: 'employment' });
        return;
      }
      const licence = cell(record, index.get('licence_code')).toUpperCase();
      if (licence && !(LICENCE_CODES as readonly string[]).includes(licence)) {
        warnings.push({ row: record.row, code: 'licence_code_dropped', field: 'licence_code' });
      }
      const incoming: FleetDriver = {
        id: crypto.randomUUID(),
        company_id: book.workspace.company_id,
        full_name: name,
        phone: cell(record, index.get('phone')),
        email: cell(record, index.get('email')).toLowerCase(),
        employment: employment as FleetDriver['employment'],
        licence_code: (LICENCE_CODES as readonly string[]).includes(licence) ? licence : '',
        status: 'active',
        person_id: null,
        notes: '',
        archived_at: null,
        updated_at: now,
      };
      const match = matchDriver(book, incoming);
      if (match === 'ambiguous') {
        errors.push({ row: record.row, code: 'ambiguous_ref', field: 'full_name' });
        return;
      }
      if (!match) {
        plans.push({ action: 'create', fill: [], driver: incoming });
        return;
      }
      const filled = fillBlanks(match, incoming, ['phone', 'email', 'licence_code', 'employment']);
      plans.push({ action: 'link', fill: filled.keys, driver: { ...filled.row, id: match.id, updated_at: now }, previousId: match.id });
    });
    return { plans, errors, warnings };
  });
}

export function validateComplianceCsv(text: string, book: FleetBook, now: string): CsvImportResult {
  return finish(text, 'compliance_csv', (table) => {
    const index = headerIndex(table.headers);
    const plans: CompliancePlan[] = [];
    const errors: ImportIssue[] = [];
    const warnings: ImportIssue[] = [];
    table.records.forEach((record) => {
      const subjectKind = cell(record, index.get('subject_kind')).toLowerCase();
      const subjectRef = cell(record, index.get('subject_ref'));
      const kind = cell(record, index.get('kind')).toLowerCase();
      if (subjectKind !== 'vehicle' && subjectKind !== 'driver') {
        errors.push({ row: record.row, code: 'enum', field: 'subject_kind' });
        return;
      }
      if (!COMPLIANCE.has(kind as ComplianceKind)) {
        errors.push({ row: record.row, code: 'enum', field: 'kind' });
        return;
      }
      const expires = cell(record, index.get('expires_on'));
      const issued = cell(record, index.get('issued_on'));
      if (expires && !isoDate(expires)) {
        errors.push({ row: record.row, code: 'date', field: 'expires_on' });
        return;
      }
      if (issued && !isoDate(issued)) {
        errors.push({ row: record.row, code: 'date', field: 'issued_on' });
        return;
      }
      const subject = resolveSubject(book, subjectKind, subjectRef);
      if (subject === 'ambiguous' || subject === 'unknown' || !subject) {
        errors.push({ row: record.row, code: subject === 'ambiguous' ? 'ambiguous_ref' : 'unknown_ref', field: 'subject_ref' });
        return;
      }
      const detail: Record<string, unknown> = {};
      if (kind === 'prdp') {
        const category = cell(record, index.get('category')).toUpperCase();
        if (!category || !['G', 'D', 'P'].includes(category)) {
          errors.push({ row: record.row, code: 'enum', field: 'category' });
          return;
        }
        detail.category = category;
      }
      if (kind === 'cross_border_permit') {
        const countries = normaliseCountries(cell(record, index.get('countries')));
        if (!countries) {
          errors.push({ row: record.row, code: 'enum', field: 'countries' });
          return;
        }
        detail.countries = countries;
      }
      const item: FleetCompliance = {
        id: crypto.randomUUID(),
        company_id: book.workspace.company_id,
        subject_kind: subjectKind,
        subject_id: subject.id,
        kind: kind as ComplianceKind,
        reference: cell(record, index.get('reference')).slice(0, 64),
        issued_on: issued || null,
        expires_on: expires || null,
        detail,
        status_note: cell(record, index.get('notes')).slice(0, 400),
        archived_at: null,
        updated_at: now,
      };
      const match = book.compliance.find((row) => !row.archived_at && row.subject_kind === subjectKind && row.subject_id === subject.id && row.kind === kind);
      if (!match) {
        plans.push({ action: 'create', fill: [], item });
        return;
      }
      const filled = fillBlanks(match, item, ['reference', 'issued_on', 'expires_on', 'status_note']);
      plans.push({ action: 'link', fill: filled.keys, item: { ...filled.row, id: match.id, updated_at: now }, previousId: match.id });
    });
    return { plans, errors, warnings };
  });
}

export function redactDryRun(result: CsvImportResult, demoDrivers: boolean): CsvImportResult {
  if (!demoDrivers) return result;
  return {
    ...result,
    rows: result.rows.map((row) => {
      if (!('driver' in row)) return row;
      return { ...row, driver: { ...row.driver, full_name: '', phone: '', email: '' } };
    }),
  };
}

function finish(
  text: string,
  kind: ImportKind,
  build: (table: { headers: string[]; records: Array<{ row: number; cells: string[] }> }) => { plans: CsvImportResult['rows']; errors: ImportIssue[]; warnings: ImportIssue[] }
): CsvImportResult {
  const parsed = parseCsv(text);
  if (!parsed.ok) {
    return { rows: [], errors: parsed.errors as CsvError[], warnings: [], summary: { create: 0, link: 0, fill: 0, errors: parsed.errors.length }, source_hash: sha256Hex(`${kind}\n`) };
  }
  const built = build(parsed.table);
  const summary = {
    create: built.plans.filter((row) => row.action === 'create').length,
    link: built.plans.filter((row) => row.action === 'link').length,
    fill: built.plans.reduce((sum, row) => sum + row.fill.length, 0),
    errors: built.errors.length,
  };
  return { rows: built.plans, errors: built.errors, warnings: built.warnings, summary, source_hash: sourceHash(kind, text) };
}

export function sourceHash(kind: string, text: string): string {
  const normalised = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  return sha256Hex(`${kind}\n${normalised}`);
}

function matchDriver(book: FleetBook, incoming: FleetDriver): FleetDriver | 'ambiguous' | null {
  const active = book.drivers.filter((row) => !row.archived_at);
  if (incoming.email) {
    const byEmail = active.filter((row) => row.email && row.email === incoming.email);
    if (byEmail.length > 1) return 'ambiguous';
    if (byEmail.length === 1) return byEmail[0];
  }
  if (incoming.phone) {
    const byPhone = active.filter((row) => row.phone && row.phone === incoming.phone);
    if (byPhone.length > 1) return 'ambiguous';
    if (byPhone.length === 1) return byPhone[0];
  }
  const byName = active.filter((row) => row.full_name === incoming.full_name);
  if (byName.length > 1) return 'ambiguous';
  if (byName.length === 1) return byName[0];
  return null;
}

function resolveSubject(book: FleetBook, kind: string, ref: string): { id: string } | 'ambiguous' | 'unknown' {
  if (!ref) return 'unknown';
  if (kind === 'vehicle') {
    const rows = book.vehicles.filter((row) => !row.archived_at && row.reg_no.toLowerCase() === ref.toLowerCase());
    if (rows.length > 1) return 'ambiguous';
    if (rows.length === 1) return { id: rows[0].id };
    return 'unknown';
  }
  const active = book.drivers.filter((row) => !row.archived_at);
  const email = ref.toLowerCase();
  const byEmail = active.filter((row) => row.email && row.email === email);
  if (byEmail.length > 1) return 'ambiguous';
  if (byEmail.length === 1) return { id: byEmail[0].id };
  const byPhone = active.filter((row) => row.phone && row.phone === ref);
  if (byPhone.length > 1) return 'ambiguous';
  if (byPhone.length === 1) return { id: byPhone[0].id };
  const byName = active.filter((row) => row.full_name === ref);
  if (byName.length > 1) return 'ambiguous';
  if (byName.length === 1) return { id: byName[0].id };
  return 'unknown';
}

function fillBlanks<T extends Record<string, unknown>>(current: T, incoming: T, keys: string[]): { row: T; keys: string[] } {
  const next: Record<string, unknown> = { ...current };
  const filled: string[] = [];
  for (const key of keys) {
    const prior = current[key];
    const value = incoming[key];
    const blank = prior == null || prior === '';
    const present = value != null && value !== '';
    if (blank && present) {
      next[key] = value;
      filled.push(key);
    }
  }
  return { row: next as T, keys: filled };
}

function optionalInt(value: string): number | null | false {
  if (!value) return null;
  if (!/^-?\d+$/.test(value)) return false;
  return Number(value);
}

function optionalNumber(value: string): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
