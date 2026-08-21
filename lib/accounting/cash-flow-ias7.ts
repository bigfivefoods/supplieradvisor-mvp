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
import { dayBeforeIso, fetchAccountTotals } from '@/lib/accounting/account-totals';
import type {
  CashFlowClass,
  CashFlowJournal,
  CashFlowMonth,
  Ias7CashFlow,
  Ias7Line,
  IndirectAdjust,
  IndirectOperating,
} from '@/lib/accounting/statement-types';

export type {
  CashFlowClass,
  CashFlowJournal,
  CashFlowMonth,
  Ias7CashFlow,
  Ias7Line,
  IndirectAdjust,
  IndirectOperating,
} from '@/lib/accounting/statement-types';

export const CASH_FLOW_POLICIES = [
  'Presented under IAS 7 Statement of Cash Flows. Operating cash is also reconciled from profit (IAS 7.18; ASC 230 requires this reconciliation when the direct method is shown).',
  'Cash and cash equivalents are bank and petty-cash GL accounts (IAS 7.6–7). Bank overdrafts in the cash pool are included where they are repayable on demand.',
  'Interest paid and interest received are classified as operating (ASC 230). IAS 7.33 also permits financing / investing classification — disclose if you reclassify by journal.',
  'Dividends and owner drawings paid are financing. Taxes paid are operating (ASC 230; IAS 7.35 allows financing if the tax can be specifically identified).',
  'Non-cash investing and financing (e.g. asset acquired on credit) do not appear as cash flows (IAS 7.43 / ASC 230-10-50-3).',
] as const;

export function workingCapitalCashEffect(
  openingDebitMinusCredit: number,
  closingDebitMinusCredit: number
): number {
  return round2(-(closingDebitMinusCredit - openingDebitMinusCredit));
}

export function isNonCashPnlAccount(opts: {
  account_type: string;
  subtype?: string | null;
  code?: string | null;
}): { kind: 'add_back' | 'deduct' | null; name: string } {
  const s = String(opts.subtype || '').toLowerCase();
  const c = String(opts.code || '');
  const t = String(opts.account_type || '').toLowerCase();
  if (s === 'depreciation' || c === '6800') {
    return { kind: 'add_back', name: 'Depreciation and amortisation' };
  }
  if (s === 'impairment' || c === '6810') {
    return { kind: 'add_back', name: 'Impairment losses' };
  }
  if (s === 'credit_loss' || c === '6820') {
    return { kind: 'add_back', name: 'Expected credit losses' };
  }
  if (c === '6830' || (t === 'expense' && /loss on disposal/i.test(s))) {
    return { kind: 'add_back', name: 'Loss on disposal of assets' };
  }
  if (c === '4310') {
    return { kind: 'deduct', name: 'Gain on disposal of assets' };
  }
  return { kind: null, name: '' };
}

