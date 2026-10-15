/**
 * FleetAdvisor® compliance centre. Counts come from the company's own rows.
 */
import { COMPLIANCE_LABELS, complianceStatus, type ComplianceState } from './compliance';
import { formatSastDate, sastDate } from './format';
import type { ComplianceKind, FleetBook, FleetCompliance, SubjectKind } from './types';

export type CentreFilter = {
  subject?: 'vehicle' | 'driver' | 'all';
  kind?: ComplianceKind | 'all';
  status?: ComplianceState | 'all';
  depot?: string;
  search?: string;
  windowDays?: number;
  permitsOnly?: boolean;
};

export type CentreRow = {
  id: string;
  synthetic: boolean;
  subjectKind: 'vehicle' | 'driver';
  subjectId: string;
  subjectLabel: string;
  depot: string;
  kind: ComplianceKind;
  kindLabel: string;
  reference: string;
  expiresOn: string | null;
  status: ComplianceState;
  statusLabel: string;
  itemId: string | null;
  historyCount: number;
};

export type CentreSummary = { expired: number; expiring: number; not_recorded: number; valid: number };

const PERMITS = new Set<ComplianceKind>(['cross_border_permit', 'abnormal_permit', 'other_permit']);

export function centreRows(book: FleetBook, today: string, filter: CentreFilter = {}): CentreRow[] {
  const day = sastDate(today) || today.slice(0, 10);
  const windowDays = filter.windowDays ?? book.workspace.expiring_window_days;
  const rows: CentreRow[] = [];
  for (const vehicle of book.vehicles.filter((row) => !row.archived_at)) {
    rows.push(
      ...rowsForSubject(book, 'vehicle', vehicle.id, vehicle.reg_no, vehicle.depot_label, book.workspace.expected_vehicle_kinds, day, windowDays)
    );
  }
  for (const driver of book.drivers.filter((row) => !row.archived_at)) {
    rows.push(
      ...rowsForSubject(book, 'driver', driver.id, driver.full_name, '', book.workspace.expected_driver_kinds, day, windowDays)
    );
  }
  const filtered = rows.filter((row) => matches(row, filter));
  filtered.sort(compareRows);
  return filtered.map(safeRow);
}

export function centreSummary(rows: CentreRow[]): CentreSummary {
  return {
    expired: rows.filter((row) => row.status === 'expired').length,
    expiring: rows.filter((row) => row.status === 'expiring').length,
    not_recorded: rows.filter((row) => row.status === 'no_date').length,
    valid: rows.filter((row) => row.status === 'valid').length,
  };
}

export function monthAgenda(rows: CentreRow[]): Array<{ month: string; dates: Array<{ date: string; rows: CentreRow[] }> }> {
  const dated = rows.filter((row) => row.expiresOn && sastDate(row.expiresOn));
  const byMonth = new Map<string, Map<string, CentreRow[]>>();
  for (const row of dated) {
    const date = sastDate(row.expiresOn) || '';
    const month = date.slice(0, 7);
    const dates = byMonth.get(month) || new Map<string, CentreRow[]>();
    const list = dates.get(date) || [];
    list.push(row);
    dates.set(date, list);
    byMonth.set(month, dates);
  }
  return [...byMonth.keys()].sort().map((month) => {
    const dates = byMonth.get(month)!;
    return {
      month,
      dates: [...dates.keys()].sort().map((date) => ({ date, rows: dates.get(date)! })),
    };
  });
}

export function exportRows(rows: CentreRow[], includeDrivers: boolean): { headers: string[]; rows: string[][] } {
  const headers = ['subject_kind', 'subject_ref', 'kind', 'status', 'expires_on', 'reference', 'depot'];
  const body = rows
    .filter((row) => includeDrivers || row.subjectKind === 'vehicle')
    .map((row) => [
      row.subjectKind,
      row.subjectLabel,
      row.kindLabel,
      row.statusLabel,
      row.expiresOn || '',
      row.reference,
      row.depot,
    ]);
  return { headers, rows: body };
}

