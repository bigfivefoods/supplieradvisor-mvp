/**
 * Chart of accounts sliced to a period.
 * Opening is posted activity before `from`. Period debit/credit are posted
 * lines inside the range. Closing is opening plus that movement, shown in
 * the account's normal sign (credit-normal accounts are positive in credit).
 */
import { round2 } from '@/lib/accounting/server';
import {
  naturalAmount,
  normalBalanceForType,
  type LedgerNormal,
} from '@/lib/accounting/general-ledger';
import type { AccountTotalRow } from '@/lib/accounting/account-totals';
import {
  accountTypeLabel,
  ACCOUNT_TYPES,
  type CoaAccount,
} from '@/lib/accounting/types';

export type CoaSliceAccount = CoaAccount & {
  parent_code: string | null;
  opening_balance: number;
  period_debit: number;
  period_credit: number;
  period_movement: number;
  /** Natural closing balance at period end. */
  balance: number;
};

export type CoaTypeRollup = {
  account_type: string;
  type_label: string;
  accounts: number;
  opening_balance: number;
  period_debit: number;
  period_credit: number;
  period_movement: number;
  closing_balance: number;
};

export function parseIsoDateParam(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return s;
}

export function resolveCoaNormal(account: Pick<CoaAccount, 'normal_balance' | 'account_type'>): LedgerNormal {
  const explicit = String(account.normal_balance || '').toLowerCase();
  if (explicit === 'credit' || explicit === 'debit') return explicit;
  return normalBalanceForType(String(account.account_type || ''));
}

function indexTotals(
  rows: AccountTotalRow[] | null | undefined
): Map<number, { debit: number; credit: number }> {
  const map = new Map<number, { debit: number; credit: number }>();
  for (const row of rows || []) {
    const id = Number(row.account_id);
    if (!Number.isFinite(id)) continue;
    const cur = map.get(id) || { debit: 0, credit: 0 };
    cur.debit += Number(row.debit || 0);
    cur.credit += Number(row.credit || 0);
    map.set(id, cur);
  }
  return map;
}

export function sliceCoaAccounts(opts: {
  accounts: CoaAccount[];
  opening?: AccountTotalRow[] | null;
  period?: AccountTotalRow[] | null;
}): CoaSliceAccount[] {
  const opening = indexTotals(opts.opening);
  const period = indexTotals(opts.period);
  const codeById = new Map<number, string>();
  for (const account of opts.accounts) {
    codeById.set(Number(account.id), String(account.code || ''));
  }

  return opts.accounts.map((account) => {
    const id = Number(account.id);
    const normal = resolveCoaNormal(account);
    const open = opening.get(id) || { debit: 0, credit: 0 };
    const move = period.get(id) || { debit: 0, credit: 0 };
    const openingSigned = round2(open.debit - open.credit);
    const closingSigned = round2(openingSigned + move.debit - move.credit);
    const openingBalance = naturalAmount(openingSigned, normal);
    const balance = naturalAmount(closingSigned, normal);
    const parentId = account.parent_id != null ? Number(account.parent_id) : NaN;
    return {
      ...account,
      normal_balance: normal,
      parent_code:
        Number.isFinite(parentId) && codeById.has(parentId)
          ? codeById.get(parentId) || null
          : null,
      opening_balance: openingBalance,
      period_debit: round2(move.debit),
      period_credit: round2(move.credit),
      period_movement: round2(balance - openingBalance),
      balance,
    };
  });
}

export function filterCoaAccounts<
  T extends {
    code?: string | null;
    name?: string | null;
    account_type?: string | null;
  },
>(
  rows: T[],
  opts?: { type?: string | null; q?: string | null }
): T[] {
  const type = opts?.type && opts.type !== 'all' ? opts.type : null;
  const q = String(opts?.q || '').trim().toLowerCase();
  if (!type && !q) return rows;
  return rows.filter((account) => {
    if (type && account.account_type !== type) return false;
    if (!q) return true;
    return (
      String(account.code || '').toLowerCase().includes(q) ||
      String(account.name || '').toLowerCase().includes(q) ||
      String(account.account_type || '').toLowerCase().includes(q)
    );
  });
}

export function rollupCoaByType(rows: CoaSliceAccount[]): CoaTypeRollup[] {
  const groups = new Map<string, CoaSliceAccount[]>();
  for (const row of rows) {
    if (row.is_header) continue;
    const key = String(row.account_type || 'other');
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  const known = new Set(ACCOUNT_TYPES.map((t) => t.value as string));
  const order = [
    ...ACCOUNT_TYPES.map((t) => t.value as string),
    ...[...groups.keys()].filter((key) => !known.has(key)).sort(),
  ];
  return order
    .filter((key) => groups.has(key))
    .map((key) => {
      const list = groups.get(key) || [];
      return {
        account_type: key,
        type_label: accountTypeLabel(key),
        accounts: list.length,
        opening_balance: round2(list.reduce((sum, row) => sum + row.opening_balance, 0)),
        period_debit: round2(list.reduce((sum, row) => sum + row.period_debit, 0)),
        period_credit: round2(list.reduce((sum, row) => sum + row.period_credit, 0)),
        period_movement: round2(list.reduce((sum, row) => sum + row.period_movement, 0)),
        closing_balance: round2(list.reduce((sum, row) => sum + row.balance, 0)),
      };
    });
}
