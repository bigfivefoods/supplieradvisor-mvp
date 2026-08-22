/**
 * True availability: a physical unit is busy for travel + setup + rental +
 * pack-up + return travel + cleaning — not just the customer rental window.
 */
import { bookingOccupies, parseIsoDate } from '@/lib/hire/availability';
import type {
  HireBooking,
  HireItem,
  HireUnit,
  HiregraphStore,
} from '@/lib/hire/hiregraph';
import { etaMinutesFromKm, roadKm, type LatLng } from '@/lib/inventory/eta';

export type OccupyWindow = {
  occupyStart: Date;
  occupyEnd: Date;
  travelToMin: number;
  travelReturnMin: number;
  setupMin: number;
  packupMin: number;
  cleaningMin: number;
};

function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60_000);
}

function rentalStartOf(b: HireBooking): Date | null {
  if (b.occupy_start_at) {
    const d = new Date(b.occupy_start_at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const day = parseIsoDate(b.start_date);
  if (!day) return null;
  day.setHours(8, 0, 0, 0);
  return day;
}

function rentalEndOf(b: HireBooking): Date | null {
  if (b.occupy_end_at) {
    const d = new Date(b.occupy_end_at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const day = parseIsoDate(b.end_date || b.start_date);
  if (!day) return null;
  day.setHours(18, 0, 0, 0);
  return day;
}

export function buffersFor(item: HireItem | undefined, unit?: HireUnit | null, settings?: HiregraphStore['settings']): {
  setupMin: number;
  packupMin: number;
  cleaningMin: number;
} {
  return {
    setupMin: Number(unit?.setup_minutes ?? item?.setup_minutes ?? settings?.default_setup_minutes) || 0,
    packupMin: Number(unit?.packup_minutes ?? item?.packup_minutes ?? settings?.default_packup_minutes) || 0,
    cleaningMin: Number(unit?.cleaning_minutes ?? item?.cleaning_minutes ?? settings?.default_cleaning_minutes) || 0,
  };
}

export function occupyWindow(opts: {
  rentalStart: Date;
  rentalEnd: Date;
  travelToMin?: number;
  travelReturnMin?: number;
  setupMin?: number;
  packupMin?: number;
  cleaningMin?: number;
}): OccupyWindow {
  const travelToMin = Math.max(0, Number(opts.travelToMin) || 0);
  const travelReturnMin = Math.max(0, Number(opts.travelReturnMin) || 0);
  const setupMin = Math.max(0, Number(opts.setupMin) || 0);
  const packupMin = Math.max(0, Number(opts.packupMin) || 0);
  const cleaningMin = Math.max(0, Number(opts.cleaningMin) || 0);
  return {
    occupyStart: addMinutes(opts.rentalStart, -(travelToMin + setupMin)),
    occupyEnd: addMinutes(opts.rentalEnd, packupMin + travelReturnMin + cleaningMin),
    travelToMin,
    travelReturnMin,
    setupMin,
    packupMin,
    cleaningMin,
  };
}

export function windowsOverlap(a: OccupyWindow, b: OccupyWindow): boolean {
  return a.occupyStart < b.occupyEnd && b.occupyStart < a.occupyEnd;
}

export function travelFromDepot(
  settings: HiregraphStore['settings'] | undefined,
  dest?: LatLng | null
): { km: number; minutes: number; inArea: boolean; feeZar: number } {
  const lat = Number(settings?.depot_lat);
  const lng = Number(settings?.depot_lng);
  if (!dest || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { km: 0, minutes: 0, inArea: true, feeZar: 0 };
  }
  const km = roadKm({ lat, lng }, dest);
  const minutes = etaMinutesFromKm(km);
  const radius = Number(settings?.service_radius_km);
  const inArea = !Number.isFinite(radius) || radius <= 0 || km <= radius;
  const free = Number(settings?.free_radius_km) || 0;
  const perKm = Number(settings?.per_km_zar) || 0;
  const billable = Math.max(0, km - free);
  const feeZar = Math.round(billable * perKm);
  return { km, minutes, inArea, feeZar };
}

export function activeUnitsForItem(store: HiregraphStore, itemId: string): HireUnit[] {
  return (store.units || []).filter(
    (u) => u.item_id === itemId && u.active !== false
  );
}

function occupyingBookings(store: HiregraphStore, itemId: string, excludeId?: string | null): HireBooking[] {
  return (store.bookings || []).filter((b) => {
    if (b.item_id !== itemId) return false;
    if (excludeId && b.id === excludeId) return false;
    return bookingOccupies(b) || String(b.status) === 'hold';
  });
}

export function unitIsFree(
  store: HiregraphStore,
  unit: HireUnit,
  want: OccupyWindow,
  excludeBookingId?: string | null
): boolean {
  const item = store.items.find((i) => i.id === unit.item_id);
  const buf = buffersFor(item, unit, store.settings);
  for (const b of occupyingBookings(store, unit.item_id, excludeBookingId)) {
    if (b.unit_id && b.unit_id !== unit.id) continue;
    if (!b.unit_id && activeUnitsForItem(store, unit.item_id).length) {
      // Unassigned occupying booking blocks every unit of the product (legacy qty).
    }
    const start = rentalStartOf(b);
    const end = rentalEndOf(b);
    if (!start || !end) continue;
    const have = occupyWindow({
      rentalStart: start,
      rentalEnd: end,
      setupMin: buf.setupMin,
      packupMin: buf.packupMin,
      cleaningMin: buf.cleaningMin,
    });
    if (windowsOverlap(want, have)) return false;
  }
  return true;
}

export function findAvailableUnits(
  store: HiregraphStore,
  opts: {
    itemId: string;
    rentalStart: Date;
    rentalEnd: Date;
    dest?: LatLng | null;
    qty?: number;
    excludeBookingId?: string | null;
  }
): {
  ok: boolean;
  units: HireUnit[];
  window: OccupyWindow;
  travel: ReturnType<typeof travelFromDepot>;
  reason?: string;
} {
  const item = store.items.find((i) => i.id === opts.itemId);
  const travel = travelFromDepot(store.settings, opts.dest);
  const buf = buffersFor(item, null, store.settings);
  const window = occupyWindow({
    rentalStart: opts.rentalStart,
    rentalEnd: opts.rentalEnd,
    travelToMin: travel.minutes,
    travelReturnMin: travel.minutes,
    setupMin: buf.setupMin,
    packupMin: buf.packupMin,
    cleaningMin: buf.cleaningMin,
  });
  if (!travel.inArea) {
    return { ok: false, units: [], window, travel, reason: 'Outside the delivery area' };
  }
  const need = Math.max(1, Number(opts.qty) || 1);
  const pool = activeUnitsForItem(store, opts.itemId);
  if (!pool.length) {
    return { ok: true, units: [], window, travel };
  }
  const free = pool.filter((u) =>
    unitIsFree(store, u, window, opts.excludeBookingId)
  );
  if (free.length < need) {
    return {
      ok: false,
      units: free,
      window,
      travel,
      reason: 'No unit is free for that time after travel, setup and cleaning',
    };
  }
  return { ok: true, units: free.slice(0, need), window, travel };
}
