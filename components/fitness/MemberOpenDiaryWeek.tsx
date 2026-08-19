'use client';

import { useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  User,
  Users,
  X,
} from 'lucide-react';
import { addDaysIso } from '@/lib/fitness/fitgraph';

export type MemberDiarySlot = {
  id: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  class_name: string;
  coach_name?: string;
  location?: string;
  spots_left: number;
  full: boolean;
  my_status?: string | null;
  my_booking_id?: string | null;
  can_book?: boolean;
  need_plan?: boolean;
  need_debit_bank?: boolean;
  book_hint?: string | null;
  class_plan?: string;
};

function mondayOf(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDay();
  const monOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + monOffset);
  return d.toISOString().slice(0, 10);
}

function dayLabel(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

function dayNum(iso: string) {
  return String(iso).slice(8, 10);
}

function clock(t: string) {
  return String(t || '').slice(0, 5);
}

export function MemberOpenDiaryWeek({
  slots,
  allowBooking,
  diaryOpen = true,
  busyId,
  onBook,
  onCancel,
  onNeedSubscribe,
  today = new Date().toISOString().slice(0, 10),
}: {
  slots: MemberDiarySlot[];
  allowBooking: boolean;
  diaryOpen?: boolean;
  busyId?: string | null;
  onBook: (sessionId: string, waitlist: boolean) => void;
  onCancel?: (bookingId: string) => void;
  onNeedSubscribe?: (needBank?: boolean, hint?: string | null) => void;
  today?: string;
}) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)),
    [weekStart]
  );
  const byDate = useMemo(() => {
    const map: Record<string, MemberDiarySlot[]> = {};
    for (const s of slots) {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [slots]);

  const defaultDay =
    days.find((d) => (byDate[d] || []).length > 0 && d >= today) ||
    days.find((d) => (byDate[d] || []).length > 0) ||
    (days.includes(today) ? today : days[0]);
  const [selected, setSelected] = useState(defaultDay);
  const selectedDay = days.includes(selected) ? selected : defaultDay;
  const daySlots = byDate[selectedDay] || [];

  if (!diaryOpen) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        The gym has not opened a public diary yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-xl border border-slate-200 p-2"
          onClick={() => setWeekStart(addDaysIso(weekStart, -7))}
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-black text-slate-900">
          {weekStart.slice(8, 10)} {weekStart.slice(5, 7)} –{' '}
          {addDaysIso(weekStart, 6).slice(8, 10)}{' '}
          {addDaysIso(weekStart, 6).slice(5, 7)}
        </p>
        <button
          type="button"
          className="rounded-xl border border-slate-200 p-2"
          onClick={() => setWeekStart(addDaysIso(weekStart, 7))}
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const n = (byDate[d] || []).length;
          const on = d === selectedDay;
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelected(d)}
              className={`rounded-2xl px-1 py-2 text-center ${
                on
                  ? 'bg-[#E8E830] text-slate-900'
                  : isToday
                    ? 'bg-yellow-50 border border-yellow-200'
                    : 'bg-white border border-slate-200'
              }`}
            >
              <p className="text-[9px] font-black uppercase">{dayLabel(d)}</p>
              <p className="text-sm font-black">{dayNum(d)}</p>
              <p className="text-[9px] font-bold opacity-70">
                {n ? `${n}` : '—'}
              </p>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 flex items-center gap-1">
        <CalendarDays className="h-3.5 w-3.5" />
        {selectedDay} · pick a time
      </p>

      {daySlots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          No open slots this day. Try another day this week.
        </div>
      ) : (
        <ul className="space-y-2">
          {daySlots.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-slate-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-black text-slate-900">
                    {clock(c.start_time)}
                    {c.end_time ? `–${clock(c.end_time)}` : ''} · {c.class_name}
                  </p>
                  {c.coach_name ? (
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {c.coach_name}
                    </p>
                  ) : null}
                  {c.location ? (
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {c.location}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                    c.my_status
                      ? 'bg-yellow-100 text-yellow-800'
                      : c.full
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  {c.my_status
                    ? c.my_status
                    : c.full
                      ? 'Full'
                      : `${c.spots_left} left`}
                </span>
              </div>
              {c.class_plan ? (
                <p className="text-[11px] text-slate-600 mt-1.5">{c.class_plan}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {c.my_status ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-700">
                      <Check className="w-3.5 h-3.5" />
                      You&apos;re {c.my_status}
                    </span>
                    {c.my_booking_id &&
                    c.my_status !== 'attended' &&
                    c.my_status !== 'waitlist' &&
                    onCancel ? (
                      <button
                        type="button"
                        disabled={busyId === c.my_booking_id}
                        onClick={() => onCancel(c.my_booking_id!)}
                        className="text-xs font-bold text-rose-600 inline-flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                    ) : null}
                  </>
                ) : allowBooking && c.can_book === false ? (
                  <button
                    type="button"
                    onClick={() =>
                      onNeedSubscribe?.(c.need_debit_bank, c.book_hint)
                    }
                    className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    {c.need_debit_bank
                      ? 'Add bank details'
                      : c.book_hint || 'Subscribe to this class'}
                  </button>
                ) : allowBooking ? (
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => onBook(c.id, c.full)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 ${
                      c.full ? 'bg-amber-600' : 'bg-yellow-600'
                    }`}
                  >
                    {busyId === c.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                    ) : c.full ? (
                      'Request join (waitlist)'
                    ) : (
                      'Book this slot'
                    )}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
