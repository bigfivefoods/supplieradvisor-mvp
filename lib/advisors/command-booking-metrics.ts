/**
 * Command-hub booking telemetry — day / week / month counts, fill %,
 * and monthly income from booked appointments (plus “if full” potential).
 */
import { appointmentKindOf } from '@/lib/clinic/appointment-kind';
import {
  SYS_COACH_TIME_CODE,
  SYS_PT_CODE,
  normalizeSessionKind,
  type FitSessionKind,
} from '@/lib/fitness/session-times';

export type CommandDateWindows = {
  today: string;
  weekStart: string;
  weekEnd: string;
  monthStart: string;
  monthEnd: string;
};

export type CommandBookingMetrics = {
  bookedToday: number;
  bookedWeek: number;
  bookedMonth: number;
  fillRateTodayPct: number | null;
  fillRateWeekPct: number | null;
  fillRateMonthPct: number | null;
  monthIncomeZar: number;
  monthPotentialZar: number;
  slotsToday: number;
  slotsWeek: number;
  slotsMonth: number;
};

const EMPTY: CommandBookingMetrics = {
  bookedToday: 0,
  bookedWeek: 0,
  bookedMonth: 0,
  fillRateTodayPct: null,
  fillRateWeekPct: null,
  fillRateMonthPct: null,
  monthIncomeZar: 0,
  monthPotentialZar: 0,
  slotsToday: 0,
  slotsWeek: 0,
  slotsMonth: 0,
};

const LIVE_BOOKING = new Set(['booked', 'attended']);
const HIRE_LIVE = new Set([
  'requested',
  'awaiting_requirements',
  'approved',
  'paid',
  'out',
  'returned',
  'completed',
]);

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function commandDateWindows(todayIso?: string): CommandDateWindows {
  const today = String(todayIso || new Date().toISOString().slice(0, 10)).slice(
    0,
    10
  );
  const d = new Date(`${today}T12:00:00`);
  const dow = d.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const weekStart = addDaysIso(today, mondayOffset);
  const weekEnd = addDaysIso(weekStart, 6);
  const monthStart = `${today.slice(0, 8)}01`;
  const last = new Date(`${today}T12:00:00`);
  last.setMonth(last.getMonth() + 1, 0);
  const monthEnd = last.toISOString().slice(0, 10);
  return { today, weekStart, weekEnd, monthStart, monthEnd };
}

export function fillPct(booked: number, capacity: number): number | null {
  if (!Number.isFinite(capacity) || capacity <= 0) return null;
  const n = (Math.max(0, booked) / capacity) * 100;
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

export function formatFillPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  return `${Number.isInteger(v) ? String(v) : v.toFixed(1)}%`;
}

export function formatCommandZar(n: number | null | undefined): string {
  const v = Math.round(Number(n) || 0);
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  return `${sign}R${String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function inWin(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

function money(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function inclusiveDays(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00`).getTime();
  const b = new Date(`${end}T12:00:00`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

function eachDate(start: string, end: string): string[] {
  const n = inclusiveDays(start, end);
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) out.push(addDaysIso(start, i));
  return out;
}

// ── Clinic / dental (1 seat per consult slot) ────────────────────────────

export type ClinicCommandStore = {
  appointments?: Array<{
    id: string;
    date: string;
    status?: string;
    service_id?: string;
    appointment_kind?: string;
  }>;
  bookings?: Array<{
    appointment_id: string;
    status?: string;
  }>;
  services?: Array<{
    id: string;
    code?: string;
    price_zar?: number;
  }>;
};

export function clinicCommandBookingMetrics(
  store: ClinicCommandStore,
  todayIso?: string
): CommandBookingMetrics {
  const w = commandDateWindows(todayIso);
  const services = store.services || [];
  const slots = (store.appointments || []).filter((a) => {
    if (a.status === 'cancelled' || a.status === 'no_show') return false;
    return appointmentKindOf(a, services) !== 'personal';
  });
  const seats = new Map<string, number>();
  for (const b of store.bookings || []) {
    if (!LIVE_BOOKING.has(String(b.status || ''))) continue;
    seats.set(b.appointment_id, (seats.get(b.appointment_id) || 0) + 1);
  }

  const windowOf = (from: string, to: string) => {
    const win = slots.filter((a) => inWin(a.date, from, to));
    let booked = 0;
    let capacity = 0;
    let bookedIncome = 0;
    let potential = 0;
    for (const slot of win) {
      capacity += 1;
      const n = Math.min(1, seats.get(slot.id) || 0);
      booked += n;
      const price = money(
        services.find((s) => s.id === slot.service_id)?.price_zar
      );
      bookedIncome += n * price;
      potential += price;
    }
    return { booked, capacity, bookedIncome, potential };
  };

  const day = windowOf(w.today, w.today);
  const week = windowOf(w.weekStart, w.weekEnd);
  const month = windowOf(w.monthStart, w.monthEnd);
  return {
    bookedToday: day.booked,
    bookedWeek: week.booked,
    bookedMonth: month.booked,
    fillRateTodayPct: fillPct(day.booked, day.capacity),
    fillRateWeekPct: fillPct(week.booked, week.capacity),
    fillRateMonthPct: fillPct(month.booked, month.capacity),
    monthIncomeZar: Math.round(month.bookedIncome),
    monthPotentialZar: Math.round(month.potential),
    slotsToday: day.capacity,
    slotsWeek: week.capacity,
    slotsMonth: month.capacity,
  };
}

