'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, MapPin, User, Users, X } from 'lucide-react';
import { MemberPortalWeekCalendar } from '@/components/advisors/MemberPortalWeekCalendar';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';
import { slotsToMemberCalendarEvents } from '@/lib/advisors/member-week-calendar';
import { addDaysIso } from '@/lib/schedule/recurrence';

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
  my_rsvp?: 'coming' | 'not_coming' | null;
  can_book?: boolean;
  need_plan?: boolean;
  need_debit_bank?: boolean;
  book_hint?: string | null;
  class_plan?: string;
};

function clock(t?: string | null) {
  return String(t || '').slice(0, 5);
}

function dayChipLabel(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return {
    wd: d.toLocaleDateString(undefined, { weekday: 'short' }),
    num: d.getDate(),
  };
}

function SlotActions({
  slot,
  allowBooking,
  busyId,
  color,
  ink,
  onBook,
  onCancel,
  onRsvp,
  onNeedSubscribe,
}: {
  slot: MemberDiarySlot;
  allowBooking: boolean;
  busyId?: string | null;
  color: string;
  ink: string;
  onBook: (sessionId: string, waitlist: boolean) => void;
  onCancel?: (bookingId: string) => void;
  onRsvp?: (bookingId: string, coming: boolean) => void;
  onNeedSubscribe?: (needBank?: boolean, hint?: string | null) => void;
}) {
  if (slot.my_status) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black uppercase text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <Check className="h-3.5 w-3.5" />
          You&apos;re {slot.my_status}
        </span>
        {slot.my_booking_id &&
        slot.my_status !== 'attended' &&
        slot.my_status !== 'waitlist' ? (
          onRsvp ? (
            <>
              <button
                type="button"
                disabled={busyId === slot.my_booking_id}
                onClick={() => onRsvp(slot.my_booking_id!, true)}
                className={`min-h-10 rounded-xl px-3 text-xs font-black ${
                  slot.my_rsvp === 'coming'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-emerald-200 text-emerald-800 dark:border-emerald-500/40 dark:text-emerald-200'
                }`}
              >
                Will be attending
              </button>
              <button
                type="button"
                disabled={busyId === slot.my_booking_id}
                onClick={() => onRsvp(slot.my_booking_id!, false)}
                className={`min-h-10 rounded-xl px-3 text-xs font-black ${
                  slot.my_rsvp === 'not_coming'
                    ? 'bg-rose-600 text-white'
                    : 'border border-rose-200 text-rose-700 dark:border-rose-500/40 dark:text-rose-200'
                }`}
              >
                Won&apos;t be attending
              </button>
            </>
          ) : onCancel ? (
            <button
              type="button"
              disabled={busyId === slot.my_booking_id}
              onClick={() => onCancel(slot.my_booking_id!)}
              className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-xs font-bold text-rose-600"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          ) : null
        ) : null}
      </div>
    );
  }
  if (!allowBooking) return null;
  if (slot.can_book === false) {
    return (
      <button
        type="button"
        onClick={() => onNeedSubscribe?.(slot.need_debit_bank, slot.book_hint)}
        className="mt-3 min-h-11 w-full rounded-xl bg-slate-900 px-3 text-sm font-black text-white dark:bg-white dark:text-slate-900"
      >
        {slot.need_debit_bank
          ? 'Add bank details to book'
          : slot.book_hint || 'Subscribe to this class'}
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={busyId === slot.id}
      onClick={() => onBook(slot.id, slot.full)}
      className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-black disabled:opacity-50"
      style={
        slot.full
          ? { backgroundColor: '#d97706', color: '#fff' }
          : { backgroundColor: color, color: ink }
      }
    >
      {busyId === slot.id ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : slot.full ? (
        'Join waitlist'
      ) : (
        'Book this class'
      )}
    </button>
  );
}

