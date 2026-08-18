'use client';

import { useMemo, useState } from 'react';
import { Loader2, ListOrdered } from 'lucide-react';
import { toast } from 'sonner';

export type DeskQueueRow = {
  id: string;
  patient_id: string;
  patient_name?: string;
  accept_any_clinician?: boolean;
  preferred_clinician_id?: string | null;
  preferred_clinician_name?: string | null;
  service_name?: string | null;
  notes?: string;
  status: string;
  created_at: string;
  position?: number;
};

export type DeskSlotWaitlistRow = {
  booking_id: string;
  patient_id: string;
  patient_name?: string;
  appointment_id: string;
  date?: string;
  start_time?: string;
  service_name?: string;
  clinician_name?: string;
  position: number;
  booked_at?: string;
};

type Props = {
  queue: DeskQueueRow[];
  slotWaitlist: DeskSlotWaitlistRow[];
  post: (body: Record<string, unknown>) => Promise<unknown>;
  onRefresh: () => void;
  accentClass?: string;
  calendarHref?: string;
};

export function AdvisorWaitlistDesk({
  queue,
  slotWaitlist,
  post,
  onRefresh,
  accentClass = 'border-sky-200',
  calendarHref,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const openQueue = useMemo(
    () => queue.filter((q) => q.status === 'waiting'),
    [queue]
  );

  const bookSlot = async (bookingId: string) => {
    setBusy(bookingId);
    try {
      await post({
        action: 'promote_slot_waitlist',
        booking_id: bookingId,
      });
      toast.success('Booked from waitlist');
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not book');
    } finally {
      setBusy(null);
    }
  };

  const mark = async (id: string, status: 'contacted' | 'booked' | 'cancelled') => {
    setBusy(id);
    try {
      await post({
        action: 'manage_waitlist_queue',
        queue_id: id,
        status,
      });
      toast.success(
        status === 'booked'
          ? 'Marked booked'
          : status === 'contacted'
            ? 'Marked contacted'
            : 'Removed from queue'
      );
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={`rounded-3xl border ${accentClass} bg-white dark:bg-slate-950 p-4 sm:p-5 space-y-4`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
            <ListOrdered className="w-4 h-4" /> Waitlist & next-available queue
          </p>
          <p className="text-[11px] text-slate-500">
            Waitlist and next-available requests from SA Member / the portal.
            Book someone in from here, or open the diary.
          </p>
        </div>
        <span className="text-[10px] font-black uppercase text-slate-400">
          {openQueue.length} next-available · {slotWaitlist.length} on slots
        </span>
      </div>

      <section className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          Next available (practice queue)
        </p>
        {openQueue.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">No one in the general queue.</p>
        ) : (
          <ul className="space-y-2">
            {openQueue.map((q) => (
              <li
                key={q.id}
                className="rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold">
                    #{q.position ?? '—'} · {q.patient_name || q.patient_id}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {q.accept_any_clinician
                      ? 'Any clinician'
                      : q.preferred_clinician_name
                        ? `Prefers ${q.preferred_clinician_name}`
                        : 'Preferred clinician only'}
                    {q.service_name ? ` · ${q.service_name}` : ''}
                    {q.notes ? ` · ${q.notes}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={busy === q.id}
                    onClick={() => void mark(q.id, 'contacted')}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold"
                  >
                    Contacted
                  </button>
                  <button
                    type="button"
                    disabled={busy === q.id}
                    onClick={() => void mark(q.id, 'booked')}
                    className="rounded-lg bg-emerald-600 text-white px-2 py-1 text-[10px] font-bold"
                  >
                    Booked
                  </button>
                  <button
                    type="button"
                    disabled={busy === q.id}
                    onClick={() => void mark(q.id, 'cancelled')}
                    className="rounded-lg border border-rose-200 text-rose-700 px-2 py-1 text-[10px] font-bold"
                  >
                    Remove
                  </button>
                  {busy === q.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          Waitlist on full slots
        </p>
        {slotWaitlist.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">No slot waitlists right now.</p>
        ) : (
          <ul className="space-y-2 max-h-56 overflow-y-auto">
            {slotWaitlist.map((r) => (
              <li
                key={r.booking_id}
                className="rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <span className="font-bold">
                    #{r.position} · {r.patient_name || r.patient_id}
                  </span>
                  <span className="text-slate-500 text-xs block">
                    {[r.date, r.start_time?.slice(0, 5), r.service_name, r.clinician_name]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busy === r.booking_id}
                  onClick={() => void bookSlot(r.booking_id)}
                  className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50"
                >
                  Book in
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate-400">
          When a booked patient cancels, the next waitlisted person is promoted
          automatically.
        </p>
      </section>
    </div>
  );
}
