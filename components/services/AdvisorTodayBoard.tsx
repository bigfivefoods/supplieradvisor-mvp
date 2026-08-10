'use client';

/**
 * Mobile-first "today" board for desk / coach / clinician.
 */
import Link from 'next/link';

export type TodayBoardRow = {
  id: string;
  time: string;
  title: string;
  person?: string;
  attendee?: string;
  status: string;
  meta?: string;
  href?: string;
};

type Props = {
  date: string;
  rows: TodayBoardRow[];
  title?: string;
  emptyLabel?: string;
  accentClass?: string;
  onMark?: (id: string, status: 'attended' | 'no_show' | 'cancelled') => void;
  markBusyId?: string | null;
};

export function AdvisorTodayBoard({
  date,
  rows,
  title = "Today's board",
  emptyLabel = 'Nothing scheduled today',
  accentClass = 'border-violet-200',
  onMark,
  markBusyId,
}: Props) {
  return (
    <div
      className={`rounded-3xl border ${accentClass} bg-white dark:bg-slate-950 overflow-hidden`}
    >
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {title}
          </p>
          <p className="text-[11px] text-slate-500">{date}</p>
        </div>
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          {rows.length} slot{rows.length === 1 ? '' : 's'}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  <span className="tabular-nums text-slate-500 font-bold mr-2">
                    {r.time.slice(0, 5)}
                  </span>
                  {r.title}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {[r.person, r.attendee, r.meta, r.status]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {r.href ? (
                  <Link
                    href={r.href}
                    className="rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-1 text-[10px] font-bold"
                  >
                    Open
                  </Link>
                ) : null}
                {onMark &&
                (r.status === 'booked' || r.status === 'waitlist') ? (
                  <>
                    <button
                      type="button"
                      disabled={markBusyId === r.id}
                      onClick={() => onMark(r.id, 'attended')}
                      className="rounded-lg bg-emerald-600 text-white px-2 py-1 text-[10px] font-bold disabled:opacity-50"
                    >
                      Attended
                    </button>
                    <button
                      type="button"
                      disabled={markBusyId === r.id}
                      onClick={() => onMark(r.id, 'no_show')}
                      className="rounded-lg bg-amber-600 text-white px-2 py-1 text-[10px] font-bold disabled:opacity-50"
                    >
                      No-show
                    </button>
                    <button
                      type="button"
                      disabled={markBusyId === r.id}
                      onClick={() => onMark(r.id, 'cancelled')}
                      className="rounded-lg border border-rose-200 text-rose-700 px-2 py-1 text-[10px] font-bold disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
