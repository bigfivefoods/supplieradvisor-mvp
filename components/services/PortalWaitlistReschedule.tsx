'use client';

/**
 * Patient portal: confirm waitlist promotion + reschedule within policy.
 */
import { useState } from 'react';
import { CalendarClock, CheckCircle2, Loader2 } from 'lucide-react';

type Booking = {
  booking_id: string;
  status: string;
  date?: string;
  start_time?: string;
  service_name?: string;
  waitlist_offered_at?: string | null;
  waitlist_accepted_at?: string | null;
};

type Slot = {
  id: string;
  date: string;
  start_time: string;
  service_name: string;
  full?: boolean;
  my_status?: string | null;
};

type Props = {
  bookings: Booking[];
  openSlots?: Slot[];
  post: (body: Record<string, unknown>) => Promise<{ message?: string; error?: string }>;
  onDone?: () => void;
  accent?: string;
};

export function PortalWaitlistReschedule({
  bookings,
  openSlots = [],
  post,
  onDone,
  accent = '#0d9488',
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [target, setTarget] = useState('');

  const needConfirm = bookings.filter(
    (b) =>
      (b.status === 'booked' || b.status === 'waitlist') &&
      b.waitlist_offered_at &&
      !b.waitlist_accepted_at
  );
  const canReschedule = bookings.filter((b) => b.status === 'booked');

  if (!needConfirm.length && !canReschedule.length) return null;

  const run = async (body: Record<string, unknown>, key: string) => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      const data = await post(body);
      if (data?.error) throw new Error(data.error);
      setMsg(data?.message || 'Updated');
      setRescheduleFor(null);
      setTarget('');
      onDone?.();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <p className="text-sm font-black text-slate-900 flex items-center gap-1.5">
        <CalendarClock className="w-4 h-4" style={{ color: accent }} />
        Confirm & reschedule
      </p>
      {msg ? (
        <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> {msg}
        </p>
      ) : null}
      {err ? <p className="text-xs font-semibold text-rose-600">{err}</p> : null}

      {needConfirm.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Confirm your place
          </p>
          {needConfirm.map((b) => (
            <div
              key={b.booking_id}
              className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 flex flex-wrap items-center justify-between gap-2"
            >
              <div className="text-sm">
                <p className="font-bold">
                  {b.date} {b.start_time?.slice(0, 5)}
                </p>
                <p className="text-[11px] text-slate-600">
                  {b.service_name || 'Appointment'} · offered from waitlist
                </p>
              </div>
              <button
                type="button"
                disabled={busy === b.booking_id}
                onClick={() =>
                  void run(
                    { action: 'confirm_waitlist', booking_id: b.booking_id },
                    b.booking_id
                  )
                }
                className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50 inline-flex items-center gap-1"
                style={{ backgroundColor: accent }}
              >
                {busy === b.booking_id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : null}
                Confirm place
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {canReschedule.length > 0 && openSlots.some((s) => !s.full && !s.my_status) ? (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Reschedule (practice policy applies)
          </p>
          {canReschedule.slice(0, 5).map((b) => (
            <div key={b.booking_id} className="space-y-1.5">
              <button
                type="button"
                className="text-left text-sm font-semibold text-slate-800 w-full"
                onClick={() =>
                  setRescheduleFor(
                    rescheduleFor === b.booking_id ? null : b.booking_id
                  )
                }
              >
                {b.date} {b.start_time?.slice(0, 5)} · {b.service_name || 'Visit'}
                <span className="text-[11px] font-normal text-slate-400">
                  {' '}
                  — change slot
                </span>
              </button>
              {rescheduleFor === b.booking_id ? (
                <div className="flex flex-wrap gap-2">
                  <select
                    className="flex-1 min-w-[10rem] rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  >
                    <option value="">New open slot…</option>
                    {openSlots
                      .filter((s) => !s.full && !s.my_status)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.date} {s.start_time.slice(0, 5)} · {s.service_name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!target || busy === `r-${b.booking_id}`}
                    onClick={() =>
                      void run(
                        {
                          action: 'reschedule',
                          booking_id: b.booking_id,
                          appointment_id: target,
                        },
                        `r-${b.booking_id}`
                      )
                    }
                    className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-[11px] font-bold disabled:opacity-50"
                  >
                    {busy === `r-${b.booking_id}` ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      'Move'
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
