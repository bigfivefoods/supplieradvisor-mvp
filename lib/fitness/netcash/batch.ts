import { sha256Hex } from '@/lib/fitness/netcash/crypto';
import type { BillingLine, Mandate } from '@/lib/fitness/netcash/types';

/**
 * Standard Netcash debit-order NIWS file.
 * Checked against https://api.netcash.co.za/inbound-payments/debit-orders/
 * on 29 Oct 2026. Instruction is TwoDay (dated debit orders), not DebiCheck.
 *
 * H  service key, version 1, instruction, batch name, action date CCYYMMDD, vendor key
 * K  field ids in ascending order
 * T  one row per field id
 * F  transaction count, sum of amount fields in cents, 9999
 *
 * TwoDay key: 101 reference, 102 account name, 131 bank detail type,
 * 132 account holder, 133 account type, 134 branch, 135 filler 0,
 * 136 account number, 162 amount in cents, 301 member id, 302 invoice.
 * Masterfile Update key uses 161 (default amount) instead of 162.
 *
 * The file contains the service key and account numbers. Seal it before storage.
 * Account type: 1 current/cheque, 2 savings, 3 transmission.
 */

export const NETCASH_PUBLIC_VENDOR_KEY = '24ade73c-98cf-47b3-99be-cc7b867b3080';

const TWO_DAY_KEYS = ['101', '102', '131', '132', '133', '134', '135', '136', '162', '301', '302'] as const;
const MASTERFILE_KEYS = ['101', '102', '131', '132', '133', '134', '135', '136', '161'] as const;

const ACCOUNT_TYPE_CODE: Record<string, string> = {
  cheque: '1',
  current: '1',
  savings: '2',
  transmission: '3',
};

export type BatchRow = {
  netcashRef: string;
  accountName: string;
  accountHolder: string;
  accountType: string;
  branchCode: string;
  accountNumber: string;
  amountCents: number;
  memberId: string;
  invoiceNumber: string;
};

export function vendorKey(): string {
  const override = String(process.env.GYM_NETCASH_VENDOR_KEY || '').trim();
  return override || NETCASH_PUBLIC_VENDOR_KEY;
}

export function buildDebitBatchFile(input: {
  serviceKey: string;
  actionDate: string;
  batchName: string;
  rows: BatchRow[];
  vendorKey?: string;
}): { body: string; sha256: string; count: number; totalCents: number } {
  const total = input.rows.reduce((sum, row) => sum + row.amountCents, 0);
  const lines = [
    header(input.serviceKey, 'TwoDay', input.batchName, input.actionDate, input.vendorKey),
    `K\t${TWO_DAY_KEYS.join('\t')}`,
  ];
  for (const row of input.rows) {
    lines.push(
      [
        'T',
        niwsText(row.netcashRef, 22),
        niwsText(row.accountName || row.accountHolder, 50),
        '1',
        niwsText(row.accountHolder, 50),
        ACCOUNT_TYPE_CODE[row.accountType] || '1',
        digits(row.branchCode).slice(0, 6),
        '0',
        accountNumber(row.accountNumber),
        String(row.amountCents),
        niwsText(row.memberId, 50),
        niwsText(row.invoiceNumber, 50),
      ].join('\t')
    );
  }
  lines.push(`F\t${input.rows.length}\t${total}\t9999`);
  const body = `${lines.join('\n')}\n`;
  return { body, sha256: sha256Hex(body), count: input.rows.length, totalCents: total };
}

export function buildMasterfile(input: {
  serviceKey: string;
  batchName: string;
  actionDate: string;
  mandates: Array<
    Pick<Mandate, 'netcashRef' | 'accountHolder' | 'accountType' | 'branchCode' | 'memberName' | 'amountCents'> & {
      accountNumber: string;
    }
  >;
  vendorKey?: string;
}): { body: string; sha256: string; count: number } {
  const total = input.mandates.reduce((sum, row) => sum + row.amountCents, 0);
  const lines = [
    header(input.serviceKey, 'Update', input.batchName, input.actionDate, input.vendorKey),
    `K\t${MASTERFILE_KEYS.join('\t')}`,
  ];
  for (const row of input.mandates) {
    lines.push(
      [
        'T',
        niwsText(row.netcashRef, 22),
        niwsText(row.memberName || row.accountHolder, 50),
        '1',
        niwsText(row.accountHolder, 30),
        ACCOUNT_TYPE_CODE[row.accountType] || '1',
        digits(row.branchCode).slice(0, 6),
        '0',
        accountNumber(row.accountNumber),
        String(row.amountCents),
      ].join('\t')
    );
  }
  lines.push(`F\t${input.mandates.length}\t${total}\t9999`);
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
    const account = mandate ? accounts.get(mandate.id) : '';
    if (!mandate || !account) continue;
    rows.push({
      netcashRef: mandate.netcashRef,
      accountName: line.memberName,
      accountHolder: mandate.accountHolder,
      accountType: mandate.accountType,
      branchCode: mandate.branchCode,
      accountNumber: account,
      amountCents: line.totalCents,
      memberId: line.memberId,
      invoiceNumber: line.invoiceNumber,
    });
  }
  return rows;
}

function header(serviceKey: string, instruction: string, batchName: string, actionDate: string, vendor?: string): string {
  const action = actionDate.replace(/-/g, '');
  return ['H', serviceKey.trim(), '1', instruction, niwsText(batchName, 50), action, vendor || vendorKey()].join('\t');
}

function accountNumber(value: string): string {
  const account = digits(value);
  if (account.length < 4 || account.length > 11) {
    throw new Error('Netcash account numbers are 4 to 11 digits.');
  }
  return account;
}

function digits(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

/** Netcash keeps A–Z, digits, and a short punctuation set. Other characters are dropped. */
export function niwsText(value: string, max: number): string {
  return String(value || '')
    .replace(/[^A-Za-z0-9 ._():/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
