'use client';

import Link from 'next/link';
import type { PatientVisitHistoryItem } from '@/lib/clinic/visit-history';

export function PatientVisitHistory({
  visits,
  emptyLabel = 'No visits on file yet.',
  calendarHref,
  showPrivate = false,
}: {
  visits: PatientVisitHistoryItem[];
  emptyLabel?: string;
  calendarHref?: (visit: PatientVisitHistoryItem) => string;
  showPrivate?: boolean;
}) {
  if (!visits.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
        {emptyLabel}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {visits.map((v) => (
        <li
          key={v.booking_id}
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {v.service_name}
              </p>
              <p className="text-[12px] text-slate-500">
                {v.date} · {v.start_time}
                {v.practitioner_name ? ` · ${v.practitioner_name}` : ''}
                {v.location ? ` · ${v.location}` : ''}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {v.status.replace(/_/g, ' ')}
            </span>
          </div>
          {v.notes.length ? (
            <ul className="mt-3 space-y-2">
              {v.notes.map((n) => (
                <li
                  key={n.id}
                  className="rounded-xl bg-emerald-50/70 px-3 py-2 text-sm text-slate-800 dark:bg-emerald-950/30 dark:text-emerald-50"
                >
                  <p>{n.body}</p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {n.author_name ? `${n.author_name} · ` : ''}
                    {n.at ? String(n.at).slice(0, 10) : ''}
                    {n.pain_score != null ? ` · pain ${n.pain_score}/10` : ''}
                    {showPrivate && n.private ? ' · private' : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-slate-400">No visit notes on this record.</p>
          )}
          {v.scripts.length ? (
            <p className="mt-2 text-[12px] text-slate-600">
              <strong>Script:</strong>{' '}
              {v.scripts
                .map((s) =>
                  [s.medication, s.strength, s.instructions]
                    .filter(Boolean)
                    .join(' ')
                )
                .join(' · ')}
            </p>
          ) : null}
          {calendarHref ? (
            <Link
              href={calendarHref(v)}
              className="mt-2 inline-block text-[11px] font-bold text-emerald-700 underline"
            >
              Open this appointment
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
