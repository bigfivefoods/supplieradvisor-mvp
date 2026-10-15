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

function calendarDay(text: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return text;
}

/** Africa/Johannesburg calendar date. SAST is UTC+2 all year. Impossible days such as 2026-02-30 are null. */
export function sastDate(value: string | Date | null | undefined): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return shiftSast(value.toISOString());
  }
  const text = String(value).trim();
  const leading = /^(\d{4}-\d{2}-\d{2})(T.*)?$/.exec(text);
  if (leading) {
    if (!calendarDay(leading[1])) return null;
    if (!leading[2]) return leading[1];
  }
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
function groupedDigits(body: string, separator: ',' | '.'): string | null {
  const parts = body.split(separator);
  if (parts.some((part) => part.length === 0)) return null;
  if (parts.length === 1) return /^\d+$/.test(parts[0]) ? parts[0] : null;
  if (!/^\d{1,3}$/.test(parts[0])) return null;
  if (!parts.slice(1).every((part) => /^\d{3}$/.test(part))) return null;
  return parts.join('');
}

export function centsFromRand(value: number | string): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return centsFromRand(value.toFixed(8));
  }
  let raw = String(value).trim().replace(/[\s\u00a0\u202f]/g, '');
  if (!raw) return null;
  const negative = raw.startsWith('-');
  if (negative) raw = raw.slice(1);
  if (!raw || raw.includes('-') || raw.includes('+')) return null;
  const commas = raw.split(',').length - 1;
  const dots = raw.split('.').length - 1;
  let whole = raw;
  let frac = '';
  if (commas > 0 && dots > 0) {
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const groupSep = decimalSep === ',' ? '.' : ',';
    const splitAt = raw.lastIndexOf(decimalSep);
    const grouped = groupedDigits(raw.slice(0, splitAt), groupSep);
    const tail = raw.slice(splitAt + 1);
    if (grouped == null || !/^\d+$/.test(tail)) return null;
    whole = grouped;
    frac = tail;
  } else if (commas === 1) {
    const splitAt = raw.indexOf(',');
    const tail = raw.slice(splitAt + 1);
    const head = raw.slice(0, splitAt);
    if (/^\d+$/.test(head) && /^\d{1,2}$/.test(tail)) {
      whole = head;
      frac = tail;
    } else {
      const grouped = groupedDigits(raw, ',');
      if (grouped == null) return null;
      whole = grouped;
    }
  } else if (commas > 1) {
    const grouped = groupedDigits(raw, ',');
    if (grouped == null) return null;
    whole = grouped;
  } else if (dots > 1) {
    const grouped = groupedDigits(raw, '.');
    if (grouped == null) return null;
    whole = grouped;
  } else if (dots === 1) {
    const [head, tail] = raw.split('.');
    if (!/^\d+$/.test(head) || !/^\d+$/.test(tail)) return null;
    whole = head;
    frac = tail;
  } else if (!/^\d+$/.test(raw)) {
    return null;
  }
  const padded = frac.padEnd(3, '0');
  let cents = Number(whole) * 100 + Number(padded.slice(0, 2));
  if (Number(padded[2] || '0') >= 5) cents += 1;
  if (!Number.isSafeInteger(cents)) return null;
  const signed = (negative ? -1 : 1) * cents;
  return signed === 0 ? 0 : signed;
}

export function randFromCents(cents: number | null | undefined): number | null {
  if (cents == null || !Number.isFinite(cents)) return null;
  return cents / 100;
}
