/**
 * Chart of accounts workbook for the period selected on the CoA screen.
 */
import type * as XLSXType from 'xlsx';
import { GAAP_DISCLAIMER_PDF_FOOTER } from '@/lib/accounting/gaap-disclaimer';
import { accountTypeLabel } from '@/lib/accounting/types';
import { round2 } from '@/lib/accounting/server';
import {
  rollupCoaByType,
  type CoaSliceAccount,
} from '@/lib/accounting/coa-slice';

export const COA_XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const ACCOUNT_HEADERS = [
  'Code',
  'Name',
  'Type',
  'Subtype',
  'Parent code',
  'Normal balance',
  'Header',
  'System',
  'Active',
  'Tax code',
  'Description',
  'Opening balance',
  'Period debit',
  'Period credit',
  'Period movement',
  'Closing balance',
] as const;

const TYPE_HEADERS = [
  'Type',
  'Accounts',
  'Opening balance',
  'Period debit',
  'Period credit',
  'Period movement',
  'Closing balance',
] as const;

function loadXlsx(): typeof XLSXType {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('xlsx') as typeof XLSXType;
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

export function coaExportFilename(
  from: string | null,
  to: string | null
): string {
  if (from && to) return `chart-of-accounts-${from}-to-${to}.xlsx`;
  return 'chart-of-accounts-all-posted.xlsx';
}

export type CoaWorkbookInput = {
  companyName: string;
  periodLabel: string;
  from: string | null;
  to: string | null;
  typeFilter?: string | null;
  search?: string | null;
  warning?: string | null;
  generatedAt?: string;
  rows: CoaSliceAccount[];
};

function filterLabel(input: CoaWorkbookInput): string {
  const parts: string[] = [];
  if (input.typeFilter && input.typeFilter !== 'all') {
    parts.push(accountTypeLabel(input.typeFilter));
  }
  const q = String(input.search || '').trim();
  if (q) parts.push(`search "${q}"`);
  return parts.length ? parts.join(' · ') : 'All accounts';
}

function accountRow(row: CoaSliceAccount): Array<string | number> {
  return [
    row.code || '',
    row.name || '',
    accountTypeLabel(String(row.account_type || '')),
    row.subtype || '',
    row.parent_code || '',
    row.normal_balance || '',
    yesNo(!!row.is_header),
    yesNo(!!row.is_system),
    yesNo(row.is_active !== false),
    row.tax_code || '',
    row.description || '',
    row.opening_balance,
    row.period_debit,
    row.period_credit,
    row.period_movement,
    row.balance,
  ];
}

function applyNumberFormat(
  XLSX: typeof XLSXType,
  sheet: XLSXType.WorkSheet,
  columns: number[],
  firstDataRow: number,
  lastDataRow: number
) {
  for (let r = firstDataRow; r <= lastDataRow; r++) {
    for (const c of columns) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      if (cell && cell.t === 'n') cell.z = '#,##0.00';
    }
  }
}

export function buildCoaWorkbook(input: CoaWorkbookInput): Uint8Array {
  const XLSX = loadXlsx();
  const posting = input.rows.filter((row) => !row.is_header);
  const periodDebit = round2(posting.reduce((sum, row) => sum + row.period_debit, 0));
  const periodCredit = round2(posting.reduce((sum, row) => sum + row.period_credit, 0));
  const generatedAt = input.generatedAt || new Date().toISOString();
  const range =
    input.from && input.to
      ? `${input.from} to ${input.to}`
      : 'All posted activity (no period limit)';

  const cover = XLSX.utils.aoa_to_sheet([
    ['Chart of accounts'],
    ['Company', input.companyName],
    [],
    ['Period', input.periodLabel || range],
    ['From', input.from || ''],
    ['To', input.to || ''],
    ['Range used', range],
    ['Filters', filterLabel(input)],
    ['Accounts in this file', input.rows.length],
    ['Posting accounts', posting.length],
    ['Period debits', periodDebit],
    ['Period credits', periodCredit],
    ['Generated', generatedAt],
    [],
    ['How to read the amounts'],
    [
      'Opening balance',
      'Posted activity before From, in the account’s normal sign. Blank From means opening is zero and the movement is all posted activity.',
    ],
    [
      'Period debit / credit',
      'Posted journal lines dated inside the range. These are the books’ debit and credit totals, not the normal-sign balance.',
    ],
    [
      'Period movement',
      'Change in the normal-sign balance over the range (closing minus opening).',
    ],
    [
      'Closing balance',
      'Balance at To. Assets, expenses, and cost of sales are positive when in debit. Liabilities, equity, and revenue are positive when in credit.',
    ],
    [
      'By type',
      'Header accounts are omitted. Opening, movement, and closing are summed only inside a type — do not add an asset closing to a revenue closing.',
    ],
    [
      'Slice and dice',
      'Use the filters on Chart of accounts and By type. The period itself is the range on this cover, chosen in Finance → Chart of accounts.',
    ],
    [],
    ['Basis', GAAP_DISCLAIMER_PDF_FOOTER],
    ['Warning', input.warning || ''],
  ]);
  cover['!cols'] = [{ wch: 28 }, { wch: 88 }];
  const debitCell = cover.B11;
  const creditCell = cover.B12;
  if (debitCell && debitCell.t === 'n') debitCell.z = '#,##0.00';
  if (creditCell && creditCell.t === 'n') creditCell.z = '#,##0.00';

  const accountSheet = XLSX.utils.aoa_to_sheet([
    [...ACCOUNT_HEADERS],
    ...input.rows.map(accountRow),
  ]);
  accountSheet['!cols'] = [
    { wch: 12 },
    { wch: 36 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 36 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
  ];
  const accountLast = Math.max(1, input.rows.length + 1);
  accountSheet['!autofilter'] = { ref: `A1:P${accountLast}` };
  applyNumberFormat(XLSX, accountSheet, [11, 12, 13, 14, 15], 1, accountLast - 1);

  const rollup = rollupCoaByType(input.rows);
  const typeRows = rollup.map((row) => [
    row.type_label,
    row.accounts,
    row.opening_balance,
    row.period_debit,
    row.period_credit,
    row.period_movement,
    row.closing_balance,
  ]);
  const typeSheet = XLSX.utils.aoa_to_sheet([[...TYPE_HEADERS], ...typeRows]);
  const typeLast = Math.max(1, rollup.length + 1);
  typeSheet['!autofilter'] = { ref: `A1:G${typeLast}` };
  const totalRow = typeLast + 2;
  XLSX.utils.sheet_add_aoa(
    typeSheet,
    [
      [],
      [
        'All posting accounts',
        posting.length,
        '',
        periodDebit,
        periodCredit,
        '',
        '',
      ],
    ],
    { origin: { r: typeLast, c: 0 } }
  );
  typeSheet['!cols'] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
  ];
  applyNumberFormat(XLSX, typeSheet, [2, 3, 4, 5, 6], 1, typeLast - 1);
  for (const col of [3, 4]) {
    const addr = XLSX.utils.encode_cell({ r: totalRow - 1, c: col });
    const cell = typeSheet[addr];
    if (cell && cell.t === 'n') cell.z = '#,##0.00';
  }

  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: 'Chart of accounts',
    Subject: input.periodLabel || range,
    CreatedDate: new Date(generatedAt),
  };
  XLSX.utils.book_append_sheet(wb, cover, 'Cover');
  XLSX.utils.book_append_sheet(wb, accountSheet, 'Chart of accounts');
  XLSX.utils.book_append_sheet(wb, typeSheet, 'By type');

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as
    | number[]
    | Uint8Array;
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}
