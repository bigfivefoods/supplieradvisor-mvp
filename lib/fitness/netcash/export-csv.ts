import { centsToRands } from '@/lib/fitness/netcash/money';
import type { BillingLine, BillingRun } from '@/lib/fitness/netcash/types';

function cell(value: unknown): string {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function collectionsCsv(runs: BillingRun[], lines: BillingLine[]): string {
  const runById = new Map(runs.map((run) => [run.id, run]));
  const header = [
    'Run',
    'Action date',
    'Member',
    'Invoice',
    'Description',
    'Net',
    'VAT',
    'Total',
    'Status',
    'Reason code',
    'Reason',
    'Attempt',
  ];
  const rows = lines.map((line) => {
    const run = runById.get(line.runId);
    return [
      run?.periodKey || line.runId,
      run?.actionDate || '',
      line.memberName,
      line.invoiceNumber,
      line.description,
      centsToRands(line.netCents).toFixed(2),
      centsToRands(line.vatCents).toFixed(2),
      centsToRands(line.totalCents).toFixed(2),
      line.collectionStatus,
      line.netcashReasonCode,
      line.netcashReasonText,
      String(line.attempt),
    ].map(cell);
  });
  return [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function statementRows(lines: BillingLine[]): BillingLine[] {
  return [...lines].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.invoiceNumber.localeCompare(b.invoiceNumber));
}
