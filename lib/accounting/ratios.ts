/**
 * Leading financial / accounting ratios for board-style reporting.
 * Pure helpers — feed with period P&L, BS, AR/AP, cash series.
 */

export type RatioTone = 'good' | 'warn' | 'bad' | 'neutral';

export type RatioCard = {
  id: string;
  label: string;
  value: string;
  raw: number | null;
  unit?: string;
  hint: string;
  tone: RatioTone;
  group: 'profitability' | 'liquidity' | 'leverage' | 'efficiency' | 'growth';
};

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function ratio(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function safeDiv(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(b) < 1e-9) return null;
  return a / b;
}

function toneMargin(m: number | null, good = 15, warn = 5): RatioTone {
  if (m == null) return 'neutral';
  if (m >= good) return 'good';
  if (m >= warn) return 'warn';
  return 'bad';
}

function toneCurrent(r: number | null): RatioTone {
  if (r == null) return 'neutral';
  if (r >= 1.5) return 'good';
  if (r >= 1) return 'warn';
  return 'bad';
}

function toneGrowth(g: number | null): RatioTone {
  if (g == null) return 'neutral';
  if (g >= 5) return 'good';
  if (g >= -2) return 'neutral';
  return 'warn';
}

export type RatioInputs = {
  revenue?: number;
  cogs?: number;
  expenses?: number;
  grossProfit?: number;
  netIncome?: number;
  operatingProfit?: number;
  assets?: number;
  liabilities?: number;
  equity?: number;
  arOpen?: number;
  apOpen?: number;
  cashNet?: number;
  bankIn?: number;
  bankOut?: number;
  /** Monthly revenue series (oldest → newest) for growth */
  revenueSeries?: number[];
  expenseSeries?: number[];
  netSeries?: number[];
  cashSeries?: number[];
};

