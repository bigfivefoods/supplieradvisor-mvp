/**
 * IAS 1 statement presentation: named AR/AP leaves stay on the ledger
 * and roll into one Trade receivables / Trade payables face line.
 */
import { round2 } from '@/lib/accounting/server';
import { isHyphenSubAccountCode } from '@/lib/accounting/party-gl-accounts';

export type RollupAccount = {
  id?: number;
  code: string;
  name: string;
  account_type: string;
  subtype?: string | null;
  is_header?: boolean | null;
};

export function isEclAllowanceAccount(a: RollupAccount): boolean {
  return String(a.code || '') === '1135';
}

/** Integer trade AR (1181+) — not 1130 and not a hyphen member leaf. */
export function isTradeArIntegerCode(code: string): boolean {
  const c = String(code || '').trim();
  if (!/^\d+$/.test(c)) return false;
  const n = Number(c);
  return n >= 1181 && n < 2000;
}

export function isLegacyApIntegerCode(code: string): boolean {
  const c = String(code || '').trim();
  if (!/^\d+$/.test(c)) return false;
  const n = Number(c);
  return n >= 2181 && n < 3000;
}

export function rollsIntoTradeReceivables(a: RollupAccount): boolean {
  const code = String(a.code || '');
  const type = String(a.account_type || '').toLowerCase();
  const sub = String(a.subtype || '').toLowerCase();
  if (isEclAllowanceAccount(a)) return true;
  if (type !== 'asset') return false;
  if (code === '1130' || code === '1180') return true;
  if (code.startsWith('1180-') || code.startsWith('4400-')) return true;
  if (isTradeArIntegerCode(code)) return true;
  if (sub === 'receivable') return true;
  if (isHyphenSubAccountCode(code) && sub !== 'bank' && sub !== 'cash' && sub !== 'inventory') {
    return type === 'asset' && sub !== 'tax';
  }
  return false;
}

export function rollsIntoTradePayables(a: RollupAccount): boolean {
  const code = String(a.code || '');
  const type = String(a.account_type || '').toLowerCase();
  const sub = String(a.subtype || '').toLowerCase();
  if (type !== 'liability') return false;
  if (code === '2110' || code === '2180') return true;
  if (code.startsWith('2180-')) return true;
  if (isLegacyApIntegerCode(code)) return true;
  if (sub === 'payable') return true;
  if (isHyphenSubAccountCode(code) && sub !== 'tax') return type === 'liability';
  return false;
}

export type FaceAmount = { current: number; prior: number };

export type TradeRollupResult = {
  face: {
    code: string;
    name: string;
    current: number;
    prior: number;
    bold?: boolean;
    indent?: boolean;
    note?: string;
  };
  detail: Array<{
    code: string;
    name: string;
    current: number;
    prior: number;
    indent?: boolean;
    bold?: boolean;
  }>;
};

function signedAsset(debit: number, credit: number): number {
  return round2(debit - credit);
}

function signedLiability(debit: number, credit: number): number {
  return round2(credit - debit);
}

export function rollTradeReceivables(opts: {
  accounts: RollupAccount[];
  currentOf: (id: number) => { debit: number; credit: number };
  priorOf: (id: number) => { debit: number; credit: number };
}): TradeRollupResult {
  const detail: TradeRollupResult['detail'] = [];
  let grossCur = 0;
  let grossPrior = 0;
  let eclCur = 0;
  let eclPrior = 0;
  for (const a of opts.accounts) {
    if (!rollsIntoTradeReceivables(a) || !a.id) continue;
    const cur = opts.currentOf(Number(a.id));
    const prior = opts.priorOf(Number(a.id));
    const current = signedAsset(cur.debit, cur.credit);
    const priorAmt = signedAsset(prior.debit, prior.credit);
    if (Math.abs(current) < 0.005 && Math.abs(priorAmt) < 0.005) continue;
    if (isEclAllowanceAccount(a)) {
      eclCur += current;
      eclPrior += priorAmt;
      detail.push({
        code: a.code,
        name: a.name,
        current,
        prior: priorAmt,
        indent: true,
      });
      continue;
    }
    grossCur += current;
    grossPrior += priorAmt;
    detail.push({
      code: a.code,
      name: a.name,
      current,
      prior: priorAmt,
      indent: true,
    });
  }
  const netCur = round2(grossCur + eclCur);
  const netPrior = round2(grossPrior + eclPrior);
  if (Math.abs(eclCur) >= 0.005 || Math.abs(eclPrior) >= 0.005) {
    detail.push({
      code: '',
      name: 'Net trade and other receivables',
      current: netCur,
      prior: netPrior,
      bold: true,
    });
  }
  return {
    face: {
      code: '1130',
      name: 'Trade and other receivables',
      current: netCur,
      prior: netPrior,
      indent: true,
      note: '6',
    },
    detail,
  };
}

export function rollTradePayables(opts: {
  accounts: RollupAccount[];
  currentOf: (id: number) => { debit: number; credit: number };
  priorOf: (id: number) => { debit: number; credit: number };
}): TradeRollupResult {
  const detail: TradeRollupResult['detail'] = [];
  let curTot = 0;
  let priorTot = 0;
  for (const a of opts.accounts) {
    if (!rollsIntoTradePayables(a) || !a.id) continue;
    const cur = opts.currentOf(Number(a.id));
    const prior = opts.priorOf(Number(a.id));
    const current = signedLiability(cur.debit, cur.credit);
    const priorAmt = signedLiability(prior.debit, prior.credit);
    if (Math.abs(current) < 0.005 && Math.abs(priorAmt) < 0.005) continue;
    curTot += current;
    priorTot += priorAmt;
    detail.push({
      code: a.code,
      name: a.name,
      current,
      prior: priorAmt,
      indent: true,
    });
  }
  return {
    face: {
      code: '2110',
      name: 'Trade and other payables',
      current: round2(curTot),
      prior: round2(priorTot),
      indent: true,
      note: '8',
    },
    detail,
  };
}

export type BsCollapseRow = {
  id: number;
  code: string;
  name: string;
  account_type: string;
  subtype?: string | null;
  section: string;
  section_label?: string;
  amount: number;
};

/** Collapse party leaves into one face line per AR/AP for statement UIs. */
export function collapseBsStatementRows(rows: BsCollapseRow[]): BsCollapseRow[] {
  const ar: BsCollapseRow[] = [];
  const ap: BsCollapseRow[] = [];
  const rest: BsCollapseRow[] = [];
  for (const r of rows) {
    if (rollsIntoTradeReceivables(r) && r.section === 'current_assets') {
      ar.push(r);
    } else if (rollsIntoTradePayables(r) && r.section === 'current_liabilities') {
      ap.push(r);
    } else {
      rest.push(r);
    }
  }
  const out = [...rest];
  if (ar.length) {
    const amount = round2(ar.reduce((s, r) => s + r.amount, 0));
    if (Math.abs(amount) >= 0.005) {
      out.push({
        id: -1130,
        code: '1130',
        name: 'Trade and other receivables',
        account_type: 'asset',
        subtype: 'receivable',
        section: 'current_assets',
        section_label: 'Current assets',
        amount,
      });
    }
  }
  if (ap.length) {
    const amount = round2(ap.reduce((s, r) => s + r.amount, 0));
    if (Math.abs(amount) >= 0.005) {
      out.push({
        id: -2110,
        code: '2110',
        name: 'Trade and other payables',
        account_type: 'liability',
        subtype: 'payable',
        section: 'current_liabilities',
        section_label: 'Current liabilities',
        amount,
      });
    }
  }
  out.sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
  return out;
}
