/** Integer cents. Gym fees are quoted in rands and stored as cents. */

export function randsToCents(rands: number): number {
  if (!Number.isFinite(rands)) return 0;
  return Math.round(rands * 100);
}

export function centsToRands(cents: number): number {
  return Math.round(cents) / 100;
}

export function formatZar(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const rands = Math.floor(abs / 100);
  const rem = String(abs % 100).padStart(2, '0');
  const grouped = String(rands).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}R ${grouped}.${rem}`;
}

/** Split a VAT-inclusive gross into net + VAT. vatBps 1500 = 15.00%. */
export function splitVatInclusive(
  grossCents: number,
  vatBps: number
): { netCents: number; vatCents: number } {
  const gross = Math.round(grossCents);
  if (gross === 0 || vatBps <= 0) return { netCents: gross, vatCents: 0 };
  const vatCents = Math.round((gross * vatBps) / (10000 + vatBps));
  return { netCents: gross - vatCents, vatCents };
}

export function addVatExclusive(
  netCents: number,
  vatBps: number
): { netCents: number; vatCents: number; grossCents: number } {
  const net = Math.round(netCents);
  const vatCents = vatBps > 0 ? Math.round((net * vatBps) / 10000) : 0;
  return { netCents: net, vatCents, grossCents: net + vatCents };
}

export function applyDiscountBps(grossCents: number, discountBps: number): number {
  const bps = Math.min(10000, Math.max(0, Math.round(discountBps)));
  return Math.round(grossCents) - Math.round((Math.round(grossCents) * bps) / 10000);
}
