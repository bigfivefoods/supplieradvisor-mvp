/**
 * FleetAdvisor® import derivation. Client plans are dropped. The server reads Ship or re-parses the CSV.
 */
import { validateComplianceCsv, validateDriverCsv, validateVehicleCsv } from './import-csv';
import { planShipDrivers, planShipVehicles, shipSourceHash, type ShipDriverRow, type ShipVehicleRow } from './import-ship';
import { readShipDrivers, readShipVehicles } from './ship-source';
import type { FleetBook, FleetOp } from './types';

export async function materialiseImport(
  book: FleetBook,
  op: FleetOp,
  now: string
): Promise<{ ok: true; op: FleetOp } | { ok: false; pending?: boolean; status: number; error: string }> {
  if (op.op !== 'import.dry_run' && op.op !== 'import.commit') return { ok: true, op };
  const kind = typeof op.payload.kind === 'string' ? op.payload.kind : '';
  const label = typeof op.payload.source_label === 'string' && op.payload.source_label.trim() ? op.payload.source_label : '';
  if (kind === 'ship_vehicles' || kind === 'ship_drivers') {
    const read = kind === 'ship_vehicles' ? await readShipVehicles(book.workspace.company_id) : await readShipDrivers(book.workspace.company_id);
    if (!read.ok) {
      if (read.missing) return { ok: false, pending: true, status: 200, error: 'Database setup is still pending.' };
      return { ok: false, status: 500, error: 'The desk could not read Ship.' };
    }
    const planned =
      kind === 'ship_vehicles'
        ? planShipVehicles(read.rows as ShipVehicleRow[], book, now)
        : planShipDrivers(read.rows as ShipDriverRow[], book, now);
    const hash = shipSourceHash(kind, read.rows);
    const sourceLabel = label || 'Ship';
    if (op.op === 'import.dry_run') {
      return { ok: true, op: { op: 'import.dry_run', payload: { kind, source_hash: hash, source_label: sourceLabel, summary: planned.summary } } };
    }
    return {
      ok: true,
      op: { op: 'import.commit', payload: { kind, source_hash: hash, source_label: sourceLabel, summary: planned.summary, plans: planned.rows } },
    };
  }
  if (kind === 'vehicles_csv' || kind === 'drivers_csv' || kind === 'compliance_csv') {
    const csv = typeof op.payload.csv === 'string' ? op.payload.csv : '';
    if (!csv.trim()) return { ok: false, status: 400, error: 'Run a dry run first.' };
    const parsed =
      kind === 'drivers_csv' ? validateDriverCsv(csv, book, now) : kind === 'compliance_csv' ? validateComplianceCsv(csv, book, now) : validateVehicleCsv(csv, book, now);
    const sourceLabel = label || 'Pasted CSV';
    if (op.op === 'import.dry_run') {
      return {
        ok: true,
        op: { op: 'import.dry_run', payload: { kind, source_hash: parsed.source_hash, source_label: sourceLabel, summary: parsed.summary, csv } },
      };
    }
    return {
      ok: true,
      op: {
        op: 'import.commit',
        payload: { kind, source_hash: parsed.source_hash, source_label: sourceLabel, summary: parsed.summary, csv, plans: parsed.rows },
      },
    };
  }
  return { ok: false, status: 400, error: 'That import is not available.' };
}
