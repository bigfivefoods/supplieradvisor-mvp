/** Named ceiling so a bad cell cannot become a huge integer. This is not a tariff. */
export const AMOUNT_GUARD_CENTS = 100_000_000_000;

const EARLIEST = '1990-01-01';

/** Calendar date in South Africa, not UTC. */
export function sastToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function normalisePhoneZA(
  input: string
): { ok: true; value: string } | { ok: false; reason: 'empty' | 'junk' } {
  const compact = String(input || '').replace(/[\s\-().]/g, '');
  if (!compact) return { ok: false, reason: 'empty' };
  let digits = compact;
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return { ok: false, reason: 'junk' };
  if (digits.startsWith('27') && digits.length === 11) digits = `0${digits.slice(2)}`;
  if (!/^0\d{9}$/.test(digits)) return { ok: false, reason: 'junk' };
  return { ok: true, value: `+27${digits.slice(1)}` };
}

export function normaliseEmail(
  input: string
): { ok: true; value: string } | { ok: false; reason: 'empty' | 'junk' } {
  const email = String(input || '').trim().toLowerCase();
  if (!email) return { ok: false, reason: 'empty' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return { ok: false, reason: 'junk' };
  }
  return { ok: true, value: email };
}

export function normaliseName(input: string): string {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function parseAmountCents(
  raw: string
): { ok: true; cents: number } | { ok: false; reason: 'empty' | 'negative' | 'scientific' | 'nan' | 'format' | 'guard' } {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: false, reason: 'empty' };
  if (/e/i.test(text)) return { ok: false, reason: 'scientific' };
  if (text.includes('-')) return { ok: false, reason: 'negative' };
  let body = text.replace(/^R\s*/i, '').replace(/\s/g, '');
  if (body.includes(',') && body.includes('.')) {
    if (body.lastIndexOf(',') > body.lastIndexOf('.')) {
      body = body.replace(/\./g, '').replace(',', '.');
    } else {
      body = body.replace(/,/g, '');
    }
  } else if (body.includes(',')) {
    const parts = body.split(',');
    if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2) {
      body = `${parts[0].replace(/\./g, '')}.${parts[1]}`;
    } else {
      body = body.replace(/,/g, '');
    }
  }
  if (!/^\d+(\.\d{1,2})?$/.test(body)) return { ok: false, reason: 'format' };
  const [whole, frac = ''] = body.split('.');
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(cents)) return { ok: false, reason: 'nan' };
  if (cents > AMOUNT_GUARD_CENTS) return { ok: false, reason: 'guard' };
  return { ok: true, cents };
}

export function parseDateStrict(
  raw: string,
  options?: { purpose?: 'default_date' | 'any'; today?: string }
): { ok: true; value: string } | { ok: false; reason: 'empty' | 'format' | 'calendar' | 'future' | 'early' } {
  const text = String(raw || '').trim();
  if (!text) return { ok: false, reason: 'empty' };
  let iso = '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) iso = text;
  else if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [dd, mm, yyyy] = text.split('/');
    iso = `${yyyy}-${mm}-${dd}`;
  } else return { ok: false, reason: 'format' };
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { ok: false, reason: 'calendar' };
  }
  if (options?.purpose === 'default_date') {
    const today = options.today || sastToday();
    if (iso > today) return { ok: false, reason: 'future' };
    if (iso < EARLIEST) return { ok: false, reason: 'early' };
  }
  return { ok: true, value: iso };
}
