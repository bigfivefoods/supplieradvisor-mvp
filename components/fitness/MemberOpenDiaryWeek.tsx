'use client';

import { useState } from 'react';
import { Check, Loader2, MapPin, User, Users, X } from 'lucide-react';
import { MemberPortalWeekCalendar } from '@/components/advisors/MemberPortalWeekCalendar';
import { slotsToMemberCalendarEvents } from '@/lib/advisors/member-week-calendar';

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

export function MemberOpenDiaryWeek({
  slots,
  allowBooking,
  diaryOpen = true,
  busyId,
  onBook,
  onCancel,
  onNeedSubscribe,
  color = '#E8E830',
}: {
  slots: MemberDiarySlot[];
  allowBooking: boolean;
  diaryOpen?: boolean;
  busyId?: string | null;
  onBook: (sessionId: string, waitlist: boolean) => void;
  onCancel?: (bookingId: string) => void;
  onNeedSubscribe?: (needBank?: boolean, hint?: string | null) => void;
  color?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = slots.find((s) => s.id === activeId) || null;

  if (!diaryOpen) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        The gym has not opened a public diary yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <MemberPortalWeekCalendar
        events={slotsToMemberCalendarEvents(slots)}
        color={color}
        allowBooking={allowBooking}
        busyId={busyId}
        emptyLabel="No classes on the diary this week. Try next week, or ask the gym to publish the timetable."
        onSelect={(ev) => setActiveId(ev.id)}
      />
      {active ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-black text-slate-900">
                {String(active.start_time).slice(0, 5)}
                {active.end_time
                  ? `–${String(active.end_time).slice(0, 5)}`
                  : ''}{' '}
                · {active.class_name}
              </p>
              {active.coach_name ? (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <User className="h-3.5 w-3.5" />
                  {active.coach_name}
                </p>
              ) : null}
              {active.location ? (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {active.location}
                </p>
              ) : null}
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600">
              <Users className="h-3 w-3" />
              {active.my_status
                ? active.my_status
                : active.full
                  ? 'Full'
                  : `${active.spots_left} left`}
            </span>
          </div>
          {active.class_plan ? (
            <p className="mt-1.5 text-[11px] text-slate-600">{active.class_plan}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {active.my_status ? (
              <>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-700">
                  <Check className="h-3.5 w-3.5" />
                  You&apos;re {active.my_status}
                </span>
                {active.my_booking_id &&
                active.my_status !== 'attended' &&
                active.my_status !== 'waitlist' &&
                onCancel ? (
                  <button
                    type="button"
                    disabled={busyId === active.my_booking_id}
                    onClick={() => onCancel(active.my_booking_id!)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-600"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                ) : null}
              </>
            ) : allowBooking && active.can_book === false ? (
              <button
                type="button"
                onClick={() =>
                  onNeedSubscribe?.(active.need_debit_bank, active.book_hint)
                }
                className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
              >
                {active.need_debit_bank
                  ? 'Add bank details'
                  : active.book_hint || 'Subscribe to this class'}
              </button>
            ) : allowBooking ? (
              <button
                type="button"
                disabled={busyId === active.id}
                onClick={() => onBook(active.id, active.full)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 ${
                  active.full ? 'bg-amber-600' : 'bg-yellow-600'
                }`}
              >
                {busyId === active.id ? (
                  <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
                ) : active.full ? (
                  'Request join (waitlist)'
                ) : (
                  'Book this slot'
                )}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Tap a class on the week calendar to book, join the waitlist, or cancel.
        </p>
      )}
    </div>
  );
}
