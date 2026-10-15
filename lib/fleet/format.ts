const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Half away from zero, to `digits` decimal places. */
export function roundHalfAway(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  const signed = value < 0 ? -1 : 1;
  return (signed * Math.round(Math.abs(value) * factor + Number.EPSILON)) / factor;
}

export function formatRandFromCents(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '—';
  const rounded = roundHalfAway(cents, 0);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded) / 100;
  const [whole, frac] = abs.toFixed(2).split('.');
  return `${sign}R${groupThousands(whole)}.${frac}`;
}

/** Rand per kilometre, 2 decimals. Space grouping, same as the rest of the desk. */
export function formatPerKm(randPerKm: number | null | undefined): string {
  if (randPerKm == null || !Number.isFinite(randPerKm)) return '—';
  const rounded = roundHalfAway(randPerKm, 2);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const [whole, frac] = abs.toFixed(2).split('.');
  return `${sign}R${groupThousands(whole)}.${frac}`;
}

function groupThousands(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return '—';
  const rounded = roundHalfAway(km, 1);
  const [whole, frac] = Math.abs(rounded).toFixed(1).split('.');
  const sign = rounded < 0 ? '-' : '';
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac === '0' ? `${sign}${grouped} km` : `${sign}${grouped}.${frac} km`;
}

export function formatLitresPer100(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${roundHalfAway(value, 1).toFixed(1)} L/100 km`;
}

/** Calendar date as `dd MMM yyyy`. Accepts YYYY-MM-DD or an ISO instant (shown in SAST). */
export function formatSastDate(value: string | null | undefined): string {
  const date = sastDate(value);
  if (!date) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return '—';
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return '—';
  return `${Number(match[3])} ${month} ${match[1]}`;
}

/** Africa/Johannesburg calendar date. SAST is UTC+2 all year. */
export function sastDate(value: string | Date | null | undefined): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return shiftSast(value.toISOString());
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return shiftSast(parsed.toISOString());
}

function shiftSast(iso: string): string {
  const ms = new Date(iso).getTime() + 2 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Rand to cents. Parses the decimal text so 1.005 is 101 and 8.325 is 833.
 * Empty, non-numeric, and non-finite values are null, never zero.
 */
export function centsFromRand(value: number | string): number | null {
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  const raw = (typeof value === 'number' ? value.toFixed(8) : String(value)).trim();
  if (!raw) return null;
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const frac = (match[3] || '').padEnd(3, '0');
  let cents = Number(match[2]) * 100 + Number(frac.slice(0, 2));
  if (Number(frac[2] || '0') >= 5) cents += 1;
  if (!Number.isSafeInteger(cents)) return null;
  return sign * cents;
}

export function randFromCents(cents: number | null | undefined): number | null {
  if (cents == null || !Number.isFinite(cents)) return null;
  return cents / 100;
}