export function isWorkingCapitalAccount(opts: {
  account_type: string;
  subtype?: string | null;
  code?: string | null;
}): boolean {
  const t = String(opts.account_type || '').toLowerCase();
  const s = String(opts.subtype || '').toLowerCase();
  const c = String(opts.code || '');
  if (isCashAccount(opts)) return false;
  if (t === 'asset' && (s === 'fixed' || c.startsWith('12'))) return false;
  if (t === 'liability' && (s === 'long_term' || c.startsWith('22'))) return false;
  if (t === 'equity' || t === 'revenue' || t === 'expense' || t === 'cogs') {
    return false;
  }
  if (s === 'contra_asset') return false;
  return (
    s === 'receivable' ||
    s === 'payable' ||
    s === 'inventory' ||
    s === 'tax' ||
    s === 'current' ||
    s === 'payroll' ||
    c.startsWith('11') ||
    c.startsWith('21')
  );
}

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
    from,
    to,
  });
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
    outflow: number,
    journal?: CashFlowJournal
  ) => {
    const cur = buckets.get(key) || {
      name,
      class: cls,
      inflow: 0,
      outflow: 0,
      net: 0,
      journals: [],
    };
    cur.inflow += inflow;
    cur.outflow += outflow;
    cur.net = round2(cur.inflow - cur.outflow);
    if (journal && (Math.abs(journal.inflow) >= 0.005 || Math.abs(journal.outflow) >= 0.005)) {
      if (!cur.journals) cur.journals = [];
      cur.journals.push(journal);
    }
    buckets.set(key, cur);
  };

  const monthMap = new Map<string, CashFlowMonth>();
  const bumpMonth = (
    date: string,
    cls: CashFlowClass,
    inflow: number,
    outflow: number
  ) => {
    const key = date.slice(0, 7);
    const cur = monthMap.get(key) || {
      month: key,
      operating: 0,
      investing: 0,
      financing: 0,
      net: 0,
      inflow: 0,
      outflow: 0,
    };
    cur[cls] = round2(cur[cls] + inflow - outflow);
    cur.inflow = round2(cur.inflow + inflow);
    cur.outflow = round2(cur.outflow + outflow);
    cur.net = round2(cur.operating + cur.investing + cur.financing);
    monthMap.set(key, cur);
  };

  const memos = await fetchJournalMemos(journals.map((j) => j.id));

  const openingTotals = await fetchAccountTotals({
    profileId: opts.profileId,
    to: dayBeforeIso(from),
  });
  let openingCash = 0;
  for (const row of openingTotals.rows) {
    if (cashIds.has(row.account_id)) openingCash += row.debit - row.credit;
  }
  openingCash = round2(openingCash);
  let closingCash = openingCash;
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
    if (date <= to) closingCash = round2(closingCash + netCash);

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
    const meta = memos.get(je.id);
    if (!basis) {
      const inf = inflow ? cashAmt : 0;
      const out = inflow ? 0 : cashAmt;
      add(
        `op:unclassified`,
        inflow ? 'Other operating receipts' : 'Other operating payments',
        'operating',
        inf,
        out,
        {
          journal_id: je.id,
          date,
          entry_number: meta?.entry_number || null,
          memo: meta?.memo || null,
          source: je.source || null,
          account_code: null,
          account_name: null,
          amount: round2(inf - out),
          inflow: inf,
          outflow: out,
        }
      );
      bumpMonth(date, 'operating', inf, out);
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
      const inf = inflow ? share : 0;
      const out = inflow ? 0 : share;
      add(`${cls}:${name}`, name, cls, inf, out, {
        journal_id: je.id,
        date,
        entry_number: meta?.entry_number || null,
        memo: meta?.memo || je.source || null,
        source: je.source || null,
        account_code: o.acct.code,
        account_name: o.acct.name,
        amount: round2(inf - out),
        inflow: inf,
        outflow: out,
      });
      bumpMonth(date, cls, inf, out);
    });
  }

  openingCash = round2(openingCash);
  closingCash = round2(closingCash);

  const all = [...buckets.values()].map((l) => ({
    ...l,
    inflow: round2(l.inflow),
    outflow: round2(l.outflow),
    net: round2(l.inflow - l.outflow),
    journals: [...(l.journals || [])]
      .sort((a, b) => a.date.localeCompare(b.date) || a.journal_id - b.journal_id)
      .slice(0, 300),
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

  const indirect = buildIndirectOperating({
    from,
    to,
    accounts,
    cashIds,
    journals,
    linesByJe,
  });

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
    indirect,
    policies: [...CASH_FLOW_POLICIES],
    months: fillCashFlowMonths(from, to, monthMap),
  };
}

export function fillCashFlowMonths(
  from: string,
  to: string,
  monthMap: Map<string, CashFlowMonth>
): CashFlowMonth[] {
  const keys = monthsInRange(from, to);
  return keys.map((month) => {
    const hit = monthMap.get(month);
    if (hit) {
      return {
        ...hit,
        operating: round2(hit.operating),
        investing: round2(hit.investing),
        financing: round2(hit.financing),
        net: round2(hit.net),
        inflow: round2(hit.inflow),
        outflow: round2(hit.outflow),
      };
    }
    return {
      month,
      operating: 0,
      investing: 0,
      financing: 0,
      net: 0,
      inflow: 0,
      outflow: 0,
    };
  });
}

export function monthsInRange(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const ey = Number(to.slice(0, 4));
  const em = Number(to.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return out;
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard < 120) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    guard += 1;
  }
  return out;
}

