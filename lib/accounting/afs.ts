/**
 * Compile an IFRS-oriented Annual Financial Statements pack from posted journals.
 *
 * Statements:
 *  - Statement of financial position (as at period end + comparative)
 *  - Statement of profit or loss (period + comparative; excludes year-end close)
 *  - Statement of changes in equity
 *  - Statement of cash flows (IAS 7 direct method from bank GL)
 *  - Notes + accounting policies
 *
 * These are compiled AFS from the ledger — not an audit opinion.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { round2 } from '@/lib/accounting/server';
import {
  dayBeforeIso,
  fetchAccountTotals,
  totalsMap,
} from '@/lib/accounting/account-totals';
import { getCachedSettings, getCachedCoa } from '@/lib/accounting/read-cache';
import {
  classifyBsSection,
  BS_SECTION_LABELS,
} from '@/lib/accounting/balance-sheet-allocate';
import { priorComparablePeriod } from '@/lib/accounting/afs-period';
import type { AfsLine, AfsNote, AfsPack, AfsSection } from '@/lib/accounting/afs-types';
import {
  rollTradePayables,
  rollTradeReceivables,
  rollsIntoTradePayables,
  rollsIntoTradeReceivables,
} from '@/lib/accounting/statement-rollups';
import {
  GAAP_DISCLAIMER_LONG,
  GAAP_DISCLAIMER_SHORT,
} from '@/lib/accounting/gaap-disclaimer';

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
  sectionKey?: string,
  skip?: (a: CoaRow) => boolean
): AfsLine[] {
  const lines: AfsLine[] = [];
  for (const a of accounts) {
    if (!types.includes(a.account_type)) continue;
    if (skip && skip(a)) continue;
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

function emptyDc(): { debit: number; credit: number } {
  return { debit: 0, credit: 0 };
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
  const settings = await getCachedSettings(opts.profileId);
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

  const accountsRaw = await getCachedCoa(opts.profileId);
  const accounts: CoaRow[] = (accountsRaw || [])
    .filter((a) => !a.is_header)
    .filter((a) => !/^(1180|2180|4400)-/.test(String(a.code || '')))
    .map((a) => ({
      id: Number(a.id),
      code: String(a.code || ''),
      name: String(a.name || ''),
      account_type: String(a.account_type || ''),
      subtype: a.subtype || null,
    }));

  const priorOpenTo = dayBeforeIso(prior.from);
  const [
    asAtCurrentT,
    asAtPriorT,
    asAtPriorOpenT,
    periodCurrentT,
    periodPriorT,
  ] = await Promise.all([
    fetchAccountTotals({ profileId: opts.profileId, to }),
    fetchAccountTotals({ profileId: opts.profileId, to: prior.to }),
    fetchAccountTotals({ profileId: opts.profileId, to: priorOpenTo }),
    fetchAccountTotals({
      profileId: opts.profileId,
      from,
      to,
      excludeSources: ['year_end_close', 'year-end'],
    }),
    fetchAccountTotals({
      profileId: opts.profileId,
      from: prior.from,
      to: prior.to,
      excludeSources: ['year_end_close', 'year-end'],
    }),
  ]);
  const warning = [asAtCurrentT, asAtPriorT, periodCurrentT]
    .map((t) => t.warning)
    .filter(Boolean)
    .join(' ') || undefined;
  const lineWarn = undefined;

  const buckets: Buckets = {
    asAtCurrent: totalsMap(asAtCurrentT.rows),
    asAtPrior: totalsMap(asAtPriorT.rows),
    asAtPriorOpen: totalsMap(asAtPriorOpenT.rows),
    periodCurrent: totalsMap(periodCurrentT.rows),
    periodPrior: totalsMap(periodPriorT.rows),
  };

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
    const skipFace =
      key === 'current_assets'
        ? (a: CoaRow) => rollsIntoTradeReceivables(a)
        : key === 'current_liabilities'
          ? (a: CoaRow) => rollsIntoTradePayables(a)
          : undefined;
    const lines = sectionLines(
      accounts,
      buckets.asAtCurrent,
      buckets.asAtPrior,
      types,
      key,
      skipFace
    );
    if (key === 'current_assets') {
      const rolled = rollTradeReceivables({
        accounts,
        currentOf: (id) => buckets.asAtCurrent.get(id) || emptyDc(),
        priorOf: (id) => buckets.asAtPrior.get(id) || emptyDc(),
      });
      if (
        Math.abs(rolled.face.current) >= 0.005 ||
        Math.abs(rolled.face.prior) >= 0.005
      ) {
        lines.unshift(rolled.face);
      }
    }
    if (key === 'current_liabilities') {
      const rolled = rollTradePayables({
        accounts,
        currentOf: (id) => buckets.asAtCurrent.get(id) || emptyDc(),
        priorOf: (id) => buckets.asAtPrior.get(id) || emptyDc(),
      });
      if (
        Math.abs(rolled.face.current) >= 0.005 ||
        Math.abs(rolled.face.prior) >= 0.005
      ) {
        lines.unshift(rolled.face);
      }
      const depIdx = lines.findIndex((l) => l.code === '2140');
      if (depIdx > 0) {
        const [dep] = lines.splice(depIdx, 1);
        const apIdx = lines.findIndex(
          (l) => l.code === '2110' || l.name === 'Trade and other payables'
        );
        lines.splice(apIdx >= 0 ? apIdx + 1 : 0, 0, { ...dep, note: '8' });
      } else if (depIdx === 0) {
        lines[0] = { ...lines[0], note: '8' };
      }
    }
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

  // ── Cash flows (IAS 7 direct, from bank GL) ────────────────────────
  const { buildIas7CashFlow, ias7ToAfsLines } = await import(
    '@/lib/accounting/cash-flow-ias7'
  );
  const ias7Cur = await buildIas7CashFlow({
    profileId: opts.profileId,
    from,
    to,
  });
  const ias7Prior = await buildIas7CashFlow({
    profileId: opts.profileId,
    from: prior.from,
    to: prior.to,
  });
  const mergedCf = ias7ToAfsLines(ias7Cur, ias7Prior);
  const cfOperating = mergedCf.operating;
  const cfInvesting = mergedCf.investing;
  const cfFinancing = mergedCf.financing;
  const netChange = pair(ias7Cur.netChange, ias7Prior.netChange);
  const openingCash = pair(ias7Cur.openingCash, ias7Prior.openingCash);
  const closingCash = pair(ias7Cur.closingCash, ias7Prior.closingCash);
  const impliedClose = pair(ias7Cur.impliedClose, ias7Prior.impliedClose);

  // ── Notes ─────────────────────────────────────────────────────────────
  const ppeLines = sectionLines(
    accounts,
    buckets.asAtCurrent,
    buckets.asAtPrior,
    ['asset'],
    'non_current_assets'
  );
  const arRoll = rollTradeReceivables({
    accounts,
    currentOf: (id) => buckets.asAtCurrent.get(id) || emptyDc(),
    priorOf: (id) => buckets.asAtPrior.get(id) || emptyDc(),
  });
  const apRoll = rollTradePayables({
    accounts,
    currentOf: (id) => buckets.asAtCurrent.get(id) || emptyDc(),
    priorOf: (id) => buckets.asAtPrior.get(id) || emptyDc(),
  });
  const arLines = arRoll.detail;
  const depositLines = accounts
    .filter((a) => String(a.code) === '2140')
    .map((a) => ({
      code: a.code,
      name: `${a.name} (IFRS 15 contract liability)`,
      current: amt(buckets.asAtCurrent, a.id, a.account_type),
      prior: amt(buckets.asAtPrior, a.id, a.account_type),
      indent: true,
    }))
    .filter((l) => Math.abs(l.current) >= 0.005 || Math.abs(l.prior) >= 0.005);
  const apLines = [...apRoll.detail, ...depositLines];
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
        `${GAAP_DISCLAIMER_LONG} Comparative figures are the immediately preceding equivalent period (the previous financial year when a full year is selected). Amounts are in the company base currency. Year-end closing journals are excluded from profit or loss so that performance is shown before the transfer to retained earnings.`,
    },
    {
      number: '2',
      title: 'Revenue',
      body: 'Revenue is recognised when an invoice is issued (accrual), not when cash is received. Bank receipts matched to invoices settle receivables and do not create a second sale. Cash received before any invoice is issued is a contract liability in 2140 Customer deposits until that invoice is issued. A single performance obligation is assumed per sales invoice; multi-element contracts, variable consideration, and principal-versus-agent assessments are not modelled.',
      lines: revLines,
    },
    {
      number: '3',
      title: 'Cost of sales',
      body: 'Inventories are measured at cost (IAS 2, simplified). Cost of sales is recognised when a sales invoice line has quantity and a known unit cost from the product catalogue or stock movements (Dr 5100 · Cr 1140). Lines with no product, a zero cost, or a service/membership invoice do not post COGS — selling price is never used as cost. NRV write-downs and standard costing are not automated.',
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
      body: 'Trade and other receivables comprise control account 1130, the 1180 Customers header, unique 1180-* customer leaves, and any leftover 1181+ named accounts. The face of the statement of financial position shows one current line. Expected credit losses are measured on Finance → ECL using management aging rates and posted to 1135 / 6820. 1135 is a current contra and is presented net against this note.',
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
      body: 'Trade and other payables comprise control account 2110, the 2180 Suppliers header, unique 2180-* supplier leaves, and any leftover 2181+ named AP accounts. The face of the statement of financial position shows one current line. 2140 Customer deposits is an IFRS 15 contract liability (current), listed next to trade payables — it is not mixed into AP leaves.',
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
      body: 'A single performance obligation is assumed per sales invoice. Cash received before issue is credited to 2140 Customer deposits (contract liability) and recognised as revenue when the invoice is issued. Multi-element contracts, variable consideration, and principal-versus-agent assessments are not modelled automatically.',
    },
    {
      title: 'Inventories (IAS 2 — simplified)',
      body: 'Inventories are carried at cost on 1140. When a sales invoice is issued for goods with a known stock unit cost, that cost is recognised in 5100 and inventory is relieved. If unit cost is unknown or zero, COGS is not posted. NRV, the retail method, and a standard-costing engine are not modelled.',
    },
    {
      title: 'Property, plant and equipment (IAS 16 — simplified)',
      body: 'Cost model. Straight-line depreciation. Disposal derecognises cost and accumulated depreciation, books proceeds, and recognises the gain or loss in profit or loss. Componentisation and revaluation are not automated.',
    },
    {
      title: 'Financial instruments (IFRS 9 — simplified)',
      body: 'Trade receivables and payables are recognised at transaction price. Expected credit losses are measured on the ECL worksheet (Finance → ECL) using management aging rates and posted to 1135 / 6820. Fair-value instruments are not automated.',
    },
    {
      title: 'Statement of cash flows (IAS 7)',
      body: 'Cash flows are presented using the direct method from movements on cash and bank GL accounts, classified as operating, investing, or financing from the opposite journal lines.',
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
      netOperating: pair(ias7Cur.netOperating, ias7Prior.netOperating),
      netInvesting: pair(ias7Cur.netInvesting, ias7Prior.netInvesting),
      netFinancing: pair(ias7Cur.netFinancing, ias7Prior.netFinancing),
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
      basis: GAAP_DISCLAIMER_SHORT,
      unaudited: true,
      journalCount: asAtCurrentT.entry_count,
      warning: warning || lineWarn,
    },
  };
}
