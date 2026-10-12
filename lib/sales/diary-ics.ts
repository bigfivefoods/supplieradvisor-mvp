/**
 * Sales diary → iCalendar. SupplierAdvisor stays the record.
 * Google, Apple, and Outlook only mirror this feed.
 */
import { buildIcsCalendar, type IcsEvent } from '@/lib/schedule/advisor-ics';
import type { DiaryEvent } from '@/lib/sales/crm-tasks';

function clip(value: string, max: number) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function diaryEventsToIcs(
  events: DiaryEvent[],
  opts?: { pageUrl?: string; cancelDone?: boolean }
): IcsEvent[] {
  const out: IcsEvent[] = [];
  for (const event of events) {
    if (!event.date || !event.start_time) continue;
    const done = event.meta === 'task' && event.status === 'done';
    if (done && !opts?.cancelDone) continue;
    const kind =
      event.meta === 'close'
        ? 'Expected close'
        : event.meta === 'next'
          ? 'Next step'
          : done
            ? 'Done'
            : 'Task';
    const description = clip([kind, event.subtitle].filter(Boolean).join(' · '), 800);
    out.push({
      id: event.id,
      title: clip(event.title, 200),
      description,
      date: event.date.slice(0, 10),
      start_time: event.start_time,
      end_time: event.end_time,
      url: opts?.pageUrl,
      status: done ? 'CANCELLED' : undefined,
    });
  }
  return out;
}

/** Open diary, plus done tasks marked cancelled when `cancelDone` is set. */
export function salesDiaryIcs(
  events: DiaryEvent[],
  opts: { calName: string; pageUrl?: string; cancelDone?: boolean }
): string {
  const body = buildIcsCalendar(diaryEventsToIcs(events, opts), {
    calName: opts.calName,
    prodId: '-//SupplierAdvisor//Sales Diary//EN',
  });
  return body.replace(
    'END:VCALENDAR',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H\r\nX-PUBLISHED-TTL:PT1H\r\nEND:VCALENDAR'
  );
}
