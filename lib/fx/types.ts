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
