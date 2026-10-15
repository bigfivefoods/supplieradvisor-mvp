/**
 * FleetAdvisor® CSV. A small in-repo parser and a formula-safe writer.
 * No new dependency.
 */
import { findIdentityKey } from './validation';

export const MAX_CSV_BYTES = 1_048_576;
export const MAX_CSV_ROWS = 500;
export const MAX_CSV_FIELD = 500;

const FORMULA_LEAD = new Set(['=', '+', '-', '@', '\t', '\r']);

const HEADER_BLOCK = new Set([
  'id_number',
  'id_no',
  'identity_number',
  'sa_id',
  'said',
  'passport',
  'passport_no',
  'passport_number',
  'licence_no',
  'licence_number',
  'license_no',
  'license_number',
  'drivers_licence_no',
  'driver_licence_no',
  'driver_licence_number',
  'national_id',
]);

export type CsvRecord = { row: number; cells: string[] };

export type CsvTable = {
  delimiter: ',' | ';';
  headers: string[];
  records: CsvRecord[];
};

export type CsvError = { row: number; code: string; field: string };

export function decodeUtf8(bytes: Uint8Array): { ok: true; text: string } | { ok: false; code: 'utf8' } {
  if (bytes.byteLength > MAX_CSV_BYTES) return { ok: false, code: 'utf8' };
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { ok: true, text };
  } catch {
    return { ok: false, code: 'utf8' };
  }
}

export function guardFormula(value: string): string {
  if (!value) return value;
  return FORMULA_LEAD.has(value[0]) ? `'${value}` : value;
}

export function writeCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map((cell) => quoteCell(guardFormula(cell ?? ''))).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

function quoteCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function parseCsv(text: string): { ok: true; table: CsvTable } | { ok: false; errors: CsvError[] } {
  if (new TextEncoder().encode(text).byteLength > MAX_CSV_BYTES) {
    return { ok: false, errors: [{ row: 0, code: 'too_large', field: '' }] };
  }
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (!source.trim()) return { ok: false, errors: [{ row: 0, code: 'empty', field: '' }] };
  const delimiter = sniffDelimiter(source);
  const header = readRecord(source, 0, delimiter);
  if (!header) return { ok: false, errors: [{ row: 0, code: 'empty', field: '' }] };
  const headers = header.cells.map((cell) => cell.trim());
  const blocked = headers.find((headerName) => HEADER_BLOCK.has(headerName.toLowerCase()) || findIdentityKey({ [headerName]: 1 }));
  if (blocked) {
    return { ok: false, errors: [{ row: 1, code: 'forbidden_header', field: blocked.trim().toLowerCase() }] };
  }
  const records: CsvRecord[] = [];
  let cursor = header.next;
  let row = 1;
  while (cursor < source.length) {
    if (source[cursor] === '\n') {
      cursor += 1;
      continue;
    }
    if (source[cursor] === '\r') {
      cursor += 1;
      continue;
    }
    const record = readRecord(source, cursor, delimiter);
    if (!record) break;
    row += 1;
    if (row - 1 > MAX_CSV_ROWS) return { ok: false, errors: [{ row, code: 'too_many_rows', field: '' }] };
    const long = record.cells.findIndex((cell) => cell.length > MAX_CSV_FIELD);
    if (long >= 0) return { ok: false, errors: [{ row, code: 'field_too_long', field: headers[long] || `column_${long + 1}` }] };
    records.push({ row, cells: record.cells });
    cursor = record.next;
  }
  return { ok: true, table: { delimiter, headers, records } };
}

export function headerIndex(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((header, index) => {
    const key = header.trim().toLowerCase();
    if (key && !map.has(key)) map.set(key, index);
  });
  return map;
}

export function cell(record: CsvRecord, index: number | undefined): string {
  if (index == null || index < 0) return '';
  return (record.cells[index] ?? '').trim();
}

function sniffDelimiter(source: string): ',' | ';' {
  const line = firstPhysicalLine(source);
  const commas = countOutsideQuotes(line, ',');
  const semis = countOutsideQuotes(line, ';');
  return semis > commas ? ';' : ',';
}

function firstPhysicalLine(source: string): string {
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        i += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (!quoted && (char === '\n' || char === '\r')) return source.slice(0, i);
  }
  return source;
}

function countOutsideQuotes(line: string, needle: string): number {
  let count = 0;
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        i += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === needle) count += 1;
  }
  return count;
}

function readRecord(source: string, start: number, delimiter: ',' | ';'): { cells: string[]; next: number } | null {
  if (start >= source.length) return null;
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  let i = start;
  while (i < source.length) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      current += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (char === delimiter) {
      cells.push(current);
      current = '';
      i += 1;
      continue;
    }
    if (char === '\n' || char === '\r') {
      cells.push(current);
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      return { cells, next: i + 1 };
    }
    current += char;
    i += 1;
  }
  cells.push(current);
  return { cells, next: i };
}

export function isoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
