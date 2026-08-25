'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';
import {
  MemberRateLink,
  publicRatePath,
} from '@/components/advisors/MemberRateLink';
import { sessionHasEnded } from '@/lib/services/booking-feedback';

export function clinicFormatDay(date: string, time: string): string {
  try {
    const d = new Date(`${date}T12:00:00`);
    return `${d.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })} · ${String(time || '').slice(0, 5)}`;
  } catch {
    return `${date} · ${String(time || '').slice(0, 5)}`;
  }
}

export function ClinicVisitCard({
  serviceName,
  date,
  startTime,
  practitioner,
  status,
  color,
  featured = false,
  ended = false,
  attended = false,
  icsHref,
  rateHref,
  rateSubmitted,
  onCancel,
  busy,
}: {
  serviceName: string;
  date: string;
  startTime: string;
  practitioner?: string;
  status: string;
  color: string;
  featured?: boolean;
  ended?: boolean;
  attended?: boolean;
  icsHref?: string;
  rateHref?: string | null;
  rateSubmitted?: boolean;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const ink = advisorBrandInk(color);
  const [open, setOpen] = useState(false);
  const bright = featured && !ended;
  const label = attended
    ? 'Attended'
    : ended
      ? 'Visit done'
      : featured
        ? 'Next up'
        : 'Coming up';
  return (
    <div
      className={
        bright
          ? 'overflow-hidden rounded-3xl p-4 text-left shadow-sm'
          : 'overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm dark:border-white/10 dark:bg-neutral-900'
      }
      style={bright ? { backgroundColor: color, color: ink } : undefined}
    >
      <p
        className={`text-[10px] font-black uppercase tracking-widest ${
          bright ? 'opacity-70' : 'text-slate-400'
        }`}
      >
        {label}
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 w-full text-left"
      >
        <p
          className={`text-lg font-black leading-tight ${
            bright ? '' : 'text-slate-900 dark:text-white'
          }`}
        >
          {serviceName}
        </p>
        <p
          className={`mt-1 text-sm font-bold ${
            bright ? 'opacity-80' : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          {clinicFormatDay(date, startTime)}
          {practitioner ? ` · ${practitioner}` : ''}
        </p>
        <p
          className={`mt-1 text-[11px] font-bold ${
            bright ? 'opacity-70' : 'text-slate-500'
          }`}
        >
          {open ? 'Hide visit' : 'Tap for visit details'}
        </p>
      </button>
      {open ? (
        <div className="mt-3 space-y-2">
          <p
            className={`text-[10px] font-black uppercase ${
              bright ? 'opacity-70' : 'text-slate-500'
            }`}
          >
            {status.replace(/_/g, ' ')}
          </p>
          {icsHref ? (
            <a
              className={`text-[11px] font-bold underline ${
                bright ? 'opacity-80' : 'text-slate-700'
              }`}
              href={icsHref}
            >
              Add to calendar
            </a>
          ) : null}
          {ended ? (
            <MemberRateLink
              href={rateHref}
              submitted={rateSubmitted}
              label="Rate this visit (optional)"
              className={bright ? 'text-inherit' : undefined}
            />
          ) : null}
          {onCancel && (status === 'booked' || status === 'waitlist') ? (
            <button
              type="button"
              disabled={busy}
              className={`text-xs font-bold ${
                bright ? 'underline' : 'text-rose-600'
              }`}
              onClick={onCancel}
            >
              <X className="mr-0.5 inline h-3.5 w-3.5" /> Cancel
            </button>
          ) : null}
        </div>
      ) : ended ? (
        <MemberRateLink
          href={rateHref}
          submitted={rateSubmitted}
          label="Rate this visit (optional)"
          className={bright ? 'text-inherit' : undefined}
        />
      ) : null}
    </div>
  );
}

export type ClinicMemberBooking = {
  booking_id: string;
  status: string;
  date: string;
  start_time: string;
  service_name: string;
  practitioner_name?: string;
  feedback_token?: string | null;
  feedback_submitted_at?: string | null;
};

export function ClinicMemberBookList({
  bookings,
  module,
  companyId,
  color,
  busyId,
  onCancel,
}: {
  bookings: ClinicMemberBooking[];
  module: string;
  companyId: number | null | undefined;
  color: string;
  busyId?: string | null;
  onCancel: (bookingId: string) => void;
}) {
  const upcoming = bookings
    .filter(
      (b) =>
        b.status !== 'cancelled' &&
        b.status !== 'attended' &&
        b.status !== 'no_show' &&
        !sessionHasEnded(b.date, b.start_time)
    )
    .slice()
    .sort((a, b) =>
      a.date === b.date
        ? String(a.start_time).localeCompare(String(b.start_time))
        : a.date.localeCompare(b.date)
    );
  const done = bookings
    .filter(
      (b) =>
        b.status !== 'cancelled' &&
        (b.status === 'attended' ||
          b.status === 'no_show' ||
          sessionHasEnded(b.date, b.start_time))
    )
    .slice()
    .sort((a, b) =>
      a.date === b.date
        ? String(b.start_time).localeCompare(String(a.start_time))
        : b.date.localeCompare(a.date)
    );
  if (!upcoming.length && !done.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-neutral-900">
        No upcoming bookings.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {upcoming.map((b, i) => (
        <ClinicVisitCard
          key={b.booking_id}
          serviceName={b.service_name}
          date={b.date}
          startTime={b.start_time}
          practitioner={b.practitioner_name}
          status={b.status}
          color={color}
          featured={i === 0}
          icsHref={`/api/public/advisor/ics?module=${encodeURIComponent(module)}&date=${encodeURIComponent(b.date)}&start=${encodeURIComponent(b.start_time)}&title=${encodeURIComponent(b.service_name || 'Appointment')}&duration=45`}
          onCancel={
            b.status === 'booked' || b.status === 'waitlist'
              ? () => onCancel(b.booking_id)
              : undefined
          }
          busy={busyId === b.booking_id}
        />
      ))}
      {done.length ? (
        <>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            After visit
          </p>
          {done.slice(0, 8).map((b) => (
            <ClinicVisitCard
              key={`done-${b.booking_id}`}
              serviceName={b.service_name}
              date={b.date}
              startTime={b.start_time}
              practitioner={b.practitioner_name}
              status={b.status}
              color={color}
              featured={false}
              ended
              attended={b.status === 'attended'}
              icsHref={`/api/public/advisor/ics?module=${encodeURIComponent(module)}&date=${encodeURIComponent(b.date)}&start=${encodeURIComponent(b.start_time)}&title=${encodeURIComponent(b.service_name || 'Appointment')}&duration=45`}
              rateHref={publicRatePath(module, companyId, b.feedback_token)}
              rateSubmitted={Boolean(b.feedback_submitted_at)}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}