function rowsForSubject(
  book: FleetBook,
  subjectKind: 'vehicle' | 'driver',
  subjectId: string,
  subjectLabel: string,
  depot: string,
  expected: ComplianceKind[],
  today: string,
  windowDays: number
): CentreRow[] {
  const items = book.compliance.filter((item) => item.subject_kind === subjectKind && item.subject_id === subjectId);
  const current = items.filter((item) => !item.archived_at);
  const rows = current.map((item) => toRow(item, subjectLabel, depot, today, windowDays, historyCount(items, item)));
  for (const kind of expected) {
    if (kind === 'operator_card') continue;
    if (current.some((item) => item.kind === kind)) continue;
    rows.push({
      id: `missing:${subjectKind}:${subjectId}:${kind}`,
      synthetic: true,
      subjectKind,
      subjectId,
      subjectLabel,
      depot,
      kind,
      kindLabel: COMPLIANCE_LABELS[kind],
      reference: '',
      expiresOn: null,
      status: 'no_date',
      statusLabel: 'Not recorded',
      itemId: null,
      historyCount: 0,
    });
  }
  return rows;
}

function toRow(item: FleetCompliance, subjectLabel: string, depot: string, today: string, windowDays: number, history: number): CentreRow {
  const status = complianceStatus(item.expires_on, today, windowDays);
  return {
    id: item.id,
    synthetic: false,
    subjectKind: item.subject_kind === 'driver' ? 'driver' : 'vehicle',
    subjectId: item.subject_id || '',
    subjectLabel,
    depot,
    kind: item.kind,
    kindLabel: COMPLIANCE_LABELS[item.kind],
    reference: item.reference || '',
    expiresOn: sastDate(item.expires_on),
    status,
    statusLabel: status === 'no_date' ? 'Not recorded' : status === 'expired' ? 'Expired' : status === 'expiring' ? 'Expiring' : 'Valid',
    itemId: item.id,
    historyCount: history,
  };
}

function historyCount(items: FleetCompliance[], current: FleetCompliance): number {
  let count = 0;
  let cursor = current.renewed_from_id;
  const byId = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    count += 1;
    cursor = byId.get(cursor)?.renewed_from_id || null;
  }
  return count;
}

function matches(row: CentreRow, filter: CentreFilter): boolean {
  if (filter.subject && filter.subject !== 'all' && row.subjectKind !== filter.subject) return false;
  if (filter.kind && filter.kind !== 'all' && row.kind !== filter.kind) return false;
  if (filter.status && filter.status !== 'all' && row.status !== filter.status) return false;
  if (filter.depot && row.depot !== filter.depot) return false;
  if (filter.permitsOnly && !PERMITS.has(row.kind)) return false;
  if (filter.search) {
    const needle = filter.search.trim().toLowerCase();
    const hay = `${row.subjectLabel} ${row.kindLabel} ${row.reference} ${row.depot}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

function compareRows(a: CentreRow, b: CentreRow): number {
  const rank: Record<ComplianceState, number> = { expired: 0, expiring: 1, no_date: 2, valid: 3 };
  const byStatus = rank[a.status] - rank[b.status];
  if (byStatus) return byStatus;
  const aDate = a.expiresOn || '9999-12-31';
  const bDate = b.expiresOn || '9999-12-31';
  if (aDate !== bDate) return aDate < bDate ? -1 : 1;
  return a.subjectLabel.localeCompare(b.subjectLabel);
}

function safeRow(row: CentreRow): CentreRow {
  return {
    ...row,
    subjectLabel: show(row.subjectLabel),
    kindLabel: show(row.kindLabel),
    reference: show(row.reference),
    depot: show(row.depot),
    statusLabel: show(row.statusLabel),
    expiresOn: row.expiresOn,
  };
}

function show(value: string): string {
  if (!value || value === 'undefined' || value === 'NaN' || value === '[object Object]') return '';
  return value;
}

export type CentreSubjectKind = SubjectKind;
