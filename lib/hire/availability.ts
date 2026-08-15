/**
 * Hire date math, occupancy, and extend-if-free.
 */
import type { HireBooking, HiregraphStore, HireItem } from '@/lib/hire/hiregraph';

const BLOCKING = new Set([
  'requested',
  'awaiting_requirements',
  'approved',
  'paid',
  'out',
]);

export function parseIsoDate(iso: string | null | undefined): Date | null {
  const s = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

/** Inclusive calendar days between start and end (min 1). */
export function inclusiveDays(
  start?: string | null,
  end?: string | null
): number {
  const a = parseIsoDate(start);
  const b = parseIsoDate(end || start);
  if (!a || !b) return 1;
  const ms = b.getTime() - a.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

export function eachDate(
  start?: string | null,
  end?: string | null
): string[] {
  const a = parseIsoDate(start);
  if (!a) return [];
  const days = inclusiveDays(start, end);
  const out: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(a);
    d.setDate(a.getDate() + i);
    out.push(toIsoDate(d));
  }
  return out;
}

export function unitsFromRange(
  start?: string | null,
  end?: string | null,
  rateUnit?: string | null
): number {
  const days = inclusiveDays(start, end || start);
  const unit = String(rateUnit || 'day').toLowerCase();
  if (unit === 'hour') return Math.max(1, days * 8);
  if (unit === 'week') return Math.max(1, Math.ceil(days / 7));
  if (unit === 'weekend') return Math.max(1, Math.ceil(days / 2));
  return days;
}

export function endFromStartAndUnits(
  start: string,
  units: number,
  rateUnit?: string | null
): string {
  const n = Math.max(1, Math.floor(Number(units) || 1));
  const unit = String(rateUnit || 'day').toLowerCase();
  if (unit === 'week') return addDays(start, n * 7 - 1);
  if (unit === 'hour') return addDays(start, Math.max(1, Math.ceil(n / 8)) - 1);
  if (unit === 'weekend') return addDays(start, n * 2 - 1);
  return addDays(start, n - 1);
}

export function durationLabel(
  start?: string | null,
  end?: string | null,
  units?: number | null,
  rateUnit?: string | null
): string {
  const unit = String(rateUnit || 'day');
  const n =
    start && (end || start)
      ? unitsFromRange(start, end, unit)
      : Math.max(1, Number(units) || 1);
  const plural = n === 1 ? unit : `${unit}s`;
  if (start && end && start !== end) {
    return `${n} ${plural} · ${String(start).slice(0, 10)} → ${String(end).slice(0, 10)}`;
  }
  if (start) return `${n} ${plural} from ${String(start).slice(0, 10)}`;
  return `${n} ${plural}`;
}

export function bookingOccupies(b: Pick<HireBooking, 'status'>): boolean {
  return BLOCKING.has(String(b.status || 'requested'));
}

export function rangesOverlap(
  aStart?: string | null,
  aEnd?: string | null,
  bStart?: string | null,
  bEnd?: string | null
): boolean {
  const as = String(aStart || '').slice(0, 10);
  const ae = String(aEnd || aStart || '').slice(0, 10);
  const bs = String(bStart || '').slice(0, 10);
  const be = String(bEnd || bStart || '').slice(0, 10);
  if (!as || !bs) return false;
  return as <= be && bs <= ae;
}

export function itemConflict(
  store: HiregraphStore,
  opts: {
    itemId: string;
    start?: string | null;
    end?: string | null;
    qty?: number;
    excludeBookingId?: string | null;
  }
): { conflict: boolean; blocking?: HireBooking; used: number; available: number } {
  const item = store.items.find((i) => i.id === opts.itemId);
  const available = Math.max(1, Number(item?.qty_available) || 1);
  const need = Math.max(1, Number(opts.qty) || 1);
  let used = 0;
  let blocking: HireBooking | undefined;
  for (const b of store.bookings) {
    if (b.item_id !== opts.itemId) continue;
    if (opts.excludeBookingId && b.id === opts.excludeBookingId) continue;
    if (!bookingOccupies(b)) continue;
    if (!rangesOverlap(opts.start, opts.end, b.start_date, b.end_date)) continue;
    used += Math.max(1, Number(b.qty) || 1);
    if (!blocking) blocking = b;
  }
  return { conflict: used + need > available, blocking, used, available };
}

export function busyDatesForItem(
  store: HiregraphStore,
  itemId: string,
  excludeBookingId?: string | null
): string[] {
  const dates = new Set<string>();
  for (const b of store.bookings) {
    if (b.item_id !== itemId) continue;
    if (excludeBookingId && b.id === excludeBookingId) continue;
    if (!bookingOccupies(b)) continue;
    for (const d of eachDate(b.start_date, b.end_date)) dates.add(d);
  }
  return [...dates].sort();
}

export function canExtendBooking(
  store: HiregraphStore,
  booking: HireBooking,
  newEnd: string
): { ok: boolean; error?: string; extraUnits: number; item?: HireItem } {
  const item = store.items.find((i) => i.id === booking.item_id);
  if (!item) return { ok: false, error: 'Item not found', extraUnits: 0 };
  const st = String(booking.status || '');
  if (!['approved', 'paid', 'out'].includes(st)) {
    return {
      ok: false,
      extraUnits: 0,
      item,
      error: 'Only approved, paid or out hires can be extended',
    };
  }
  const start = String(booking.start_date || '').slice(0, 10);
  const currentEnd = String(booking.end_date || booking.start_date || '').slice(0, 10);
  const nextEnd = String(newEnd || '').slice(0, 10);
  if (!start || !nextEnd) {
    return { ok: false, extraUnits: 0, item, error: 'Set a new end date' };
  }
  if (nextEnd <= currentEnd) {
    return { ok: false, extraUnits: 0, item, error: 'New end must be after the current end' };
  }
  const gapStart = addDays(currentEnd, 1);
  const clash = itemConflict(store, {
    itemId: booking.item_id,
    start: gapStart,
    end: nextEnd,
    qty: booking.qty || 1,
    excludeBookingId: booking.id,
  });
  if (clash.conflict) {
    return {
      ok: false,
      extraUnits: 0,
      item,
      error: clash.blocking
        ? `Already booked through ${String(clash.blocking.end_date || clash.blocking.start_date).slice(0, 10)}`
        : 'Item is already booked for those extra days',
    };
  }
  const before = unitsFromRange(start, currentEnd, item.rate_unit);
  const after = unitsFromRange(start, nextEnd, item.rate_unit);
  return { ok: true, extraUnits: Math.max(1, after - before), item };
}

export function applyDateUnits(
  raw: {
    start_date?: string | null;
    end_date?: string | null;
    units?: number | null;
  },
  rateUnit?: string | null
): { start_date: string | null; end_date: string | null; units: number } {
  const start = raw.start_date ? String(raw.start_date).slice(0, 10) : null;
  let end = raw.end_date ? String(raw.end_date).slice(0, 10) : null;
  let units = Math.max(1, Number(raw.units) || 1);
  if (start && end) {
    if (end < start) end = start;
    units = unitsFromRange(start, end, rateUnit);
  } else if (start && !end) {
    end = endFromStartAndUnits(start, units, rateUnit);
  }
  return { start_date: start, end_date: end, units };
}