/** Build a full set of leading ratios from available figures. */
export function buildAccountingRatios(input: RatioInputs): RatioCard[] {
  const rev = Number(input.revenue || 0);
  const cogs = Number(input.cogs || 0);
  const exp = Number(input.expenses || 0);
  const gp =
    input.grossProfit != null ? Number(input.grossProfit) : rev - cogs;
  const ni =
    input.netIncome != null
      ? Number(input.netIncome)
      : input.operatingProfit != null
        ? Number(input.operatingProfit)
        : gp - exp;
  const op =
    input.operatingProfit != null ? Number(input.operatingProfit) : ni;

  const grossMargin = safeDiv(gp, rev);
  const netMargin = safeDiv(ni, rev);
  const opMargin = safeDiv(op, rev);
  const expenseRatio = safeDiv(exp, rev);
  const cogsRatio = safeDiv(cogs, rev);

  const assets = Number(input.assets || 0);
  const liabilities = Number(input.liabilities || 0);
  const equity = Number(input.equity || 0);
  const ar = Number(input.arOpen || 0);
  const ap = Number(input.apOpen || 0);
  const cashNet = Number(input.cashNet || 0);
  const bankIn = Number(input.bankIn || 0);
  const bankOut = Number(input.bankOut || 0);

  // Liquidity proxies when full current assets not available
  const currentAssetsProxy = assets > 0 ? assets : ar + Math.max(0, cashNet);
  const currentLiabProxy = liabilities > 0 ? liabilities : ap;
  const currentRatio = safeDiv(currentAssetsProxy, currentLiabProxy);
  // Quick ≈ (AR + cash proxy) / AP or CL
  const quickRatio = safeDiv(ar + Math.max(0, bankIn - bankOut), currentLiabProxy || ap || 1);
  const workingCapital = currentAssetsProxy - currentLiabProxy;
  const debtToEquity = safeDiv(liabilities, equity || Math.max(equity, 1e-6));
  const roa = safeDiv(ni, assets);
  const roe = safeDiv(ni, equity);

  // Growth: last vs prior month (or half-series avg)
  const revS = input.revenueSeries || [];
  let revGrowth: number | null = null;
  if (revS.length >= 2) {
    const last = revS[revS.length - 1];
    const prev = revS[revS.length - 2];
    revGrowth = safeDiv(last - prev, Math.abs(prev) < 1e-6 ? 1 : prev);
    if (revGrowth != null) revGrowth *= 100;
  }
  const netS = input.netSeries || [];
  let netGrowth: number | null = null;
  if (netS.length >= 2) {
    const last = netS[netS.length - 1];
    const prev = netS[netS.length - 2];
    netGrowth = safeDiv(last - prev, Math.abs(prev) < 1e-6 ? 1 : Math.abs(prev));
    if (netGrowth != null) netGrowth *= 100;
  }

  // Cash burn / coverage
  const burn = bankOut - bankIn;
  const cashCoverMonths =
    burn > 0 && bankIn > 0 ? safeDiv(Math.max(0, bankIn), burn / Math.max(1, revS.length || 1)) : null;

  const cards: RatioCard[] = [
    {
      id: 'gross_margin',
      label: 'Gross margin',
      value: pct(grossMargin != null ? grossMargin * 100 : null),
      raw: grossMargin != null ? grossMargin * 100 : null,
      unit: '%',
      hint: 'Gross profit ÷ revenue',
      tone: toneMargin(grossMargin != null ? grossMargin * 100 : null, 30, 15),
      group: 'profitability',
    },
    {
      id: 'op_margin',
      label: 'Operating margin',
      value: pct(opMargin != null ? opMargin * 100 : null),
      raw: opMargin != null ? opMargin * 100 : null,
      unit: '%',
      hint: 'Operating profit ÷ revenue',
      tone: toneMargin(opMargin != null ? opMargin * 100 : null, 12, 3),
      group: 'profitability',
    },
    {
      id: 'net_margin',
      label: 'Net margin',
      value: pct(netMargin != null ? netMargin * 100 : null),
      raw: netMargin != null ? netMargin * 100 : null,
      unit: '%',
      hint: 'Net income ÷ revenue',
      tone: toneMargin(netMargin != null ? netMargin * 100 : null, 10, 2),
      group: 'profitability',
    },
    {
      id: 'expense_ratio',
      label: 'Expense ratio',
      value: pct(expenseRatio != null ? expenseRatio * 100 : null),
      raw: expenseRatio != null ? expenseRatio * 100 : null,
      unit: '%',
      hint: 'OpEx ÷ revenue (lower is better)',
      tone:
        expenseRatio == null
          ? 'neutral'
          : expenseRatio <= 0.5
            ? 'good'
            : expenseRatio <= 0.75
              ? 'warn'
              : 'bad',
      group: 'efficiency',
    },
    {
      id: 'cogs_ratio',
      label: 'COGS ratio',
      value: pct(cogsRatio != null ? cogsRatio * 100 : null),
      raw: cogsRatio != null ? cogsRatio * 100 : null,
      unit: '%',
      hint: 'Cost of sales ÷ revenue',
      tone:
        cogsRatio == null
          ? 'neutral'
          : cogsRatio <= 0.55
            ? 'good'
            : cogsRatio <= 0.75
              ? 'warn'
              : 'bad',
      group: 'efficiency',
    },
    {
      id: 'current_ratio',
      label: 'Current ratio',
      value: ratio(currentRatio),
      raw: currentRatio,
      hint: 'Assets ÷ liabilities (proxy if full BS)',
      tone: toneCurrent(currentRatio),
      group: 'liquidity',
    },
    {
      id: 'quick_ratio',
      label: 'Quick ratio',
      value: ratio(quickRatio),
      raw: quickRatio,
      hint: '(AR + cash flow proxy) ÷ liabilities',
      tone: toneCurrent(quickRatio),
      group: 'liquidity',
    },
    {
      id: 'working_capital',
      label: 'Working capital',
      value:
        workingCapital != null && Number.isFinite(workingCapital)
          ? Math.round(workingCapital).toLocaleString()
          : '—',
      raw: workingCapital,
      hint: 'Current assets − current liabilities (proxy)',
      tone: workingCapital >= 0 ? 'good' : 'bad',
      group: 'liquidity',
    },
    {
      id: 'debt_equity',
      label: 'Debt / equity',
      value: ratio(debtToEquity),
      raw: debtToEquity,
      hint: 'Liabilities ÷ equity',
      tone:
        debtToEquity == null
          ? 'neutral'
          : debtToEquity <= 1
            ? 'good'
            : debtToEquity <= 2
              ? 'warn'
              : 'bad',
      group: 'leverage',
    },
    {
      id: 'roa',
      label: 'ROA',
      value: pct(roa != null ? roa * 100 : null),
      raw: roa != null ? roa * 100 : null,
      unit: '%',
      hint: 'Net income ÷ assets',
      tone: toneMargin(roa != null ? roa * 100 : null, 8, 2),
      group: 'profitability',
    },
    {
      id: 'roe',
      label: 'ROE',
      value: pct(roe != null ? roe * 100 : null),
      raw: roe != null ? roe * 100 : null,
      unit: '%',
      hint: 'Net income ÷ equity',
      tone: toneMargin(roe != null ? roe * 100 : null, 12, 4),
      group: 'profitability',
    },
    {
      id: 'rev_growth',
      label: 'Rev growth MoM',
      value: pct(revGrowth),
      raw: revGrowth,
      unit: '%',
      hint: 'Last month vs prior month revenue',
      tone: toneGrowth(revGrowth),
      group: 'growth',
    },
    {
      id: 'net_growth',
      label: 'Net growth MoM',
      value: pct(netGrowth),
      raw: netGrowth,
      unit: '%',
      hint: 'Last month vs prior month net income',
      tone: toneGrowth(netGrowth),
      group: 'growth',
    },
    {
      id: 'ar_ap',
      label: 'AR / AP',
      value: ratio(safeDiv(ar, ap || 1)),
      raw: safeDiv(ar, ap || 1),
      hint: 'Open receivables ÷ open payables',
      tone:
        ar === 0 && ap === 0
          ? 'neutral'
          : ar >= ap
            ? 'good'
            : 'warn',
      group: 'liquidity',
    },
  ];

  return cards;
}

export function groupRatios(cards: RatioCard[]): Record<string, RatioCard[]> {
  const groups: Record<string, RatioCard[]> = {
    profitability: [],
    liquidity: [],
    leverage: [],
    efficiency: [],
    growth: [],
  };
  for (const c of cards) {
    groups[c.group].push(c);
  }
  return groups;
}
