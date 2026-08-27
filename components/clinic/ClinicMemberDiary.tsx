'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, MapPin, User } from 'lucide-react';
import { MemberPortalWeekCalendar } from '@/components/advisors/MemberPortalWeekCalendar';
import {
  bookingsToMemberCalendarEvents,
  mergeMemberCalendarEvents,
  slotsToMemberCalendarEvents,
  type MemberCalendarEvent,
} from '@/lib/advisors/member-week-calendar';
import { consolidateClinicDiarySlots } from '@/lib/clinic/consolidate-diary-slots';

export type ClinicDiarySlot = {
  id: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  duration_min?: number | null;
  service_name: string;
  practitioner_name?: string;
  clinician_name?: string;
  location?: string;
  spots_left?: number;
  full: boolean;
  my_status?: string | null;
  my_booking_id?: string | null;
  is_preferred_clinician?: boolean;
};

export type ClinicDiaryBooking = {
  booking_id: string;
  status: string;
  date: string;
  start_time: string;
  service_name: string;
  practitioner_name?: string;
};

export function ClinicMemberDiary({
  slots,
  bookings = [],
  color,
  allowBooking,
  busyId,
  onBook,
  emptyLabel = 'No public diary slots in the next weeks. Ask the clinic to publish open times.',
}: {
  slots: ClinicDiarySlot[];
  bookings?: ClinicDiaryBooking[];
  color: string;
  allowBooking: boolean;
  busyId?: string | null;
  onBook: (slotId: string, waitlist: boolean) => void;
  emptyLabel?: string;
}) {
  const diarySlots = useMemo(
    () => consolidateClinicDiarySlots(slots),
    [slots]
  );
  const events = useMemo(
    () =>
      mergeMemberCalendarEvents(
        slotsToMemberCalendarEvents(diarySlots),
        bookingsToMemberCalendarEvents(bookings)
      ),
    [diarySlots, bookings]
  );
  const [active, setActive] = useState<MemberCalendarEvent | null>(null);
  const slot = active
    ? diarySlots.find((s) => s.id === active.id) ||
      slots.find((s) => s.id === active.id) ||
      null
    : null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Booked times show as one block. Open times are the appointments you
        can take. Tap a block to book or join the waitlist.
      </p>
      <MemberPortalWeekCalendar
        events={events}
        color={color}
        allowBooking={allowBooking}
        busyId={busyId}
        emptyLabel={emptyLabel}
        onSelect={setActive}
      />
      {slot ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="font-black text-slate-900">{slot.service_name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <User className="h-3.5 w-3.5" />
            {slot.full && !slot.my_status
            ? 'Fully booked'
            : slot.practitioner_name ||
              slot.clinician_name ||
              'Clinician TBC'}
            {slot.is_preferred_clinician ? ' · your clinician' : ''}
          </p>
          {slot.location ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              {slot.location}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {slot.my_status ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                You&apos;re {slot.my_status}
              </span>
            ) : allowBooking ? (
              <button
                type="button"
                disabled={busyId === slot.id}
                onClick={() => onBook(slot.id, slot.full)}
                className="rounded-xl px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: color }}
              >
                {busyId === slot.id ? (
                  <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
                ) : slot.full ? (
                  'Join waitlist'
                ) : slot.is_preferred_clinician ? (
                  'Book appointment'
                ) : (
                  'Book this slot'
                )}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Tap a free slot on the calendar to book it.
        </p>
      )}
    </div>
  );
}