// ── Gym ──────────────────────────────────────────────────────────────────

export type GymCommandStore = {
  sessions?: Array<{
    id: string;
    date: string;
    status?: string;
    capacity?: number | null;
    class_type_id?: string;
    session_kind?: string;
    series_id?: string | null;
  }>;
  bookings?: Array<{
    session_id: string;
    client_id?: string;
    status?: string;
  }>;
  class_types?: Array<{
    id: string;
    code?: string;
    capacity?: number | null;
  }>;
  clients?: Array<{
    id: string;
    agreed_rate_zar?: number | null;
    private_rate_zar?: number | null;
    membership_plan_id?: string | null;
  }>;
  subscriptions?: Array<{
    client_id: string;
    plan_id: string;
    status?: string;
    charged_zar?: number | null;
  }>;
  membership_plans?: Array<{
    id: string;
    price_zar?: number;
    billing?: string;
    series_ids?: string[];
    class_type_ids?: string[];
    active?: boolean;
  }>;
};

function gymSessionKind(
  session: NonNullable<GymCommandStore['sessions']>[number],
  types: NonNullable<GymCommandStore['class_types']>
): FitSessionKind {
  if (session.session_kind && String(session.session_kind).trim()) {
    return normalizeSessionKind(session.session_kind);
  }
  const ct = types.find((t) => t.id === session.class_type_id);
  if (ct?.code === SYS_PT_CODE) return 'private_pt';
  if (ct?.code === SYS_COACH_TIME_CODE) return 'coach_personal';
  return 'class';
}

function gymPlanForSession(
  store: GymCommandStore,
  session: NonNullable<GymCommandStore['sessions']>[number],
  clientId?: string
) {
  const plans = store.membership_plans || [];
  if (clientId) {
    const sub = (store.subscriptions || []).find(
      (s) =>
        s.client_id === clientId &&
        (s.status === 'active' || s.status === 'trialing')
    );
    if (sub) {
      const hit = plans.find((p) => p.id === sub.plan_id);
      if (hit) {
        return {
          plan: hit,
          charged: sub.charged_zar ?? null,
        };
      }
    }
    const client = (store.clients || []).find((c) => c.id === clientId);
    if (client?.membership_plan_id) {
      const hit = plans.find((p) => p.id === client.membership_plan_id);
      if (hit) return { plan: hit, charged: null as number | null };
    }
  }
  if (session.series_id) {
    const bySeries = plans.find(
      (p) =>
        p.active !== false &&
        Array.isArray(p.series_ids) &&
        p.series_ids.includes(session.series_id as string)
    );
    if (bySeries) return { plan: bySeries, charged: null as number | null };
  }
  if (session.class_type_id) {
    const byType = plans.find(
      (p) =>
        p.active !== false &&
        Array.isArray(p.class_type_ids) &&
        p.class_type_ids.includes(session.class_type_id as string)
    );
    if (byType) return { plan: byType, charged: null as number | null };
  }
  return { plan: null, charged: null as number | null };
}

function gymCharge(
  client: NonNullable<GymCommandStore['clients']>[number] | undefined,
  charged: number | null | undefined,
  plan: { price_zar?: number } | null,
  privatePt: boolean
): number {
  if (privatePt) return money(client?.private_rate_zar);
  if (charged != null && Number.isFinite(Number(charged))) return money(charged);
  if (
    client?.agreed_rate_zar != null &&
    Number.isFinite(Number(client.agreed_rate_zar))
  ) {
    return money(client.agreed_rate_zar);
  }
  return money(plan?.price_zar);
}

