/**
 * Statistical ML forecasting for demand / revenue series.
 * Ensemble: linear regression trend + Holt linear exponential smoothing.
 * Produces point forecasts + simple confidence bands (residual RMSE).
 */

export type SeriesPoint = { t: string; y: number };

export type ForecastHorizonPoint = {
  period: string;
  forecast: number;
  lower: number;
  upper: number;
  model: string;
};

export type ForecastResult = {
  history: SeriesPoint[];
  horizon: ForecastHorizonPoint[];
  metrics: {
    n: number;
    mean: number;
    rmse: number;
    mape: number | null;
    r2: number | null;
    slope: number;
    intercept: number;
    trend: 'up' | 'down' | 'flat';
    method: string;
  };
  insight: string;
};

function mean(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function linearRegression(ys: number[]): { slope: number; intercept: number; r2: number } {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0 };
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += ys[i];
    sumXY += i * ys[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX || 1;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const yBar = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * i;
    ssTot += (ys[i] - yBar) ** 2;
    ssRes += (ys[i] - pred) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { slope, intercept, r2 };
}

/** Holt linear (double exponential smoothing) one-step recursive */
function holtSmooth(ys: number[], alpha = 0.4, beta = 0.2): { level: number; trend: number; fitted: number[] } {
  if (!ys.length) return { level: 0, trend: 0, fitted: [] };
  let level = ys[0];
  let trend = ys.length > 1 ? ys[1] - ys[0] : 0;
  const fitted: number[] = [level];
  for (let i = 1; i < ys.length; i++) {
    const prevLevel = level;
    level = alpha * ys[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    fitted.push(level + trend);
  }
  return { level, trend, fitted };
}

function nextPeriodLabel(last: string, index: number): string {
  // Try YYYY-MM
  const m = /^(\d{4})-(\d{2})$/.exec(last);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1 + index, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  // Try ISO date — add weeks
  const dt = new Date(last);
  if (!Number.isNaN(dt.getTime())) {
    dt.setDate(dt.getDate() + 7 * index);
    return dt.toISOString().slice(0, 10);
  }
  return `t+${index}`;
}

/**
 * Build forecast from ordered history (oldest → newest).
 * @param history series points
 * @param periods ahead (1–12)
 */
export function forecastSeries(
  history: SeriesPoint[],
  periods = 6
): ForecastResult {
  const clean = history
    .filter((p) => p && Number.isFinite(p.y))
    .map((p) => ({ t: String(p.t), y: Math.max(0, Number(p.y)) }));

  const ys = clean.map((p) => p.y);
  const n = ys.length;
  const h = Math.min(12, Math.max(1, periods));

  if (n === 0) {
    return {
      history: [],
      horizon: Array.from({ length: h }, (_, i) => ({
        period: `t+${i + 1}`,
        forecast: 0,
        lower: 0,
        upper: 0,
        model: 'empty',
      })),
      metrics: {
        n: 0,
        mean: 0,
        rmse: 0,
        mape: null,
        r2: null,
        slope: 0,
        intercept: 0,
        trend: 'flat',
        method: 'none',
      },
      insight: 'Not enough history — record sales/POs to unlock forecasts.',
    };
  }

  const { slope, intercept, r2 } = linearRegression(ys);
  const holt = holtSmooth(ys);
  const yBar = mean(ys);

  // In-sample residuals for ensemble average of LR + Holt fitted
  const residuals: number[] = [];
  let absPct = 0;
  let absPctN = 0;
  for (let i = 0; i < n; i++) {
    const lr = intercept + slope * i;
    const ht = holt.fitted[i] ?? lr;
    const ens = 0.55 * lr + 0.45 * ht;
    const err = ys[i] - ens;
    residuals.push(err);
    if (ys[i] !== 0) {
      absPct += Math.abs(err / ys[i]);
      absPctN += 1;
    }
  }
  const rmse = Math.sqrt(mean(residuals.map((e) => e * e)));
  const mape = absPctN ? (absPct / absPctN) * 100 : null;

  const lastLabel = clean[n - 1].t;
  const horizon: ForecastHorizonPoint[] = [];
  for (let k = 1; k <= h; k++) {
    const lr = intercept + slope * (n - 1 + k);
    const ht = holt.level + holt.trend * k;
    let forecast = Math.max(0, 0.55 * lr + 0.45 * ht);
    // damp extreme growth
    if (yBar > 0 && forecast > yBar * 5) forecast = yBar * 5;
    const band = 1.96 * rmse * Math.sqrt(1 + k / Math.max(n, 1));
    horizon.push({
      period: nextPeriodLabel(lastLabel, k),
      forecast: Math.round(forecast * 100) / 100,
      lower: Math.max(0, Math.round((forecast - band) * 100) / 100),
      upper: Math.round((forecast + band) * 100) / 100,
      model: 'ensemble_lr_holt',
    });
  }

  const slopeNorm = yBar > 0 ? slope / yBar : slope;
  const trend: 'up' | 'down' | 'flat' =
    slopeNorm > 0.02 ? 'up' : slopeNorm < -0.02 ? 'down' : 'flat';

  const lastH = horizon[horizon.length - 1];
  const change =
    yBar > 0 && lastH ? ((lastH.forecast - yBar) / yBar) * 100 : 0;

  let insight = `Ensemble forecast (${n} points): trend ${trend}`;
  if (lastH) {
    insight += `, horizon end ≈ ${lastH.forecast.toLocaleString()} (${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs mean)`;
  }
  if (mape != null) insight += `. MAPE ≈ ${mape.toFixed(1)}%`;
  if (r2 != null) insight += `, R² ≈ ${(r2 * 100).toFixed(0)}%`;

  return {
    history: clean,
    horizon,
    metrics: {
      n,
      mean: Math.round(yBar * 100) / 100,
      rmse: Math.round(rmse * 100) / 100,
      mape: mape != null ? Math.round(mape * 10) / 10 : null,
      r2: Math.round(r2 * 1000) / 1000,
      slope: Math.round(slope * 1000) / 1000,
      intercept: Math.round(intercept * 100) / 100,
      trend,
      method: 'ensemble_linear_regression_holt',
    },
    insight,
  };
}

/** Aggregate sparse dated amounts into monthly series */
export function toMonthlySeries(
  rows: { date: string; amount: number }[]
): SeriesPoint[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = new Date(r.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) || 0) + Number(r.amount || 0));
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([t, y]) => ({ t, y }));
}
