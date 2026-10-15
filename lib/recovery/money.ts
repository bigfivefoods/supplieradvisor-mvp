const zar = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Every RecoverAdvisor® amount uses this en-ZA formatter. Pass cents. */
export function formatRecoverMoney(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '—';
  return zar.format(cents / 100);
}
