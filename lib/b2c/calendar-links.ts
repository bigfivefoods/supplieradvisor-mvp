/**
 * Add-to-calendar links for SA Member (Google, Outlook, .ics).
 */
import {
  buildIcsCalendar,
  downloadIcsBrowser,
  type IcsEvent,
} from '@/lib/schedule/advisor-ics';

export type CalendarLinkEvent = {
  id: string;
  title: string;
  date: string;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  all_day?: boolean;
  location?: string | null;
  description?: string | null;
  href?: string | null;
};

function ymd(d: string): string {
  return String(d || '').slice(0, 10).replace(/-/g, '');
}

function addDays(date: string, days: number): string {
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function isoLocal(date: string, time: string): string {
  return `${date.slice(0, 10)}T${time.slice(0, 5)}:00`;
}

export function googleCalendarUrl(ev: CalendarLinkEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    details: ev.description || '',
    location: ev.location || '',
  });
  if (ev.all_day || !ev.start_time) {
    const start = ymd(ev.date);
    const end = ymd(addDays(ev.end_date || ev.date, 1));
    params.set('dates', `${start}/${end}`);
  } else {
    const start = isoLocal(ev.date, ev.start_time).replace(/[-:]/g, '');
    const endT = ev.end_time || ev.start_time;
    const endD = ev.end_date || ev.date;
    const end = isoLocal(endD, endT).replace(/[-:]/g, '');
    params.set('dates', `${start}/${end}`);
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(ev: CalendarLinkEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: ev.title,
    body: ev.description || '',
    location: ev.location || '',
  });
  if (ev.all_day || !ev.start_time) {
    params.set('startdt', `${ev.date.slice(0, 10)}T08:00:00`);
    params.set('enddt', `${(ev.end_date || ev.date).slice(0, 10)}T17:00:00`);
  } else {
    params.set('startdt', isoLocal(ev.date, ev.start_time));
    params.set(
      'enddt',
      isoLocal(ev.end_date || ev.date, ev.end_time || ev.start_time)
    );
  }
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function eventToIcs(ev: CalendarLinkEvent): IcsEvent {
  if (ev.all_day || !ev.start_time) {
    return {
      id: ev.id,
      title: ev.title,
      description: ev.description || undefined,
      location: ev.location || undefined,
      date: ev.date.slice(0, 10),
      end_date: ev.end_date ? String(ev.end_date).slice(0, 10) : undefined,
      start_time: '08:00',
      end_time: '17:00',
      url: ev.href || undefined,
    };
  }
  return {
    id: ev.id,
    title: ev.title,
    description: ev.description || undefined,
    location: ev.location || undefined,
    date: ev.date.slice(0, 10),
    end_date: ev.end_date ? String(ev.end_date).slice(0, 10) : undefined,
    start_time: ev.start_time,
    end_time: ev.end_time || undefined,
    url: ev.href || undefined,
  };
}

export function memberCalendarIcs(
  events: CalendarLinkEvent[],
  calName = 'SA Member'
): string {
  return buildIcsCalendar(events.map(eventToIcs), {
    calName,
    prodId: '-//SupplierAdvisor//SA Member//EN',
  });
}

export function downloadMemberEventIcs(ev: CalendarLinkEvent): void {
  downloadIcsBrowser(
    `${ev.title.replace(/\s+/g, '-').slice(0, 40)}.ics`,
    memberCalendarIcs([ev], ev.title)
  );
}

export function downloadMemberCalendarIcs(
  events: CalendarLinkEvent[],
  filename = 'sa-member.ics'
): void {
  downloadIcsBrowser(filename, memberCalendarIcs(events));
}
