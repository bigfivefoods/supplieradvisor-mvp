/**
 * Shared money formatting for dashboard / KPI cards.
 * Prefer compact on narrow cards so values fit mobile + tablet.
 */

export type MoneyFormatOpts = {
  /** compact: R1.2M style — better for small cards */
  compact?: boolean;
  maximumFractionDigits?: number;
};

export function formatMoneyDisplay(
  amount: number | null | undefined,
  currency = 'ZAR',
  opts: MoneyFormatOpts = {}
): string {
  const n = Number(amount) || 0;
  const ccy = (currency || 'ZAR').toUpperCase();
  const abs = Math.abs(n);
  const compact =
    opts.compact === true || (opts.compact !== false && abs >= 100_000);

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: ccy,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits:
        opts.maximumFractionDigits ?? (compact ? 1 : abs >= 1000 ? 0 : 2),
      minimumFractionDigits: 0,
    }).format(n);
  } catch {
    if (compact && abs >= 1_000_000) {
      return `${ccy} ${(n / 1_000_000).toFixed(1)}M`;
    }
    if (compact && abs >= 1_000) {
      return `${ccy} ${(n / 1_000).toFixed(1)}k`;
    }
    return `${ccy} ${Math.round(n).toLocaleString()}`;
  }
}
