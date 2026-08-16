/**
 * Compile an IFRS-oriented Annual Financial Statements pack from posted journals.
 *
 * Statements:
 *  - Statement of financial position (as at period end + comparative)
 *  - Statement of profit or loss (period + comparative; excludes year-end close)
 *  - Statement of changes in equity
 *  - Statement of cash flows (indirect method)
 *  - Notes + accounting policies
 *
 * These are compiled AFS from the ledger — not an audit opinion.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getOrCreateSettings, round2 } from '@/lib/accounting/server';
import {
  fetchJournalLinesByEntryIds,
  fetchPostedJournals,
} from '@/lib/accounting/journal-query';
import {
  classifyBsSection,
  BS_SECTION_LABELS,
} from '@/lib/accounting/balance-sheet-allocate';
import { priorComparablePeriod } from '@/lib/accounting/afs-period';
import type { AfsLine, AfsNote, AfsPack, AfsSection } from '@/lib/accounting/afs-types';

export type { AfsLine, AfsNote, AfsPack, AfsSection } from '@/lib/accounting/afs-types';

type CoaRow = {
  id: number;
  code: string;
  name: string;
  account_type: string;
  subtype?: string | null;
  is_header?: boolean | null;
};

type Buckets = {
  asAtCurrent: Map<number, { debit: number; credit: number }>;
  asAtPrior: Map<number, { debit: number; credit: number }>;
  asAtPriorOpen: Map<number, { debit: number; credit: number }>;
  periodCurrent: Map<number, { debit: number; credit: number }>;
  periodPrior: Map<number, { debit: number; credit: number }>;
};

function addTo(
  map: Map<number, { debit: number; credit: number }>,
  id: number,
  debit: number,
  credit: number
) {
  const cur = map.get(id) || { debit: 0, credit: 0 };
  cur.debit += debit;
  cur.credit += credit;
  map.set(id, cur);
}

function signed(type: string, debit: number, credit: number): number {
  const t = String(type || '').toLowerCase();
  if (t === 'asset' || t === 'expense' || t === 'cogs') {
    return round2(debit - credit);
  }
  return round2(credit - debit);
}

function amt(
  map: Map<number, { debit: number; credit: number }>,
  id: number,
  type: string
): number {
  const v = map.get(id);
  if (!v) return 0;
  return signed(type, v.debit, v.credit);
}

function pair(current: number, prior: number): { current: number; prior: number } {
  return { current: round2(current), prior: round2(prior) };
}

function isCash(a: CoaRow): boolean {
  const s = String(a.subtype || '').toLowerCase();
  const c = String(a.code || '');
  return s === 'bank' || s === 'cash' || c === '1110' || c === '1120';
}

function isPpeCost(a: CoaRow): boolean {
  const s = String(a.subtype || '').toLowerCase();
  const c = String(a.code || '');
  return (
    (s === 'fixed' || c.startsWith('12')) &&
    s !== 'contra_asset' &&
    c !== '1220' &&
    c !== '1240'
  );
}

function isNonCashExpense(a: CoaRow): boolean {
  const s = String(a.subtype || '').toLowerCase();
  const c = String(a.code || '');
  return (
    s === 'depreciation' ||
    s === 'impairment' ||
    s === 'credit_loss' ||
    c === '6800' ||
    c === '6810' ||
    c === '6820'
  );
}

function residualNi(
  accounts: CoaRow[],
  map: Map<number, { debit: number; credit: number }>
): number {
  let ni = 0;
  for (const a of accounts) {
    const t = String(a.account_type);
    if (t === 'revenue') ni += amt(map, a.id, t);
    else if (t === 'expense' || t === 'cogs') ni -= amt(map, a.id, t);
  }
  return round2(ni);
}

function periodNi(
  accounts: CoaRow[],
  map: Map<number, { debit: number; credit: number }>
): number {
  return residualNi(accounts, map);
}

function sofpEquityTotal(
  accounts: CoaRow[],
  map: Map<number, { debit: number; credit: number }>
): number {
  let eq = 0;
  for (const a of accounts) {
    if (a.account_type === 'equity') eq += amt(map, a.id, 'equity');
  }
  return round2(eq + residualNi(accounts, map));
}

function sofpAssets(
  accounts: CoaRow[],
  map: Map<number, { debit: number; credit: number }>
): number {
  let n = 0;
  for (const a of accounts) {
    if (a.account_type === 'asset') n += amt(map, a.id, 'asset');
  }
  return round2(n);
}

function sofpLiab(
  accounts: CoaRow[],
  map: Map<number, { debit: number; credit: number }>
): number {
  let n = 0;
  for (const a of accounts) {
    if (a.account_type === 'liability') n += amt(map, a.id, 'liability');
  }
  return round2(n);
}

function cashTotal(
  accounts: CoaRow[],
  map: Map<number, { debit: number; credit: number }>
): number {
  let n = 0;
  for (const a of accounts) {
    if (a.account_type === 'asset' && isCash(a)) n += amt(map, a.id, 'asset');
  }
  return round2(n);
}

function sectionLines(
  accounts: CoaRow[],
  currentMap: Map<number, { debit: number; credit: number }>,
  priorMap: Map<number, { debit: number; credit: number }>,
  types: string[],
  sectionKey?: string
): AfsLine[] {
  const lines: AfsLine[] = [];
  for (const a of accounts) {
    if (!types.includes(a.account_type)) continue;
    if (sectionKey) {
      const sec = classifyBsSection(a.account_type, a.subtype, a.code);
      if (sec !== sectionKey) continue;
    }
    const current = amt(currentMap, a.id, a.account_type);
    const prior = amt(priorMap, a.id, a.account_type);
    if (Math.abs(current) < 0.005 && Math.abs(prior) < 0.005) continue;
    lines.push({
      code: a.code,
      name: a.name,
      current,
      prior,
      indent: true,
    });
  }
  return lines;
}

function sumLines(lines: AfsLine[]): { current: number; prior: number } {
  return pair(
    lines.reduce((s, l) => s + l.current, 0),
    lines.reduce((s, l) => s + l.prior, 0)
  );
}

export async function buildAfsPack(opts: {
  profileId: number;
  from: string;
  to: string;
  label?: string | null;
}): Promise<AfsPack> {
  const from = String(opts.from).slice(0, 10);
  const to = String(opts.to).slice(0, 10);
  const settings = await getOrCreateSettings(opts.profileId);
  const fyStart = Number(settings.fiscal_year_start_month || 3);
  const prior = priorComparablePeriod(from, to, fyStart);
  const currency = String(settings.base_currency || 'ZAR');

  const supabase = getSupabaseServer();
  let profile: {
    trading_name?: string | null;
    legal_name?: string | null;
    registration_number?: string | null;
    tax_number?: string | null;
    vat_number?: string | null;
    country?: string | null;
  } | null = null;
  {
    const full = await supabase
      .from('profiles')
      .select(
        'trading_name, legal_name, registration_number, tax_number, vat_number, country'
      )
      .eq('id', opts.profileId)
      .maybeSingle();
    if (full.error && /column|42703/i.test(full.error.message)) {
      const slim = await supabase
        .from('profiles')
        .select('trading_name, legal_name, country')
        .eq('id', opts.profileId)
        .maybeSingle();
      profile = slim.data;
    } else {
      profile = full.data;
    }
  }

  const { data: accountsRaw } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type, subtype, is_header')
    .eq('profile_id', opts.profileId)
    .order('code');
  const accounts: CoaRow[] = (accountsRaw || [])
    .filter((a) => !a.is_header)
    .map((a) => ({
      id: Number(a.id),
      code: String(a.code || ''),
      name: String(a.name || ''),
      account_type: String(a.account_type || ''),
      subtype: a.subtype || null,
    }));

  const { rows: journals, warning } = await fetchPostedJournals({
    profileId: opts.profileId,
    to,
  });
  const byId = new Map(journals.map((j) => [j.id, j]));
  const { lines: rawLines, warning: lineWarn } = await fetchJournalLinesByEntryIds(
    journals.map((j) => j.id),
    'journal_entry_id, account_id, debit, credit'
  );

  const buckets: Buckets = {
    asAtCurrent: new Map(),
    asAtPrior: new Map(),
    asAtPriorOpen: new Map(),
    periodCurrent: new Map(),
    periodPrior: new Map(),
  };

  for (const l of rawLines) {
    const jid = Number(l.journal_entry_id);
    const je = byId.get(jid);
    if (!je) continue;
    const date = je.entry_date;
    const aid = Number(l.account_id);
    const d = Number(l.debit || 0);
    const c = Number(l.credit || 0);
    if (!Number.isFinite(aid)) continue;
    const isClose = String(je.source || '') === 'year_end_close';

    if (date <= to) addTo(buckets.asAtCurrent, aid, d, c);
    if (date <= prior.to) addTo(buckets.asAtPrior, aid, d, c);
    if (date < prior.from) addTo(buckets.asAtPriorOpen, aid, d, c);
    if (!isClose && date >= from && date <= to) {
      addTo(buckets.periodCurrent, aid, d, c);
    }
    if (!isClose && date >= prior.from && date <= prior.to) {
      addTo(buckets.periodPrior, aid, d, c);
    }
  }

  const companyName =
    profile?.legal_name ||
    profile?.trading_name ||
    `Company #${opts.profileId}`;

  const niCurrent = periodNi(accounts, buckets.periodCurrent);
  const niPrior = periodNi(accounts, buckets.periodPrior);

  // ── SoFP ──────────────────────────────────────────────────────────────
  const sofpKeys = [
    'current_assets',
    'non_current_assets',
    'current_liabilities',
    'non_current_liabilities',
    'equity',
  ] as const;
  const sofpSections: AfsSection[] = [];
  for (const key of sofpKeys) {
    const types =
      key.includes('asset')
        ? ['asset']
        : key.includes('liabilit')
          ? ['liability']
          : ['equity'];
    const lines = sectionLines(
      accounts,
      buckets.asAtCurrent,
      buckets.asAtPrior,
      types,
      key
    );
    if (key === 'equity') {
      const resCur = residualNi(accounts, buckets.asAtCurrent);
      const resPrior = residualNi(accounts, buckets.asAtPrior);
      if (Math.abs(resCur) >= 0.005 || Math.abs(resPrior) >= 0.005) {
        lines.push({
          code: 'NI',
          name: 'Profit for the period (not yet closed)',
          note: '11',
          current: resCur,
          prior: resPrior,
          indent: true,
        });
      }
    }
    const total = sumLines(lines);
    sofpSections.push({
      key,
      title: BS_SECTION_LABELS[key] || key,
      lines,
      total,
    });
  }

  const assets = pair(
    sofpAssets(accounts, buckets.asAtCurrent),
    sofpAssets(accounts, buckets.asAtPrior)
  );
  const liabilities = pair(
    sofpLiab(accounts, buckets.asAtCurrent),
    sofpLiab(accounts, buckets.asAtPrior)
  );
  const equity = pair(
    sofpEquityTotal(accounts, buckets.asAtCurrent),
    sofpEquityTotal(accounts, buckets.asAtPrior)
  );

  // ── P&L ───────────────────────────────────────────────────────────────
  const revLines = sectionLines(
    accounts,
    buckets.periodCurrent,
    buckets.periodPrior,
    ['revenue']
  );
  const cogsLines = sectionLines(
    accounts,
    buckets.periodCurrent,
    buckets.periodPrior,
    ['cogs']
  );
  const expLines = sectionLines(
    accounts,
    buckets.periodCurrent,
    buckets.periodPrior,
    ['expense']
  );
  const revenue = sumLines(revLines);
  const cogs = sumLines(cogsLines);
  const expenses = sumLines(expLines);
  const grossProfit = pair(revenue.current - cogs.current, revenue.prior - cogs.prior);
  const netIncome = pair(niCurrent, niPrior);

  const pnlSections: AfsSection[] = [
    { key: 'revenue', title: 'Revenue', lines: revLines, total: revenue },
    { key: 'cogs', title: 'Cost of sales', lines: cogsLines, total: cogs },
    {
      key: 'gross',
      title: 'Gross profit',
      lines: [
        {
          code: '',
          name: 'Gross profit',
          current: grossProfit.current,
          prior: grossProfit.prior,
          bold: true,
        },
      ],
      total: grossProfit,
    },
    {
      key: 'expenses',
      title: 'Operating expenses',
      lines: expLines,
      total: expenses,
    },
  ];

  // ── Equity ────────────────────────────────────────────────────────────
  const eqOpenCur = sofpEquityTotal(accounts, buckets.asAtPrior);
  const eqCloseCur = sofpEquityTotal(accounts, buckets.asAtCurrent);
  const eqOpenPrior = sofpEquityTotal(accounts, buckets.asAtPriorOpen);
  const eqClosePrior = sofpEquityTotal(accounts, buckets.asAtPrior);
  const otherCur = round2(eqCloseCur - eqOpenCur - niCurrent);
  const otherPrior = round2(eqClosePrior - eqOpenPrior - niPrior);

  const equityAccountLines = sectionLines(
    accounts,
    buckets.asAtCurrent,
    buckets.asAtPrior,
    ['equity']
  );

  const sceLines: AfsLine[] = [
    {
      code: '',
      name: `Balance at ${prior.to}`,
      current: eqOpenCur,
      prior: eqOpenPrior,
      bold: true,
    },
    {
      code: '',
      name: 'Profit / (loss) for the period',
      note: '',
      current: niCurrent,
      prior: niPrior,
      indent: true,
    },
    {
      code: '',
      name: 'Other equity movements (capital, drawings, transfers)',
      current: otherCur,
      prior: otherPrior,
      indent: true,
    },
    {
      code: '',
      name: `Balance at ${to}`,
      current: eqCloseCur,
      prior: eqClosePrior,
      bold: true,
    },
    ...equityAccountLines.map((l) => ({
      ...l,
      name: `Closing · ${l.name}`,
    })),
  ];

  // ── Cash flows (indirect) ─────────────────────────────────────────────
  function wcChange(
    pred: (a: CoaRow) => boolean,
    type: string,
    curMap: Map<number, { debit: number; credit: number }>,
    openMap: Map<number, { debit: number; credit: number }>
  ): number {
    let n = 0;
    for (const a of accounts) {
      if (!pred(a)) continue;
      n += amt(curMap, a.id, type) - amt(openMap, a.id, type);
    }
    return round2(n);
  }

  function buildCfSide(
    closeMap: Map<number, { debit: number; credit: number }>,
    openMap: Map<number, { debit: number; credit: number }>,
    periodMap: Map<number, { debit: number; credit: number }>,
    ni: number
  ) {
    const depr = accounts
      .filter((a) => a.account_type === 'expense' && isNonCashExpense(a))
      .reduce((s, a) => s + amt(periodMap, a.id, 'expense'), 0);

    const dAr = wcChange(
      (a) =>
        a.account_type === 'asset' &&
        (String(a.subtype) === 'receivable' ||
          (String(a.subtype) === 'contra_asset' && !String(a.code).startsWith('12'))),
      'asset',
      closeMap,
      openMap
    );
    const dInv = wcChange(
      (a) => a.account_type === 'asset' && String(a.subtype) === 'inventory',
      'asset',
      closeMap,
      openMap
    );
    const dPrepay = wcChange(
      (a) =>
        a.account_type === 'asset' &&
        !isCash(a) &&
        !isPpeCost(a) &&
        String(a.subtype) !== 'receivable' &&
        String(a.subtype) !== 'inventory' &&
        String(a.subtype) !== 'contra_asset',
      'asset',
      closeMap,
      openMap
    );
    const dAp = wcChange(
      (a) => a.account_type === 'liability' && String(a.subtype) === 'payable',
      'liability',
      closeMap,
      openMap
    );
    const dTax = wcChange(
      (a) => a.account_type === 'liability' && String(a.subtype) === 'tax',
      'liability',
      closeMap,
      openMap
    );
    const dOthLiab = wcChange(
      (a) =>
        a.account_type === 'liability' &&
        classifyBsSection(a.account_type, a.subtype, a.code) ===
          'current_liabilities' &&
        String(a.subtype) !== 'payable' &&
        String(a.subtype) !== 'tax',
      'liability',
      closeMap,
      openMap
    );

    const operating: AfsLine[] = [
      { code: '', name: 'Profit / (loss) for the period', current: ni, prior: 0 },
      {
        code: '',
        name: 'Adjustments for non-cash items (depreciation / impairment / ECL)',
        current: round2(depr),
        prior: 0,
      },
      {
        code: '',
        name: '(Increase) / decrease in trade receivables',
        current: round2(-dAr),
        prior: 0,
      },
      {
        code: '',
        name: '(Increase) / decrease in inventory',
        current: round2(-dInv),
        prior: 0,
      },
      {
        code: '',
        name: '(Increase) / decrease in other current assets',
        current: round2(-dPrepay),
        prior: 0,
      },
      {
        code: '',
        name: 'Increase / (decrease) in trade payables',
        current: round2(dAp),
        prior: 0,
      },
      {
        code: '',
        name: 'Increase / (decrease) in tax payable',
        current: round2(dTax),
        prior: 0,
      },
      {
        code: '',
        name: 'Increase / (decrease) in other current liabilities',
        current: round2(dOthLiab),
        prior: 0,
      },
    ];

    const dPpe = wcChange(
      (a) => a.account_type === 'asset' && isPpeCost(a),
      'asset',
      closeMap,
      openMap
    );
    const investing: AfsLine[] = [
      {
        code: '',
        name: 'Acquisition of property, plant and equipment / intangibles',
        current: round2(-dPpe),
        prior: 0,
      },
    ];

    const dCapital = wcChange(
      (a) =>
        a.account_type === 'equity' &&
        (String(a.subtype) === 'capital' || a.code === '3100'),
      'equity',
      closeMap,
      openMap
    );
    const dDraw = wcChange(
      (a) =>
        a.account_type === 'equity' &&
        (String(a.subtype) === 'drawings' || a.code === '3300'),
      'equity',
      closeMap,
      openMap
    );
    const dLoan = wcChange(
      (a) =>
        a.account_type === 'liability' &&
        classifyBsSection(a.account_type, a.subtype, a.code) ===
          'non_current_liabilities',
      'liability',
      closeMap,
      openMap
    );
    const financing: AfsLine[] = [
      {
        code: '',
        name: 'Proceeds from / (repayment of) long-term borrowings',
        current: round2(dLoan),
        prior: 0,
      },
      {
        code: '',
        name: 'Proceeds from share capital / owner contributions',
        current: round2(dCapital),
        prior: 0,
      },
      {
        code: '',
        name: 'Owner drawings / distributions',
        current: round2(dDraw),
        prior: 0,
      },
    ];

    const netOp = round2(operating.reduce((s, l) => s + l.current, 0));
    const netInv = round2(investing.reduce((s, l) => s + l.current, 0));
    const netFin = round2(financing.reduce((s, l) => s + l.current, 0));
    const opening = cashTotal(accounts, openMap);
    const closing = cashTotal(accounts, closeMap);
    const implied = round2(opening + netOp + netInv + netFin);
    const plug = round2(closing - implied);
    if (Math.abs(plug) >= 0.05) {
      operating.push({
        code: '',
        name: 'Other working-capital / unclassified movements',
        current: plug,
        prior: 0,
      });
    }
    const netOp2 = round2(operating.reduce((s, l) => s + l.current, 0));
    return {
      operating,
      investing,
      financing,
      netOp: netOp2,
      netInv,
      netFin,
      opening,
      closing,
    };
  }

  const cfCur = buildCfSide(
    buckets.asAtCurrent,
    buckets.asAtPrior,
    buckets.periodCurrent,
    niCurrent
  );
  const cfPrior = buildCfSide(
    buckets.asAtPrior,
    buckets.asAtPriorOpen,
    buckets.periodPrior,
    niPrior
  );

  function mergeCf(a: AfsLine[], b: AfsLine[]): AfsLine[] {
    const max = Math.max(a.length, b.length);
    const out: AfsLine[] = [];
    for (let i = 0; i < max; i++) {
      out.push({
        code: '',
        name: a[i]?.name || b[i]?.name || '',
        current: a[i]?.current ?? 0,
        prior: b[i]?.current ?? 0,
      });
    }
    return out;
  }

  const cfOperating = mergeCf(cfCur.operating, cfPrior.operating);
  const cfInvesting = mergeCf(cfCur.investing, cfPrior.investing);
  const cfFinancing = mergeCf(cfCur.financing, cfPrior.financing);
  const netChange = pair(
    cfCur.netOp + cfCur.netInv + cfCur.netFin,
    cfPrior.netOp + cfPrior.netInv + cfPrior.netFin
  );
  const openingCash = pair(cfCur.opening, cfPrior.opening);
  const closingCash = pair(cfCur.closing, cfPrior.closing);
  const impliedClose = pair(
    openingCash.current + netChange.current,
    openingCash.prior + netChange.prior
  );

  // ── Notes ─────────────────────────────────────────────────────────────
  const ppeLines = sectionLines(
    accounts,
    buckets.asAtCurrent,
    buckets.asAtPrior,
    ['asset'],
    'non_current_assets'
  );
  const arLines = accounts
    .filter(
      (a) => a.account_type === 'asset' && String(a.subtype) === 'receivable'
    )
    .map((a) => ({
      code: a.code,
      name: a.name,
      current: amt(buckets.asAtCurrent, a.id, 'asset'),
      prior: amt(buckets.asAtPrior, a.id, 'asset'),
      indent: true,
    }))
    .filter((l) => Math.abs(l.current) >= 0.005 || Math.abs(l.prior) >= 0.005);
  const apLines = accounts
    .filter(
      (a) => a.account_type === 'liability' && String(a.subtype) === 'payable'
    )
    .map((a) => ({
      code: a.code,
      name: a.name,
      current: amt(buckets.asAtCurrent, a.id, 'liability'),
      prior: amt(buckets.asAtPrior, a.id, 'liability'),
      indent: true,
    }))
    .filter((l) => Math.abs(l.current) >= 0.005 || Math.abs(l.prior) >= 0.005);
  const cashLines = accounts
    .filter((a) => a.account_type === 'asset' && isCash(a))
    .map((a) => ({
      code: a.code,
      name: a.name,
      current: amt(buckets.asAtCurrent, a.id, 'asset'),
      prior: amt(buckets.asAtPrior, a.id, 'asset'),
      indent: true,
    }))
    .filter((l) => Math.abs(l.current) >= 0.005 || Math.abs(l.prior) >= 0.005);
  const taxLines = accounts
    .filter((a) => String(a.subtype) === 'tax')
    .map((a) => ({
      code: a.code,
      name: a.name,
      current: amt(buckets.asAtCurrent, a.id, a.account_type),
      prior: amt(buckets.asAtPrior, a.id, a.account_type),
      indent: true,
    }))
    .filter((l) => Math.abs(l.current) >= 0.005 || Math.abs(l.prior) >= 0.005);

  let faNote: AfsLine[] = [];
  try {
    const { data: fas } = await supabase
      .from('fixed_assets')
      .select(
        'asset_code, name, purchase_cost, accumulated_depreciation, book_value, status'
      )
      .eq('profile_id', opts.profileId)
      .limit(200);
    faNote = (fas || [])
      .filter((a) => String(a.status) !== 'disposed')
      .map((a) => ({
        code: String(a.asset_code || ''),
        name: String(a.name || 'Asset'),
        current: round2(
          Number(
            a.book_value ??
              Number(a.purchase_cost || 0) -
                Number(a.accumulated_depreciation || 0)
          )
        ),
        prior: 0,
        indent: true,
      }));
  } catch {
    faNote = [];
  }

  const notes: AfsNote[] = [
    {
      number: '1',
      title: 'Basis of preparation',
      body:
        'These annual financial statements are compiled from the company general ledger on the accrual basis of accounting, using an IFRS-oriented chart of accounts. Comparative figures are the immediately preceding equivalent period (the previous financial year when a full year is selected). Amounts are in the company base currency. Year-end closing journals are excluded from profit or loss so that performance is shown before the transfer to retained earnings.',
    },
    {
      number: '2',
      title: 'Revenue',
      body: 'Revenue is recognised when an invoice is issued (accrual), not when cash is received. Bank receipts matched to invoices settle receivables and do not create a second sale.',
      lines: revLines,
    },
    {
      number: '3',
      title: 'Cost of sales',
      lines: cogsLines,
    },
    {
      number: '4',
      title: 'Operating expenses',
      lines: expLines,
    },
    {
      number: '5',
      title: 'Property, plant and equipment',
      body: 'PPE is measured at historical cost less accumulated depreciation and impairment. Depreciation is recognised on a straight-line basis over useful life to residual value. The register below is the asset book; the GL carrying amount appears on the statement of financial position.',
      lines: faNote.length ? faNote : ppeLines,
    },
    {
      number: '6',
      title: 'Trade and other receivables',
      body: 'Receivables are carried at invoiced amount. An allowance for expected credit losses (IFRS 9) is not computed automatically — post to account 1135 / 6820 if required.',
      lines: arLines,
    },
    {
      number: '7',
      title: 'Cash and cash equivalents',
      lines: cashLines,
    },
    {
      number: '8',
      title: 'Trade and other payables',
      lines: apLines,
    },
    {
      number: '9',
      title: 'Taxation (VAT)',
      body: 'South African VAT is presented as input (recoverable) and output (payable). This note is a ledger extract, not a SARS VAT 201 submission.',
      lines: taxLines,
    },
    {
      number: '10',
      title: 'Share capital and reserves',
      body: 'Equity comprises contributed capital, retained earnings (including year-end close transfers), and drawings. Unclosed profit is shown separately on the statement of financial position until a year-end close is posted.',
      lines: equityAccountLines,
    },
    {
      number: '11',
      title: 'Profit for the period',
      body: `Profit / (loss) for ${from} to ${to} is ${round2(niCurrent).toFixed(2)} ${currency} (prior ${round2(niPrior).toFixed(2)}).`,
    },
    {
      number: '12',
      title: 'Events after the reporting date',
      body: 'These compiled statements do not automatically identify adjusting or non-adjusting events after the reporting date (IAS 10). Disclose such events outside this pack if material.',
    },
  ];

  const policies: Array<{ title: string; body: string }> = [
    {
      title: 'Reporting entity',
      body: `${companyName} is the reporting entity. These statements cover the selected reporting period and the comparable prior period.`,
    },
    {
      title: 'Accrual basis and going concern',
      body: 'Items are recognised when the underlying right or obligation arises, not only when cash is received or paid. The statements assume the entity is a going concern unless management has locked the books after a winding-up decision.',
    },
    {
      title: 'Revenue (IFRS 15 — simplified)',
      body: 'A single performance obligation is assumed per sales invoice. Multi-element contracts, variable consideration, and principal-versus-agent assessments are not modelled automatically.',
    },
    {
      title: 'Property, plant and equipment (IAS 16 — simplified)',
      body: 'Cost model. Straight-line depreciation. Componentisation, revaluation, and automated disposal accounting are not applied unless posted as journals.',
    },
    {
      title: 'Financial instruments (IFRS 9 — simplified)',
      body: 'Trade receivables and payables are recognised at transaction price. Expected credit losses and fair-value instruments are not automated.',
    },
    {
      title: 'Leases, deferred tax, foreign currency',
      body: 'IFRS 16, IAS 12 deferred tax, and IAS 21 retranslation are not automated. Post journals if those standards apply.',
    },
  ];

  return {
    company: {
      name: companyName,
      legal_name: profile?.legal_name || null,
      trading_name: profile?.trading_name || null,
      registration_number: profile?.registration_number || null,
      vat_number: profile?.vat_number || null,
      tax_number: profile?.tax_number || null,
      country: profile?.country || null,
      currency,
    },
    period: {
      from,
      to,
      label: opts.label || `${from} – ${to}`,
      priorFrom: prior.from,
      priorTo: prior.to,
      priorLabel: prior.label,
    },
    statementOfFinancialPosition: {
      sections: sofpSections,
      assets,
      liabilities,
      equity,
      balanced: {
        current: Math.abs(assets.current - (liabilities.current + equity.current)) < 0.05,
        prior: Math.abs(assets.prior - (liabilities.prior + equity.prior)) < 0.05,
      },
    },
    statementOfProfitOrLoss: {
      sections: pnlSections,
      revenue,
      cogs,
      grossProfit,
      expenses,
      netIncome,
    },
    statementOfChangesInEquity: {
      lines: sceLines,
      opening: pair(eqOpenCur, eqOpenPrior),
      profit: pair(niCurrent, niPrior),
      other: pair(otherCur, otherPrior),
      closing: pair(eqCloseCur, eqClosePrior),
    },
    statementOfCashFlows: {
      operating: cfOperating,
      investing: cfInvesting,
      financing: cfFinancing,
      netOperating: pair(cfCur.netOp, cfPrior.netOp),
      netInvesting: pair(cfCur.netInv, cfPrior.netInv),
      netFinancing: pair(cfCur.netFin, cfPrior.netFin),
      netChange,
      openingCash,
      closingCash,
      reconciled: {
        current: Math.abs(impliedClose.current - closingCash.current) < 0.05,
        prior: Math.abs(impliedClose.prior - closingCash.prior) < 0.05,
      },
    },
    notes,
    policies,
    compilation: {
      basis:
        'Compiled from posted double-entry journals. Unaudited. Not a statutory audit or independent review opinion.',
      unaudited: true,
      journalCount: journals.length,
      warning: warning || lineWarn,
    },
  };
}
