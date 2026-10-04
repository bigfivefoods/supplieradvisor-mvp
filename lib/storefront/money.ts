/** Public storefront money — never treat a missing price as R0. */

export function formatStoreMoney(
  amount: number | null | undefined,
  currency = 'ZAR'
): string | null {
  if (amount == null) return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  const code = String(currency || 'ZAR').trim().toUpperCase() || 'ZAR';
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: code.length === 3 ? code : 'ZAR',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${code} ${n.toFixed(2)}`;
  }
}

export function storeLineTotal(
  unit: number | null | undefined,
  qty: number
): number | null {
  if (unit == null || !Number.isFinite(Number(unit))) return null;
  const q = Math.max(0, Number(qty) || 0);
  return Math.round(Number(unit) * q * 100) / 100;
}
