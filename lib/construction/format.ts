/** Display helpers for ConstructionAdvisor®. Rand stays a rand number. */

export function formatRand(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `R ${Number(value).toLocaleString('en-ZA')}`;
}

/** Calendar date in SAST, `dd MMM yyyy`. */
export function formatSastDate(value?: string | null): string {
  if (!value) return '—';
  const raw = String(value).trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? `${raw}T12:00:00+02:00`
    : raw;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(date);
  const day = parts.find((part) => part.type === 'day')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const year = parts.find((part) => part.type === 'year')?.value;
  if (!day || !month || !year) return '—';
  return `${day} ${month} ${year}`;
}

/** Today's calendar date in South Africa (no daylight saving). */
export function sastToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${Math.round(Number(value))}%`;
}
