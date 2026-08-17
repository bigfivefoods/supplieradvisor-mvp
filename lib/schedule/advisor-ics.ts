/**
 * ICS (iCalendar) generation — Outlook/Google as mirrors; SA remains system of record.
 */

export type IcsEvent = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  date: string;
  /** Inclusive end date when the event spans more than one day */
  end_date?: string | null;
  start_time: string;
  end_time?: string | null;
  duration_min?: number | null;
  url?: string;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toIcsLocal(date: string, time: string): string {
  const d = date.replace(/-/g, '').slice(0, 8);
  const t = time.replace(':', '').slice(0, 4).padEnd(4, '0');
  return `${d}T${t}00`;
}

function endFromStart(
  date: string,
  start_time: string,
  end_time?: string | null,
  duration_min?: number | null
): string {
  if (end_time) return toIcsLocal(date, end_time);
  const [h, m] = start_time.slice(0, 5).split(':').map(Number);
  const dur = Number(duration_min);
  const add = Number.isFinite(dur) && dur > 0 ? dur : 45;
  const total = (h || 0) * 60 + (m || 0) + add;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return toIcsLocal(date, `${pad(eh)}:${pad(em)}`);
}

function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    parts.push((i === 0 ? '' : ' ') + line.slice(i, i + (i === 0 ? 75 : 74)));
    i += i === 0 ? 75 : 74;
  }
  return parts.join('\r\n');
}

function escapeText(s: string): string {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function buildIcsCalendar(
  events: IcsEvent[],
  opts?: { calName?: string; prodId?: string }
): string {
  const name = opts?.calName || 'SupplierAdvisor';
  const prod = opts?.prodId || '-//SupplierAdvisor//Advisor Diary//EN';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prod}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:${escapeText(name)}`),
  ];

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

  for (const ev of events) {
    const uid = `${ev.id}@supplieradvisor`;
    const dtStart = toIcsLocal(ev.date, ev.start_time);
    const dtEnd = endFromStart(
      ev.end_date || ev.date,
      ev.start_time,
      ev.end_time,
      ev.duration_min
    );
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(fold(`SUMMARY:${escapeText(ev.title)}`));
    if (ev.description) {
      lines.push(fold(`DESCRIPTION:${escapeText(ev.description)}`));
    }
    if (ev.location) {
      lines.push(fold(`LOCATION:${escapeText(ev.location)}`));
    }
    if (ev.url) {
      lines.push(fold(`URL:${ev.url}`));
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function downloadIcsBrowser(filename: string, icsBody: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([icsBody], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function shiftSlot(
  date: string,
  start_time: string,
  deltaMinutes: number
): { date: string; start_time: string } {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, m] = start_time.slice(0, 5).split(':').map(Number);
  const base = new Date(y, (mo || 1) - 1, d || 1, h || 0, m || 0, 0, 0);
  base.setMinutes(base.getMinutes() + deltaMinutes);
  const nd = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
  const nt = `${pad(base.getHours())}:${pad(base.getMinutes())}`;
  return { date: nd, start_time: nt };
}
