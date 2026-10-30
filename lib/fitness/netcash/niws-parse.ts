import type { BatchLineResult } from '@/lib/fitness/netcash/types';

const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export type LoadReport = { result: 'SUCCESSFUL' | 'SUCCESSFUL WITH ERRORS' | 'UNSUCCESSFUL' | 'UNKNOWN'; errors: string[] };

export function parseLoadReport(body: string): LoadReport {
  const first = body.split(/\r?\n/).find((line) => line.startsWith('###BEGIN')) || '';
  const result = first.includes('SUCCESSFUL WITH ERRORS')
    ? 'SUCCESSFUL WITH ERRORS'
    : first.includes('UNSUCCESSFUL')
      ? 'UNSUCCESSFUL'
      : first.includes('SUCCESSFUL')
        ? 'SUCCESSFUL'
        : 'UNKNOWN';
  const errors = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('###'));
  return { result, errors };
}

export type StatementLine = {
  date: string;
  type: string;
  id: string;
  description: string;
  amountRands: string;
  symbol: string;
  extra1: string;
  extra2: string;
  extra3: string;
};

export function parseStatement(body: string): StatementLine[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.split('\t'))
    .filter((cells) => cells.length >= 6 && /^\d{8}$/.test(cells[0] || ''))
    .map((cells) => ({
      date: cells[0] || '',
      type: cells[1] || '',
      id: cells[2] || '',
      description: cells[3] || '',
      amountRands: cells[4] || '',
      symbol: cells[5] || '',
      extra1: cells[7] || '',
      extra2: cells[8] || '',
      extra3: cells[9] || '',
    }));
}

export function statementToResults(
  lines: StatementLine[],
  expected: Array<{ netcashRef: string; memberId: string; invoiceNumber: string }>
): BatchLineResult[] {
  const results: BatchLineResult[] = [];
  for (const item of expected) {
    const hit = lines.find((line) => matches(line, item));
    if (!hit) continue;
    if (hit.type === 'DRU' || hit.type === 'DCU') {
      results.push({ netcashRef: item.netcashRef, outcome: 'unpaid', reasonCode: reasonFrom(hit.description) });
    } else if (hit.type === 'TDD' || hit.type === 'SDD') {
      results.push({ netcashRef: item.netcashRef, outcome: 'paid', reasonCode: '00' });
    }
  }
  return results;
}

export function batchGuidForName(report: string, batchName: string): string | null {
  const wanted = batchName.trim().toLowerCase();
  for (const line of report.split(/\r?\n/)) {
    const cells = line.split('\t').map((cell) => cell.trim());
    const guid = cells.find((cell) => GUID.test(cell));
    if (!guid) continue;
    if (cells.some((cell) => cell.toLowerCase() === wanted) || line.toLowerCase().includes(wanted)) return guid;
  }
  return null;
}

export function validationMeaning(code: string): { status: 'valid' | 'invalid' | 'error'; message: string } {
  if (code === '0') return { status: 'valid', message: 'Netcash accepted the branch, account type, and account number.' };
  if (code === '1') return { status: 'invalid', message: 'Netcash rejected the branch code.' };
  if (code === '2') return { status: 'invalid', message: 'Netcash rejected the account number check digit.' };
  if (code === '3') return { status: 'invalid', message: 'Netcash rejected the account type.' };
  if (code === '4') return { status: 'invalid', message: 'Netcash rejected the account details.' };
  return { status: 'error', message: code === '100' ? 'Netcash rejected the account service key.' : 'Netcash could not validate the account.' };
}

function matches(line: StatementLine, item: { netcashRef: string; memberId: string; invoiceNumber: string }): boolean {
  const blob = [line.extra1, line.extra2, line.extra3, line.description].join(' ').toLowerCase();
  return [item.netcashRef, item.memberId, item.invoiceNumber].filter(Boolean).some((token) => blob.includes(token.toLowerCase()));
}

function reasonFrom(description: string): string {
  const code = description.match(/Code:(\d{2})/i);
  return code ? code[1] : '99';
}