export function gymCommandBookingMetrics(
  store: GymCommandStore,
  todayIso?: string
): CommandBookingMetrics {
  const w = commandDateWindows(todayIso);
  const types = store.class_types || [];
  const sessions = (store.sessions || []).filter((s) => {
    if (s.status === 'cancelled') return false;
    return gymSessionKind(s, types) !== 'coach_personal';
  });
  const seats = new Map<string, Array<{ client_id?: string }>>();
  for (const b of store.bookings || []) {
    if (!LIVE_BOOKING.has(String(b.status || ''))) continue;
    const list = seats.get(b.session_id) || [];
    list.push({ client_id: b.client_id });
    seats.set(b.session_id, list);
  }

  const windowOf = (from: string, to: string) => {
    const win = sessions.filter((s) => inWin(s.date, from, to));
    let booked = 0;
    let capacity = 0;
    for (const session of win) {
      const ct = types.find((t) => t.id === session.class_type_id);
      const cap = Number(session.capacity ?? ct?.capacity ?? 0) || 0;
      booked += (seats.get(session.id) || []).length;
      if (cap > 0) capacity += cap;
    }
    const fillBooked = win.reduce((sum, session) => {
      const ct = types.find((t) => t.id === session.class_type_id);
      const cap = Number(session.capacity ?? ct?.capacity ?? 0) || 0;
      if (cap <= 0) return sum;
      return sum + Math.min(cap, (seats.get(session.id) || []).length);
    }, 0);
    return { booked, capacity, fillBooked };
  };

  const day = windowOf(w.today, w.today);
  const week = windowOf(w.weekStart, w.weekEnd);
  const month = windowOf(w.monthStart, w.monthEnd);

  const monthSessions = sessions.filter((s) =>
    inWin(s.date, w.monthStart, w.monthEnd)
  );
  const seenClass = new Set<string>();
  const seenPrivate = new Set<string>();
  let monthIncome = 0;
  let emptyDropIn = 0;

  for (const session of monthSessions) {
    const kind = gymSessionKind(session, types);
    const ct = types.find((t) => t.id === session.class_type_id);
    const cap = Number(session.capacity ?? ct?.capacity ?? 0) || 0;
    const list = seats.get(session.id) || [];
    if (cap > 0) {
      const empty = Math.max(0, cap - list.length);
      const listed = gymPlanForSession(store, session).plan;
      if (listed?.billing === 'drop_in') {
        emptyDropIn += empty * money(listed.price_zar);
      }
    }
    for (const row of list) {
      const client = (store.clients || []).find((c) => c.id === row.client_id);
      const resolved = gymPlanForSession(store, session, row.client_id);
      if (kind === 'private_pt') {
        const key = client?.id || `guest:${session.id}:${row.client_id || 'x'}`;
        if (seenPrivate.has(key)) continue;
        seenPrivate.add(key);
        monthIncome += gymCharge(client, resolved.charged, resolved.plan, true);
        continue;
      }
      if (resolved.plan?.billing === 'drop_in') {
        monthIncome +=
          resolved.charged != null && Number.isFinite(Number(resolved.charged))
            ? money(resolved.charged)
            : money(resolved.plan.price_zar);
        continue;
      }
      if (client) {
        if (seenClass.has(client.id)) continue;
        seenClass.add(client.id);
        monthIncome += gymCharge(
          client,
          resolved.charged,
          resolved.plan,
          false
        );
      } else {
        monthIncome += money(resolved.plan?.price_zar);
      }
    }
  }

  return {
    bookedToday: day.booked,
    bookedWeek: week.booked,
    bookedMonth: month.booked,
    fillRateTodayPct: fillPct(day.fillBooked, day.capacity),
    fillRateWeekPct: fillPct(week.fillBooked, week.capacity),
    fillRateMonthPct: fillPct(month.fillBooked, month.capacity),
    monthIncomeZar: Math.round(monthIncome),
    monthPotentialZar: Math.round(monthIncome + emptyDropIn),
    slotsToday: day.capacity,
    slotsWeek: week.capacity,
    slotsMonth: month.capacity,
  };
}

// ── Hire ─────────────────────────────────────────────────────────────────

export type HireCommandStore = {
  items?: Array<{
    id: string;
    status?: string;
    rate_zar?: number;
    rate_unit?: string;
    active?: boolean;
  }>;
  bookings?: Array<{
    status?: string;
    start_date?: string | null;
    end_date?: string | null;
    rental_zar?: number | null;
    rate_zar?: number | null;
    item_id?: string;
  }>;
};

function hireListed(
  item: NonNullable<HireCommandStore['items']>[number]
): boolean {
  if (item.active === false) return false;
  const s = String(item.status || 'listed');
  return s === 'listed' || s === 'hired_out';
}