function SlotCard({
  slot,
  selected,
  allowBooking,
  busyId,
  color,
  ink,
  onSelect,
  onBook,
  onCancel,
  onRsvp,
  onNeedSubscribe,
}: {
  slot: MemberDiarySlot;
  selected?: boolean;
  allowBooking: boolean;
  busyId?: string | null;
  color: string;
  ink: string;
  onSelect?: () => void;
  onBook: (sessionId: string, waitlist: boolean) => void;
  onCancel?: (bookingId: string) => void;
  onRsvp?: (bookingId: string, coming: boolean) => void;
  onNeedSubscribe?: (needBank?: boolean, hint?: string | null) => void;
}) {
  return (
    <article
      className={`rounded-2xl border bg-white p-4 dark:bg-neutral-900 ${
        selected
          ? 'border-slate-900 shadow-sm dark:border-white'
          : slot.my_status
            ? 'border-emerald-200 dark:border-emerald-500/30'
            : 'border-slate-200 dark:border-white/10'
      }`}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={onSelect}
      >
        <div className="min-w-0">
          <p className="font-black tabular-nums text-slate-900 dark:text-white">
            {clock(slot.start_time)}
            {slot.end_time ? `–${clock(slot.end_time)}` : ''}
            <span className="ml-1.5 font-black">{slot.class_name}</span>
          </p>
          {slot.coach_name ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <User className="h-3.5 w-3.5" />
              {slot.coach_name}
            </p>
          ) : null}
          {slot.location ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              {slot.location}
            </p>
          ) : null}
          {slot.class_plan ? (
            <p className="mt-1.5 text-[12px] leading-snug text-slate-600 dark:text-slate-300">
              {slot.class_plan}
            </p>
          ) : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">
          <Users className="h-3 w-3" />
          {slot.my_status
            ? slot.my_status
            : slot.full
              ? 'Full'
              : `${slot.spots_left} left`}
        </span>
      </button>
      <SlotActions
        slot={slot}
        allowBooking={allowBooking}
        busyId={busyId}
        color={color}
        ink={ink}
        onBook={onBook}
        onCancel={onCancel}
        onRsvp={onRsvp}
        onNeedSubscribe={onNeedSubscribe}
      />
    </article>
  );
}

export function MemberOpenDiaryWeek({
  slots,
  allowBooking,
  diaryOpen = true,
  busyId,
  onBook,
  onCancel,
  onRsvp,
  onNeedSubscribe,
  color = '#E8E830',
}: {
  slots: MemberDiarySlot[];
  allowBooking: boolean;
  diaryOpen?: boolean;
  busyId?: string | null;
  onBook: (sessionId: string, waitlist: boolean) => void;
  onCancel?: (bookingId: string) => void;
  onRsvp?: (bookingId: string, coming: boolean) => void;
  onNeedSubscribe?: (needBank?: boolean, hint?: string | null) => void;
  color?: string;
}) {
  const ink = advisorBrandInk(color);
  const today = new Date().toISOString().slice(0, 10);
  const [pickedDay, setPickedDay] = useState(today);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = slots.find((s) => s.id === activeId) || null;

  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 14; i += 1) out.push(addDaysIso(today, i));
    return out;
  }, [today]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of slots) m.set(s.date, (m.get(s.date) || 0) + 1);
    return m;
  }, [slots]);

  const daySlots = useMemo(
    () =>
      slots
        .filter((s) => s.date === pickedDay)
        .sort((a, b) => clock(a.start_time).localeCompare(clock(b.start_time))),
    [slots, pickedDay]
  );

  if (!diaryOpen) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-neutral-900">
        The gym has not opened a public diary yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="md:hidden">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {days.map((d) => {
            const on = d === pickedDay;
            const n = counts.get(d) || 0;
            const lab = dayChipLabel(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setPickedDay(d);
                  setActiveId(null);
                }}
                className={`flex min-w-[3.25rem] flex-col items-center rounded-2xl px-2 py-2 text-center ${
                  on
                    ? 'shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-neutral-900 dark:text-slate-300'
                }`}
                style={on ? { backgroundColor: color, color: ink } : undefined}
              >
                <span className="text-[10px] font-bold uppercase">{lab.wd}</span>
                <span className="text-base font-black tabular-nums">{lab.num}</span>
                <span className="text-[9px] font-bold opacity-70">
                  {d === today ? 'Today' : n ? `${n}` : '—'}
                </span>
              </button>
            );
          })}
        </div>
        {daySlots.length === 0 ? (
          <div className="mt-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-neutral-900">
            No classes this day. Swipe the dates for the next session.
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {daySlots.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                selected={slot.id === activeId}
                allowBooking={allowBooking}
                busyId={busyId}
                color={color}
                ink={ink}
                onSelect={() => setActiveId(slot.id)}
                onBook={onBook}
                onCancel={onCancel}
                onRsvp={onRsvp}
                onNeedSubscribe={onNeedSubscribe}
              />
            ))}
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <MemberPortalWeekCalendar
          events={slotsToMemberCalendarEvents(slots)}
          color={color}
          allowBooking={allowBooking}
          busyId={busyId}
          emptyLabel="No classes on the diary this week. Try next week, or ask the gym to publish the timetable."
          onSelect={(ev) => setActiveId(ev.id)}
        />
        {active ? (
          <div className="mt-3">
            <SlotCard
              slot={active}
              selected
              allowBooking={allowBooking}
              busyId={busyId}
              color={color}
              ink={ink}
              onBook={onBook}
              onCancel={onCancel}
              onRsvp={onRsvp}
              onNeedSubscribe={onNeedSubscribe}
            />
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Tap a class on the week calendar to book, join the waitlist, or
            change your RSVP.
          </p>
        )}
      </div>
    </div>
  );
}