async function fetchJournalMemos(
  ids: number[]
): Promise<Map<number, { memo: string | null; entry_number: string | null }>> {
  const out = new Map<number, { memo: string | null; entry_number: string | null }>();
  if (!ids.length) return out;
  const supabase = getSupabaseServer();
  const chunkSize = 150;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const full = await supabase
      .from('journal_entries')
      .select('id, memo, entry_number')
      .in('id', chunk);
    if (!full.error && full.data) {
      for (const r of full.data) {
        out.set(Number(r.id), {
          memo: r.memo != null ? String(r.memo) : null,
          entry_number: r.entry_number != null ? String(r.entry_number) : null,
        });
      }
      continue;
    }
    const memoOnly = await supabase
      .from('journal_entries')
      .select('id, memo')
      .in('id', chunk);
    if (!memoOnly.error && memoOnly.data) {
      for (const r of memoOnly.data) {
        out.set(Number(r.id), {
          memo: r.memo != null ? String(r.memo) : null,
          entry_number: null,
        });
      }
    }
  }
  return out;
}

function buildIndirectOperating(opts: {
  from: string;
  to: string;
  accounts: Acct[];
  cashIds: Set<number>;
  journals: Array<{ id: number; entry_date: string; source?: string | null }>;
  linesByJe: Map<
    number,
    Array<{ account_id: number; debit: number; credit: number }>
  >;
}): IndirectOperating {
  const open = new Map<number, number>();
  const close = new Map<number, number>();
  const period = new Map<number, { debit: number; credit: number }>();
  const bump = (map: Map<number, number>, id: number, n: number) => {
    map.set(id, round2((map.get(id) || 0) + n));
  };

  for (const je of opts.journals) {
    if (String(je.source || '') === 'year_end_close') continue;
    const lines = opts.linesByJe.get(je.id) || [];
    for (const l of lines) {
      const dc = l.debit - l.credit;
      if (je.entry_date < opts.from) bump(open, l.account_id, dc);
      if (je.entry_date <= opts.to) bump(close, l.account_id, dc);
      if (je.entry_date >= opts.from && je.entry_date <= opts.to) {
        const cur = period.get(l.account_id) || { debit: 0, credit: 0 };
        cur.debit += l.debit;
        cur.credit += l.credit;
        period.set(l.account_id, cur);
      }
    }
  }

  let profit = 0;
  const addBack = new Map<string, number>();
  const deduct = new Map<string, number>();
  const wc = new Map<string, number>();

  for (const a of opts.accounts) {
    if (opts.cashIds.has(a.id)) continue;
    const p = period.get(a.id) || { debit: 0, credit: 0 };
    const t = String(a.account_type || '').toLowerCase();
    if (t === 'revenue') profit += p.credit - p.debit;
    if (t === 'expense' || t === 'cogs') profit -= p.debit - p.credit;

    const nc = isNonCashPnlAccount(a);
    if (nc.kind === 'add_back') {
      const amt = round2(p.debit - p.credit);
      if (Math.abs(amt) >= 0.005) {
        addBack.set(nc.name, round2((addBack.get(nc.name) || 0) + amt));
      }
    } else if (nc.kind === 'deduct') {
      const amt = round2(p.credit - p.debit);
      if (Math.abs(amt) >= 0.005) {
        deduct.set(nc.name, round2((deduct.get(nc.name) || 0) + amt));
      }
    }

    if (isWorkingCapitalAccount(a)) {
      const effect = workingCapitalCashEffect(
        open.get(a.id) || 0,
        close.get(a.id) || 0
      );
      if (Math.abs(effect) < 0.005) continue;
      const label =
        String(a.subtype) === 'receivable'
          ? 'Trade and other receivables'
          : String(a.subtype) === 'payable'
            ? 'Trade and other payables'
            : String(a.subtype) === 'inventory'
              ? 'Inventories'
              : String(a.subtype) === 'tax'
                ? 'Taxes receivable / payable'
                : a.name;
      wc.set(label, round2((wc.get(label) || 0) + effect));
    }
  }

  profit = round2(profit);
  const adjustments: IndirectAdjust[] = [];
  for (const [name, amount] of addBack) {
    adjustments.push({ name: `Adjust for ${name.toLowerCase()}`, amount });
  }
  for (const [name, amount] of deduct) {
    adjustments.push({
      name: `Deduct ${name.toLowerCase()}`,
      amount: round2(-amount),
    });
  }
  for (const [name, amount] of wc) {
    adjustments.push({
      name: `Working capital — ${name}`,
      amount,
    });
  }
  const netOperating = round2(
    profit + adjustments.reduce((s, a) => s + a.amount, 0)
  );
  return { profit, adjustments, netOperating };
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
