'use client';

import { Check, UserX } from 'lucide-react';

export type ClinicRosterMarkRow = {
  booking_id: string;
  patient_id: string;
  name: string;
  status: string;
};

export function ClinicBookedRoster({
  roster,
  onMark,
  emptyLabel = 'Nobody booked on this slot yet.',
}: {
  roster: ClinicRosterMarkRow[];
  onMark: (
    bookingId: string,
    status: 'attended' | 'no_show',
    patientId: string
  ) => void;
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 space-y-2 dark:border-slate-700 dark:bg-slate-950/40">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">
        Booked on this slot · {roster.length}
      </p>
      {roster.length === 0 ? (
        <p className="text-[11px] text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
          {roster.map((r) => (
            <li
              key={`${r.patient_id}:${r.booking_id}`}
              className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-yellow-50">
                  {r.name}
                </p>
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  {r.status.replace(/_/g, ' ')}
                </p>
              </div>
              {r.status !== 'cancelled' ? (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    title="Attended — tap once to save"
                    aria-pressed={r.status === 'attended'}
                    className={`inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border px-3 text-xs font-bold ${
                      r.status === 'attended'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onMark(r.booking_id, 'attended', r.patient_id);
                    }}
                  >
                    <Check className="h-4 w-4" />
                    Came
                  </button>
                  <button
                    type="button"
                    title="Did not attend — tap once to save"
                    aria-pressed={r.status === 'no_show'}
                    className={`inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border px-3 text-xs font-bold ${
                      r.status === 'no_show'
                        ? 'border-rose-600 bg-rose-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onMark(r.booking_id, 'no_show', r.patient_id);
                    }}
                  >
                    <UserX className="h-4 w-4" />
                    Didn’t
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
