/**
 * IAS 7 statement of cash flows from posted bank/cash GL (direct method).
 * Cash inflows/outflows are classified from the opposite journal lines.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { round2 } from '@/lib/accounting/server';
import {
  fetchJournalLinesByEntryIds,
  fetchPostedJournals,
} from '@/lib/accounting/journal-query';


export type CashFlowClass = 'operating' | 'investing' | 'financing';

export type Ias7Line = {
  name: string;
  class: CashFlowClass;
  inflow: number;
  outflow: number;
  net: number;
};

export type Ias7CashFlow = {
  method: 'direct';
  from: string;
  to: string;
  operating: Ias7Line[];
  investing: Ias7Line[];
  financing: Ias7Line[];
  netOperating: number;
  netInvesting: number;
  netFinancing: number;
  netChange: number;
  openingCash: number;
  closingCash: number;
  impliedClose: number;
  reconciled: boolean;
  journalCount: number;
  warning?: string;
};

type Acct = {
  id: number;
  code: string;
  name: string;
  account_type: string;
  subtype?: string | null;
};

export function isCashAccount(a: {
  account_type?: string | null;
  subtype?: string | null;
  code?: string | null;
}): boolean {
  const s = String(a.subtype || '').toLowerCase();
  const c = String(a.code || '');
  return s === 'bank' || s === 'cash' || c === '1110' || c === '1120';
}

export function classifyGlForCashFlow(opts: {
  account_type: string;
  subtype?: string | null;
  code?: string | null;
  source?: string | null;
}): CashFlowClass {
  const src = String(opts.source || '');
  if (
    src.includes('fixed_asset') ||
    src === 'fixed_asset_disposal' ||
    src === 'fixed_asset_capitalization'
  ) {
    return 'investing';
  }
  const t = String(opts.account_type || '').toLowerCase();
  const s = String(opts.subtype || '').toLowerCase();
  const c = String(opts.code || '');
  if (
    t === 'asset' &&
    (s === 'fixed' ||
      c.startsWith('12') ||
      (s === 'contra_asset' && c.startsWith('12')))
  ) {
    return 'investing';
  }
  if (t === 'equity') return 'financing';
  if (t === 'liability' && (s === 'long_term' || c.startsWith('22'))) {
    return 'financing';
  }
  return 'operating';
}

function lineName(a: Acct, inflow: boolean): string {
  const n = a.name || a.code || 'Other';
  if (inflow) {
    if (a.account_type === 'revenue') return `Receipts from ${n.toLowerCase()}`;
    if (String(a.subtype) === 'receivable') return 'Receipts from customers';
    if (String(a.subtype) === 'fixed' || String(a.code).startsWith('12')) {
      return 'Proceeds from disposal of PPE';
    }
    if (a.account_type === 'equity') return `Proceeds from ${n.toLowerCase()}`;
    if (String(a.subtype) === 'long_term') return 'Proceeds from borrowings';
    return `Receipts — ${n}`;
  }
  if (a.account_type === 'expense' || a.account_type === 'cogs') {
    return `Payments for ${n.toLowerCase()}`;
  }
  if (String(a.subtype) === 'payable') return 'Payments to suppliers';
  if (String(a.subtype) === 'payroll') return 'Payments to employees';
  if (String(a.subtype) === 'tax') return 'Taxes paid';
  if (String(a.subtype) === 'fixed' || String(a.code).startsWith('12')) {
    return 'Acquisition of PPE / intangibles';
  }
  if (a.account_type === 'equity') return `Distributions — ${n.toLowerCase()}`;
  if (String(a.subtype) === 'long_term') return 'Repayment of borrowings';
  return `Payments — ${n}`;
}

export async function buildIas7CashFlow(opts: {
  profileId: number;
  from: string;
  to: string;
}): Promise<Ias7CashFlow> {
  const from = String(opts.from).slice(0, 10);
  const to = String(opts.to).slice(0, 10);
  const supabase = getSupabaseServer();

  const { data: accountsRaw } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type, subtype, is_header')
    .eq('profile_id', opts.profileId);
  const accounts: Acct[] = (accountsRaw || [])
    .filter((a) => !a.is_header)
    .map((a) => ({
      id: Number(a.id),
      code: String(a.code || ''),
      name: String(a.name || ''),
      account_type: String(a.account_type || ''),
      subtype: a.subtype || null,
    }));
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const cashIds = new Set(accounts.filter((a) => isCashAccount(a)).map((a) => a.id));

  const { rows: journals, warning } = await fetchPostedJournals({
    profileId: opts.profileId,
    to,
  });
  const jeById = new Map(journals.map((j) => [j.id, j]));
  const { lines: rawLines, warning: lineWarn } = await fetchJournalLinesByEntryIds(
    journals.map((j) => j.id),
    'journal_entry_id, account_id, debit, credit'
  );

  const linesByJe = new Map<number, Array<{ account_id: number; debit: number; credit: number }>>();
  for (const l of rawLines) {
    const jid = Number(l.journal_entry_id);
    const row = {
      account_id: Number(l.account_id),
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0),
    };
    const arr = linesByJe.get(jid) || [];
    arr.push(row);
    linesByJe.set(jid, arr);
  }

  const buckets = new Map<string, Ias7Line>();
  const add = (
    key: string,
    name: string,
    cls: CashFlowClass,
    inflow: number,
    outflow: number
  ) => {
    const cur = buckets.get(key) || {
      name,
      class: cls,
      inflow: 0,
      outflow: 0,
      net: 0,
    };
    cur.inflow += inflow;
    cur.outflow += outflow;
    cur.net = round2(cur.inflow - cur.outflow);
    buckets.set(key, cur);
  };

  let openingCash = 0;
  let closingCash = 0;
  let journalCount = 0;

  for (const je of journals) {
    const lines = linesByJe.get(je.id) || [];
    let cashDr = 0;
    let cashCr = 0;
    const other: Array<{ acct: Acct; debit: number; credit: number }> = [];
    for (const l of lines) {
      if (cashIds.has(l.account_id)) {
        cashDr += l.debit;
        cashCr += l.credit;
      } else {
        const acct = byId.get(l.account_id);
        if (acct) other.push({ acct, debit: l.debit, credit: l.credit });
      }
    }
    const netCash = round2(cashDr - cashCr);
    const date = je.entry_date;
    if (date < from) openingCash += netCash;
    if (date <= to) closingCash += netCash;

    if (date < from || date > to) continue;
    if (String(je.source || '') === 'year_end_close') continue;
    if (Math.abs(netCash) < 0.005) continue;
    journalCount += 1;

    const inflow = netCash > 0;
    const cashAmt = Math.abs(netCash);
    const opposite = other.filter((o) => (inflow ? o.credit > 0 : o.debit > 0));
    const basis = opposite.length
      ? opposite
      : other.length
        ? other
        : null;
    if (!basis) {
      add(
        `op:unclassified`,
        inflow ? 'Other operating receipts' : 'Other operating payments',
        'operating',
        inflow ? cashAmt : 0,
        inflow ? 0 : cashAmt
      );
      continue;
    }
    const weights = basis.map((o) =>
      Math.max(o.debit, o.credit, 0.01)
    );
    const wsum = weights.reduce((s, w) => s + w, 0);
    basis.forEach((o, i) => {
      const share = round2((cashAmt * weights[i]) / wsum);
      const cls = classifyGlForCashFlow({
        account_type: o.acct.account_type,
        subtype: o.acct.subtype,
        code: o.acct.code,
        source: je.source,
      });
      const name = lineName(o.acct, inflow);
      add(`${cls}:${name}`, name, cls, inflow ? share : 0, inflow ? 0 : share);
    });
  }

  openingCash = round2(openingCash);
  closingCash = round2(closingCash);

  const all = [...buckets.values()].map((l) => ({
    ...l,
    inflow: round2(l.inflow),
    outflow: round2(l.outflow),
    net: round2(l.inflow - l.outflow),
  }));
  const operating = all.filter((l) => l.class === 'operating');
  const investing = all.filter((l) => l.class === 'investing');
  const financing = all.filter((l) => l.class === 'financing');
  const sum = (rows: Ias7Line[]) => round2(rows.reduce((s, r) => s + r.net, 0));
  const netOperating = sum(operating);
  const netInvesting = sum(investing);
  const netFinancing = sum(financing);
  const netChange = round2(netOperating + netInvesting + netFinancing);
  const impliedClose = round2(openingCash + netChange);

  return {
    method: 'direct',
    from,
    to,
    operating,
    investing,
    financing,
    netOperating,
    netInvesting,
    netFinancing,
    netChange,
    openingCash,
    closingCash,
    impliedClose,
    reconciled: Math.abs(impliedClose - closingCash) < 0.05,
    journalCount,
    warning: warning || lineWarn,
  };
}

export function ias7ToAfsLines(
  current: Ias7CashFlow,
  prior: Ias7CashFlow
): {
  operating: Array<{ code: string; name: string; current: number; prior: number }>;
  investing: Array<{ code: string; name: string; current: number; prior: number }>;
  financing: Array<{ code: string; name: string; current: number; prior: number }>;
} {
  const merge = (a: Ias7Line[], b: Ias7Line[]) => {
    const names = [...new Set([...a.map((l) => l.name), ...b.map((l) => l.name)])];
    return names.map((name) => ({
      code: '',
      name,
      current: a.find((l) => l.name === name)?.net || 0,
      prior: b.find((l) => l.name === name)?.net || 0,
    }));
  };
  return {
    operating: merge(current.operating, prior.operating),
    investing: merge(current.investing, prior.investing),
    financing: merge(current.financing, prior.financing),
  };
}
