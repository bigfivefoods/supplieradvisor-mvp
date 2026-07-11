/**
 * Accounting time-series + multi-horizon forecast helpers.
 * Method: linear regression on monthly history with optional non-negativity,
 * residual std-dev bands, and cumulative roll-ups for 1/3/6/9/12 month horizons.
 */

export type MonthBucket = {
  key: string; // YYYY-MM
  label: string; // e.g. Mar 26
  revenue: number;
  cogs: number;
  expenses: number;
  grossProfit: number;
  netIncome: number;
  bankIn: number;
  bankOut: number;
  cashNet: number;
  journalCount: number;
};

export type HorizonKey = 1 | 3 | 6 | 9 | 12;

export type HorizonForecast = {
  months: HorizonKey;
  endLabel: string;
  revenue: number;
  cogs: number;
  expenses: number;
  grossProfit: number;
  netIncome: number;
  cashNet: number;
  /** Average monthly run-rate used in the window */
  avgMonthlyNet: number;
  revenueLow: number;
  revenueHigh: number;
  netLow: number;
  netHigh: number;
};

export type ForecastSeries = {
  labels: string[];
  /** Historical months count */
  historyCount: number;
  revenue: Array<number | null>;
  expenses: Array<number | null>;
  netIncome: Array<number | null>;
  cashNet: Array<number | null>;
  /** Forecast continuation (null for history) */
  revenueForecast: Array<number | null>;
  expensesForecast: Array<number | null>;
  netForecast: Array<number | null>;
  cashForecast: Array<number | null>;
  /** Confidence band around revenue forecast */
  revenueLow: Array<number | null>;
  revenueHigh: Array<number | null>;
};

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[(m || 1) - 1]} ${String(y).slice(2)}`;
}

/** Last `count` calendar months ending at `ref` (inclusive of current month). */
export function trailingMonthKeys(count: number, ref: Date = new Date()): string[] {
  const keys: string[] = [];
  const d = new Date(ref.getFullYear(), ref.getMonth(), 1);
  for (let i = count - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(monthKey(m));
  }
  return keys;
}

/** Next `count` months after `ref` month. */
export function forwardMonthKeys(count: number, ref: Date = new Date()): string[] {
  const keys: string[] = [];
  const d = new Date(ref.getFullYear(), ref.getMonth(), 1);
  for (let i = 1; i <= count; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() + i, 1);
    keys.push(monthKey(m));
  }
  return keys;
}

export function emptyBucket(key: string): MonthBucket {
  return {
    key,
    label: monthLabel(key),
    revenue: 0,
    cogs: 0,
    expenses: 0,
    grossProfit: 0,
    netIncome: 0,
    bankIn: 0,
    bankOut: 0,
    cashNet: 0,
    journalCount: 0,
  };
}

/**
 * Ordinary least squares linear regression y = a + b*x on indices 0..n-1.
 * Returns per-step forecasts for `ahead` periods after the series.
 */
export function linearProject(
  history: number[],
  ahead: number,
  opts?: { nonNegative?: boolean }
): { points: number[]; a: number; b: number; residualStd: number } {
  const n = history.length;
  const nonNegative = opts?.nonNegative ?? true;

  if (n === 0) {
    return { points: Array(ahead).fill(0), a: 0, b: 0, residualStd: 0 };
  }
  if (n === 1) {
    const v = nonNegative ? Math.max(0, history[0]) : history[0];
    return { points: Array(ahead).fill(round2(v)), a: v, b: 0, residualStd: 0 };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += history[i];
    sumXY += i * history[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  const b = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const a = (sumY - b * sumX) / n;

  let sse = 0;
  for (let i = 0; i < n; i++) {
    const err = history[i] - (a + b * i);
    sse += err * err;
  }
  const residualStd = Math.sqrt(sse / Math.max(1, n - 2));

  const points = Array.from({ length: ahead }, (_, k) => {
    let y = a + b * (n + k);
    if (nonNegative) y = Math.max(0, y);
    return round2(y);
  });

  return { points, a, b, residualStd: round2(residualStd) };
}

/** Blend trend with trailing average so sparse noisy data doesn't explode. */
export function blendedProject(
  history: number[],
  ahead: number,
  opts?: { nonNegative?: boolean; blend?: number }
): { points: number[]; residualStd: number; slope: number; avg: number } {
  const blend = opts?.blend ?? 0.65;
  const nonNegative = opts?.nonNegative ?? true;
  const n = history.length;
  const avg = n ? history.reduce((s, v) => s + v, 0) / n : 0;
  const recent = n >= 3 ? history.slice(-3).reduce((s, v) => s + v, 0) / 3 : avg;
  const { points: trend, b, residualStd } = linearProject(history, ahead, { nonNegative });

  const points = trend.map((t, i) => {
    // Slight mean-reversion toward recent average as horizon grows
    const weight = blend * Math.pow(0.96, i);
    let y = weight * t + (1 - weight) * recent;
    if (nonNegative) y = Math.max(0, y);
    return round2(y);
  });

  return { points, residualStd, slope: round2(b), avg: round2(avg) };
}

export function buildForecastSeries(
  history: MonthBucket[],
  horizons: HorizonKey[] = [1, 3, 6, 9, 12]
): { series: ForecastSeries; horizons: HorizonForecast[]; method: string } {
  const maxH = Math.max(...horizons);
  const revH = history.map((h) => h.revenue);
  const cogsH = history.map((h) => h.cogs);
  const expH = history.map((h) => h.expenses);
  const cashH = history.map((h) => h.cashNet);

  const revF = blendedProject(revH, maxH, { nonNegative: true });
  const cogsF = blendedProject(cogsH, maxH, { nonNegative: true });
  const expF = blendedProject(expH, maxH, { nonNegative: true });
  // Cash can be negative — allow signed forecasts
  const cashF = blendedProject(cashH, maxH, { nonNegative: false, blend: 0.55 });

  const netPoints = revF.points.map((r, i) => round2(r - cogsF.points[i] - expF.points[i]));

  const histLabels = history.map((h) => h.label);
  const fwdKeys = forwardMonthKeys(maxH);
  const fwdLabels = fwdKeys.map(monthLabel);

  const padNull = (arr: number[]) => [
    ...history.map(() => null as number | null),
    ...arr.map((v) => v as number | null),
  ];
  const histOnly = (arr: number[]) => [
    ...arr.map((v) => v as number | null),
    ...Array(maxH).fill(null),
  ];

  // Bridge: last historical value on forecast series so the line connects
  const bridge = <T extends number>(hist: number[], forecast: number[]): Array<number | null> => {
    const out: Array<number | null> = history.map(() => null);
    if (hist.length) out[hist.length - 1] = hist[hist.length - 1];
    for (let i = 0; i < forecast.length; i++) out.push(forecast[i]);
    return out;
  };

  const z = 1.28; // ~80% band
  const revLow = revF.points.map((v, i) =>
    round2(Math.max(0, v - z * revF.residualStd * (1 + i * 0.08)))
  );
  const revHigh = revF.points.map((v, i) =>
    round2(v + z * revF.residualStd * (1 + i * 0.08))
  );

  const series: ForecastSeries = {
    labels: [...histLabels, ...fwdLabels],
    historyCount: history.length,
    revenue: histOnly(revH),
    expenses: histOnly(expH),
    netIncome: histOnly(history.map((h) => h.netIncome)),
    cashNet: histOnly(cashH),
    revenueForecast: bridge(revH, revF.points),
    expensesForecast: bridge(expH, expF.points),
    netForecast: bridge(
      history.map((h) => h.netIncome),
      netPoints
    ),
    cashForecast: bridge(cashH, cashF.points),
    revenueLow: padNull(revLow),
    revenueHigh: padNull(revHigh),
  };

  const horizonRows: HorizonForecast[] = horizons.map((months) => {
    const slice = (arr: number[]) => arr.slice(0, months);
    const sum = (arr: number[]) => round2(arr.reduce((s, v) => s + v, 0));
    const rev = sum(slice(revF.points));
    const cogs = sum(slice(cogsF.points));
    const expenses = sum(slice(expF.points));
    const cashNet = sum(slice(cashF.points));
    const grossProfit = round2(rev - cogs);
    const netIncome = round2(grossProfit - expenses);
    const revL = sum(slice(revLow));
    const revHi = sum(slice(revHigh));
    const netBand = z * (revF.residualStd + expF.residualStd) * Math.sqrt(months);

    return {
      months,
      endLabel: fwdLabels[months - 1] || monthLabel(fwdKeys[months - 1]),
      revenue: rev,
      cogs,
      expenses,
      grossProfit,
      netIncome,
      cashNet,
      avgMonthlyNet: round2(netIncome / months),
      revenueLow: revL,
      revenueHigh: revHi,
      netLow: round2(netIncome - netBand),
      netHigh: round2(netIncome + netBand),
    };
  });

  const method =
    'Blended linear trend + trailing 3-month average on posted monthly P&L and bank cash. ' +
    'Horizons sum monthly projections. Bands use residual std-dev (~80% interval, widens with horizon). ' +
    'Not a guarantee — use for planning alongside budgets and known contracts.';

  return { series, horizons: horizonRows, method };
}

export function finalizeBuckets(map: Map<string, MonthBucket>, keys: string[]): MonthBucket[] {
  return keys.map((key) => {
    const b = map.get(key) || emptyBucket(key);
    b.grossProfit = round2(b.revenue - b.cogs);
    b.netIncome = round2(b.grossProfit - b.expenses);
    b.cashNet = round2(b.bankIn - b.bankOut);
    b.revenue = round2(b.revenue);
    b.cogs = round2(b.cogs);
    b.expenses = round2(b.expenses);
    b.bankIn = round2(b.bankIn);
    b.bankOut = round2(b.bankOut);
    return b;
  });
}
