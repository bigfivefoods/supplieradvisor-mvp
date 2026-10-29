import { centsToRands } from '@/lib/fitness/netcash/money';
import type { BillingLine, NetcashSettings } from '@/lib/fitness/netcash/types';

export type JournalLinePlan = {
  accountCode: string;
  debit: number;
  credit: number;
  memo: string;
};

/** Balanced journal the finance module should post. Amounts are rands. */
export function issueJournal(line: BillingLine, settings: NetcashSettings): JournalLinePlan[] {
  const total = centsToRands(line.totalCents);
  const vat = centsToRands(line.vatCents);
  const net = round2(total - vat);
  const feeShare = line.totalCents > 0 ? line.feeCents / line.totalCents : 0;
  const feeNet = round2(net * feeShare);
  const revenue = round2(net - feeNet);
  const lines: JournalLinePlan[] = [
    { accountCode: settings.glArCode, debit: total, credit: 0, memo: `Debit order ${line.invoiceNumber || line.memberName}` },
    { accountCode: settings.glRevenueCode, debit: 0, credit: revenue, memo: line.description },
  ];
  if (feeNet > 0) {
    lines.push({ accountCode: settings.glFeeCode, debit: 0, credit: feeNet, memo: 'Failed debit fee' });
  }
  if (vat > 0) {
    lines.push({ accountCode: settings.glVatCode, debit: 0, credit: vat, memo: 'VAT output' });
  }
  return balance(lines);
}

export function settlementJournal(line: BillingLine, settings: NetcashSettings): JournalLinePlan[] {
  const total = centsToRands(line.totalCents);
  return [
    { accountCode: settings.glBankCode, debit: total, credit: 0, memo: `Netcash ${line.invoiceNumber}` },
    { accountCode: settings.glArCode, debit: 0, credit: total, memo: `Receipt ${line.memberName}` },
  ];
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function balance(lines: JournalLinePlan[]): JournalLinePlan[] {
  const debit = round2(lines.reduce((sum, line) => sum + line.debit, 0));
  const credit = round2(lines.reduce((sum, line) => sum + line.credit, 0));
  const gap = round2(debit - credit);
  if (gap !== 0 && lines[1]) {
    lines[1] = { ...lines[1], credit: round2(lines[1].credit + gap) };
  }
  return lines;
}
