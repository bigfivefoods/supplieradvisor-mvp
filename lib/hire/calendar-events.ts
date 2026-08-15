import type { ScheduleEvent } from '@/components/schedule/PracticeScheduleCalendar';
import type { HireBooking, HiregraphStore } from '@/lib/hire/hiregraph';
import { bookingOccupies, eachDate } from '@/lib/hire/availability';

const TONES = [
  'teal',
  'sky',
  'emerald',
  'amber',
  'indigo',
  'violet',
] as const;

export function hireBookingsToScheduleEvents(
  store: HiregraphStore,
  categoryId?: string | null
): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];
  const cats = [...new Set(store.items.map((i) => i.category_id).filter(Boolean))];
  const toneOf = (cat?: string | null) =>
    TONES[Math.max(0, cats.indexOf(String(cat || ''))) % TONES.length];

  for (const b of store.bookings) {
    if (categoryId && String(b.category_id || '') !== categoryId) continue;
    const item = store.items.find((i) => i.id === b.item_id);
    const cat = b.category_id || item?.category_id;
    const dates = eachDate(b.start_date, b.end_date);
    if (!dates.length) continue;
    for (const date of dates) {
      events.push({
        id: `${b.id}:${date}`,
        date,
        start_time: '08:00',
        duration_min: 600,
        title: b.item_title || item?.title || b.code,
        subtitle: b.customer_name || b.status,
        person_name: b.customer_name,
        status: String(b.status || ''),
        meta: bookingOccupies(b) ? 'Hired' : String(b.status || ''),
        tone: toneOf(cat),
      });
    }
  }
  return events;
}

export function bookingFromEventId(
  store: HiregraphStore,
  eventId: string
): HireBooking | null {
  const id = String(eventId).split(':')[0];
  return store.bookings.find((b) => b.id === id) || null;
}