function hireRange(b: NonNullable<HireCommandStore['bookings']>[number]): {
  start: string;
  end: string;
} | null {
  const start = String(b.start_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  const endRaw = String(b.end_date || start).slice(0, 10);
  const end = /^\d{4}-\d{2}-\d{2}$/.test(endRaw) ? endRaw : start;
  return { start, end };
}

function rangesOverlap(
  a0: string,
  a1: string,
  b0: string,
  b1: string
): boolean {
  return a0 <= b1 && a1 >= b0;
}

export function hireCommandBookingMetrics(
  store: HireCommandStore,
  todayIso?: string
): CommandBookingMetrics {
  const w = commandDateWindows(todayIso);
  const listed = (store.items || []).filter(hireListed);
  const live = (store.bookings || []).filter((b) =>
    HIRE_LIVE.has(String(b.status || ''))
  );

  const countOverlapping = (from: string, to: string) =>
    live.filter((b) => {
      const r = hireRange(b);
      return r ? rangesOverlap(r.start, r.end, from, to) : false;
    }).length;

  const itemDays = (from: string, to: string) => {
    const available = listed.length * inclusiveDays(from, to);
    let bookedDays = 0;
    for (const b of live) {
      const r = hireRange(b);
      if (!r || !rangesOverlap(r.start, r.end, from, to)) continue;
      const start = r.start < from ? from : r.start;
      const end = r.end > to ? to : r.end;
      bookedDays += eachDate(start, end).length;
    }
    return { available, bookedDays };
  };

  const day = itemDays(w.today, w.today);
  const week = itemDays(w.weekStart, w.weekEnd);
  const month = itemDays(w.monthStart, w.monthEnd);

  let monthIncome = 0;
  for (const b of live) {
    const r = hireRange(b);
    if (!r || !rangesOverlap(r.start, r.end, w.monthStart, w.monthEnd)) {
      continue;
    }
    monthIncome += money(b.rental_zar);
  }

  let avgDaily = month.bookedDays > 0 ? monthIncome / month.bookedDays : 0;
  if (avgDaily <= 0) {
    const dayRates = listed
      .map((i) => {
        const rate = money(i.rate_zar);
        const unit = String(i.rate_unit || 'day');
        if (unit === 'week') return rate / 7;
        if (unit === 'weekend') return rate / 2;
        if (unit === 'hour') return rate * 8;
        return rate;
      })
      .filter((n) => n > 0);
    if (dayRates.length) {
      avgDaily = dayRates.reduce((s, n) => s + n, 0) / dayRates.length;
    }
  }
  const unused = Math.max(0, month.available - month.bookedDays);
  const monthPotential = monthIncome + unused * avgDaily;

  return {
    bookedToday: countOverlapping(w.today, w.today),
    bookedWeek: countOverlapping(w.weekStart, w.weekEnd),
    bookedMonth: countOverlapping(w.monthStart, w.monthEnd),
    fillRateTodayPct: fillPct(day.bookedDays, day.available),
    fillRateWeekPct: fillPct(week.bookedDays, week.available),
    fillRateMonthPct: fillPct(month.bookedDays, month.available),
    monthIncomeZar: Math.round(monthIncome),
    monthPotentialZar: Math.round(monthPotential),
    slotsToday: day.available,
    slotsWeek: week.available,
    slotsMonth: month.available,
  };
}

// ── Retail (sales analog) ────────────────────────────────────────────────

export type RetailCommandStore = {
  sales?: Array<{
    created_at?: string;
    status?: string;
    total_zar?: number;
  }>;
};

export function retailCommandBookingMetrics(
  store: RetailCommandStore,
  todayIso?: string
): CommandBookingMetrics {
  const w = commandDateWindows(todayIso);
  const paid = (store.sales || []).filter((s) => s.status === 'paid');
  const inRange = (from: string, to: string) =>
    paid.filter((s) => {
      const d = String(s.created_at || '').slice(0, 10);
      return inWin(d, from, to);
    });
  const day = inRange(w.today, w.today);
  const week = inRange(w.weekStart, w.weekEnd);
  const month = inRange(w.monthStart, w.monthEnd);
  const takings = (rows: typeof paid) =>
    rows.reduce((n, s) => n + money(s.total_zar), 0);
  const monthTakings = takings(month);
  return {
    bookedToday: day.length,
    bookedWeek: week.length,
    bookedMonth: month.length,
    fillRateTodayPct: null,
    fillRateWeekPct: null,
    fillRateMonthPct: null,
    monthIncomeZar: Math.round(monthTakings),
    monthPotentialZar: Math.round(monthTakings),
    slotsToday: 0,
    slotsWeek: 0,
    slotsMonth: 0,
  };
}

export function emptyCommandBookingMetrics(): CommandBookingMetrics {
  return { ...EMPTY };
}
