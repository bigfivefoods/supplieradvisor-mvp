import type { BillingLine, BillingRun } from '@/lib/fitness/netcash/types';

export type StatementEntry = {
  invoiceNumber: string;
  creditNoteNumber: string;
  description: string;
  totalCents: number;
  status: string;
  reason: string;
};

export type MonthStatement = {
  month: string;
  label: string;
  openingCents: number;
  invoicedCents: number;
  collectedCents: number;
  unpaidCents: number;
  creditCents: number;
  closingCents: number;
  entries: StatementEntry[];
};

/** One member only. Months are latest first. Balances roll forward. */
export function buildMemberStatements(
  memberId: string,
  lines: BillingLine[],
  runs: BillingRun[]
): MonthStatement[] {
  const mine = latestAttempt(lines.filter((line) => line.memberId === memberId));
  const runById = new Map(runs.map((run) => [run.id, run]));
  const byMonth = new Map<string, BillingLine[]>();
  for (const line of mine) {
    const month = monthKey(line, runById.get(line.runId));
    if (!month) continue;
    const bucket = byMonth.get(month) || [];
    bucket.push(line);
    byMonth.set(month, bucket);
  }
  let opening = 0;
  const built: MonthStatement[] = [];
  for (const month of [...byMonth.keys()].sort()) {
    let invoiced = 0;
    let collected = 0;
    let unpaid = 0;
    let credit = 0;
    const entries: StatementEntry[] = [];
    for (const line of byMonth.get(month) || []) {
      if (line.collectionStatus === 'skipped' && !line.invoiceNumber) continue;
      invoiced += line.totalCents;
      if (line.collectionStatus === 'paid') collected += line.totalCents;
      else if (line.collectionStatus === 'reversed' || line.creditNoteNumber) credit += line.totalCents;
      else if (line.collectionStatus === 'unpaid') unpaid += line.totalCents;
      entries.push({
        invoiceNumber: line.invoiceNumber,
        creditNoteNumber: line.creditNoteNumber,
        description: line.description,
        totalCents: line.totalCents,
        status: line.collectionStatus,
        reason: line.netcashReasonText || line.skipReason,
      });
    }
    const closing = opening + invoiced - collected - credit;
    built.push({
      month,
      label: monthLabel(month),
      openingCents: opening,
      invoicedCents: invoiced,
      collectedCents: collected,
      unpaidCents: unpaid,
      creditCents: credit,
      closingCents: closing,
      entries,
    });
    opening = closing;
  }
  return built.reverse();
}

export function statementShareText(input: { gymName: string; memberName: string; statement: MonthStatement }): string {
  return [
    `${input.gymName} · GymAdvisor® statement`,
    input.statement.label,
    input.memberName,
    `Opening ${cents(input.statement.openingCents)}`,
    `Invoices ${cents(input.statement.invoicedCents)}`,
    `Collected ${cents(input.statement.collectedCents)}`,
    `Unpaid ${cents(input.statement.unpaidCents)}`,
    `Credits ${cents(input.statement.creditCents)}`,
    `Closing ${cents(input.statement.closingCents)}`,
    'SupplierAdvisor®',
  ].join('\n');
}

function latestAttempt(lines: BillingLine[]): BillingLine[] {
  const map = new Map<string, BillingLine>();
  for (const line of lines) {
    const prev = map.get(line.runId);
    if (!prev || line.attempt >= prev.attempt) map.set(line.runId, line);
  }
  return [...map.values()];
}

function monthKey(line: BillingLine, run?: BillingRun): string {
  const raw = run?.periodKey || line.createdAt || '';
  const month = raw.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(month) ? month : '';
}

function monthLabel(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, mon - 1, 1))
  );
}

function cents(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  return `${sign}R ${(abs / 100).toFixed(2)}`;
}
