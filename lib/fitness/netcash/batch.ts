import { sha256Hex } from '@/lib/fitness/netcash/crypto';
import type { BillingLine, Mandate } from '@/lib/fitness/netcash/types';

/**
 * Netcash NIWS debit-order load file (tab-separated).
 * H  service key, version, action date
 * T  reference, account name, account type, branch, account, cents, member, invoice, extra
 * F  count, total cents
 *
 * The file contains the service key and account numbers. Callers must seal it
 * before it is stored and must not return it to the browser.
 * Account type: 1 current/cheque, 2 savings, 3 transmission.
 */

const ACCOUNT_TYPE_CODE: Record<string, string> = {
  cheque: '1',
  current: '1',
  savings: '2',
  transmission: '3',
};

export type BatchRow = {
  netcashRef: string;
  accountHolder: string;
  accountType: string;
  branchCode: string;
  accountNumber: string;
  amountCents: number;
  memberId: string;
  invoiceNumber: string;
};

export function buildDebitBatchFile(input: {
  serviceKey: string;
  actionDate: string;
  rows: BatchRow[];
}): { body: string; sha256: string; count: number; totalCents: number } {
  const action = input.actionDate.replace(/-/g, '');
  const lines = [`H\t${input.serviceKey}\t1\t${action}`];
  let total = 0;
  for (const row of input.rows) {
    total += row.amountCents;
    const cells = [
      'T',
      sanitize(row.netcashRef, 22),
      sanitize(row.accountHolder, 50),
      ACCOUNT_TYPE_CODE[row.accountType] || '1',
      row.branchCode,
      row.accountNumber,
      String(row.amountCents),
      sanitize(row.memberId, 22),
      sanitize(row.invoiceNumber, 22),
      '',
    ];
    lines.push(cells.join('\t'));
  }
  lines.push(`F\t${input.rows.length}\t${total}`);
  const body = `${lines.join('\n')}\n`;
  return { body, sha256: sha256Hex(body), count: input.rows.length, totalCents: total };
}

export function buildMasterfile(input: {
  serviceKey: string;
  mandates: Array<Pick<Mandate, 'netcashRef' | 'accountHolder' | 'accountType' | 'branchCode' | 'memberId'> & { accountNumber: string }>;
}): { body: string; sha256: string; count: number } {
  const lines = [`H\t${input.serviceKey}\tMASTER\t1`];
  for (const row of input.mandates) {
    lines.push(
      [
        'M',
        sanitize(row.netcashRef, 22),
        sanitize(row.accountHolder, 50),
        ACCOUNT_TYPE_CODE[row.accountType] || '1',
        row.branchCode,
        row.accountNumber,
        sanitize(row.memberId, 22),
      ].join('\t')
    );
  }
  lines.push(`F\t${input.mandates.length}`);
  const body = `${lines.join('\n')}\n`;
  return { body, sha256: sha256Hex(body), count: input.mandates.length };
}

export function batchRowsFromLines(
  lines: BillingLine[],
  mandates: Mandate[],
  accounts: Map<string, string>
): BatchRow[] {
  const byId = new Map(mandates.map((mandate) => [mandate.id, mandate]));
  const rows: BatchRow[] = [];
  for (const line of lines) {
    if (line.collectionStatus !== 'scheduled' || !line.mandateId || line.totalCents <= 0) continue;
    const mandate = byId.get(line.mandateId);
    const accountNumber = mandate ? accounts.get(mandate.id) : '';
    if (!mandate || !accountNumber) continue;
    rows.push({
      netcashRef: mandate.netcashRef,
      accountHolder: mandate.accountHolder,
      accountType: mandate.accountType,
      branchCode: mandate.branchCode,
      accountNumber,
      amountCents: line.totalCents,
      memberId: line.memberId,
      invoiceNumber: line.invoiceNumber,
    });
  }
  return rows;
}

function sanitize(value: string, max: number): string {
  return String(value || '')
    .replace(/[\t\r\n]/g, ' ')
    .trim()
    .slice(0, max);
}
