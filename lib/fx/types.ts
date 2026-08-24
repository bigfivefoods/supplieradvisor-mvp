/** Live FX helpers for global multi-currency trade */

export type FxRatesPayload = {
  base: string;
  date: string | null;
  rates: Record<string, number>;
  /** Source API label */
  source: string;
  /** Server ISO timestamp when fetched */
  fetchedAt: string;
  /** True when using last-known / static fallback */
  stale?: boolean;
  warning?: string;
};

/** Common trade currencies for SA / Africa / global */
export const TRADE_CURRENCIES = [
  'ZAR',
  'USD',
  'EUR',
  'GBP',
  'KES',
  'NAD',
  'BWP',
  'ZMW',
  'MZN',
  'NGN',
  'AED',
  'CNY',
] as const;

export function convertAmount(
  amount: number,
  from: string,
  to: string,
  ratesUsd: Record<string, number>
): number | null {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return amount;
  // rates are USD → currency (how many units of currency per 1 USD)
  const fromPerUsd = f === 'USD' ? 1 : ratesUsd[f];
  const toPerUsd = t === 'USD' ? 1 : ratesUsd[t];
  if (!fromPerUsd || !toPerUsd) return null;
  // amount_from / fromPerUsd = USD, * toPerUsd = to
  return (amount / fromPerUsd) * toPerUsd;
}

export function formatFxRate(from: string, to: string, rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return '—';
  const decimals = rate >= 100 ? 2 : rate >= 1 ? 4 : 6;
  return `1 ${from} = ${rate.toFixed(decimals)} ${to}`;
}

/** FX strip display — majors quoted in ZAR only. */
export const ZAR_DISPLAY_PAIRS = ['USD', 'GBP', 'EUR'] as const;

/** Units of ZAR per 1 unit of `from`, given USD-based rates. */
export function rateToZar(
  from: string,
  ratesUsd: Record<string, number>
): number | null {
  const f = from.toUpperCase();
  const zarPerUsd = ratesUsd.ZAR;
  if (zarPerUsd == null || !Number.isFinite(zarPerUsd) || zarPerUsd <= 0) return null;
  if (f === 'ZAR') return 1;
  if (f === 'USD') return zarPerUsd;
  const fromPerUsd = ratesUsd[f];
  if (fromPerUsd == null || !Number.isFinite(fromPerUsd) || fromPerUsd <= 0) return null;
  return zarPerUsd / fromPerUsd;
}

/** e.g. USD:ZAR (1:18.4521) */
export function formatZarPair(from: string, rate: number | null): string {
  const code = from.toUpperCase();
  if (rate == null || !Number.isFinite(rate)) return `${code}:ZAR (1:—)`;
  const decimals = rate >= 100 ? 2 : rate >= 1 ? 4 : 6;
  return `${code}:ZAR (1:${rate.toFixed(decimals)})`;
}
