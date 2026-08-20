/**
 * Gym-local calendar helpers. UTC `toISOString().slice(0, 10)` is the wrong
 * "today" for Africa/Johannesburg near midnight.
 */

export const GYM_DEFAULT_TZ = 'Africa/Johannesburg';

export function isoDateInZone(
  timeZone: string = GYM_DEFAULT_TZ,
  now: Date = new Date()
): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

export function hmInZone(
  timeZone: string = GYM_DEFAULT_TZ,
  now: Date = new Date()
): string {
  try {
    const raw = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    return raw.replace(/^24:/, '00:');
  } catch {
    return `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
  }
}

export function normalizeHm(raw?: string | null): string {
  const s = String(raw || '').trim();
  const m = s.match(/(\d{1,2})\D(\d{2})/);
  if (!m) return '00:00';
  let h = Number(m[1]);
  if (!Number.isFinite(h)) h = 0;
  if (/p\.?m\.?/i.test(s) && h < 12) h += 12;
  if (/a\.?m\.?/i.test(s) && h === 12) h = 0;
  h = ((h % 24) + 24) % 24;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/** True if this class is still the member's next / upcoming session. */
export function sessionIsUpcoming(
  date: string,
  startTime?: string | null,
  opts?: { timeZone?: string; now?: Date; graceMin?: number }
): boolean {
  const day = String(date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const tz = opts?.timeZone || GYM_DEFAULT_TZ;
  const now = opts?.now || new Date();
  const today = isoDateInZone(tz, now);
  if (day > today) return true;
  if (day < today) return false;
  const start = normalizeHm(startTime);
  const clock = hmInZone(tz, now);
  const grace = Number(opts?.graceMin);
  const graceMin = Number.isFinite(grace) ? grace : 90;
  const startMins =
    Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
  const nowMins = Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
  return nowMins <= startMins + Math.max(0, graceMin);
}
