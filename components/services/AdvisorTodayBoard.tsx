'use client';

/**
 * Mobile-first "today" board for desk / coach / clinician.
 * Gym floor board (`groups`): class expands to coach, then members.
 */
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

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

export type TodayBoardGroup = {
  id: string;
  time: string;
  title: string;
  person?: string;
  meta?: string;
  href?: string;
  members: TodayBoardRow[];
};

type Props = {
  date: string;
  rows?: TodayBoardRow[];
  /** Gym floor board: members listed under each class, earliest class first. */
  groups?: TodayBoardGroup[];
  title?: string;
  emptyLabel?: string;
  accentClass?: string;
  onMark?: (id: string, status: 'attended' | 'no_show' | 'cancelled') => void;
  markBusyId?: string | null;
};

function FloorClassBlock({
  g,
  defaultOpen,
  onMark,
  markBusyId,
}: {
  g: TodayBoardGroup;
  defaultOpen: boolean;
  onMark?: (id: string, status: 'attended' | 'no_show' | 'cancelled') => void;
  markBusyId?: string | null;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <li className="px-4 py-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40">
        <div className="flex items-start gap-1">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left"
          >
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                open ? '' : '-rotate-90'
              }`}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-slate-900 dark:text-white">
                <span className="mr-2 font-bold tabular-nums text-slate-500">
                  {g.time.slice(0, 5)}
                </span>
                {g.title}
              </span>
              <span className="block text-xs text-slate-500">
                {[
                  g.person,
                  g.meta,
                  g.members.length
                    ? `${g.members.length} member${
                        g.members.length === 1 ? '' : 's'
                      }`
                    : 'no members yet',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          </button>
          {g.href ? (
            <Link
              href={g.href}
              className="mr-3 mt-2.5 shrink-0 self-start rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold dark:border-slate-600"
            >
              Open
            </Link>
          ) : null}
        </div>
        {open ? (
          <div className="space-y-3 border-t border-slate-100 p-3 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {g.person ? `Coach · ${g.person}` : 'Coach · unassigned'}
            </p>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Members
              </p>
              {g.members.length === 0 ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  Nobody booked or subscribed yet.
                </p>
              ) : (
                <ul className="mt-1.5 space-y-1.5">
                  {g.members.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900/60"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {m.attendee || m.title}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {m.status ? m.status.replace(/_/g, ' ') : 'planned'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <MarkButtons
                          id={m.id}
                          status={m.status}
                          onMark={onMark}
                          markBusyId={markBusyId}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function MarkButtons({
  id,
  status,
  onMark,
  markBusyId,
}: {
  id: string;
  status: string;
  onMark?: (id: string, status: 'attended' | 'no_show' | 'cancelled') => void;
  markBusyId?: string | null;
}) {
  if (!onMark || (status !== 'booked' && status !== 'waitlist')) return null;
  return (
    <>
      <button
        type="button"
        disabled={markBusyId === id}
        onClick={() => onMark(id, 'attended')}
        className="rounded-lg bg-emerald-600 text-white px-2 py-1 text-[10px] font-bold disabled:opacity-50"
      >
        Attended
      </button>
      <button
        type="button"
        disabled={markBusyId === id}
        onClick={() => onMark(id, 'no_show')}
        className="rounded-lg bg-amber-600 text-white px-2 py-1 text-[10px] font-bold disabled:opacity-50"
      >
        No-show
      </button>
      <button
        type="button"
        disabled={markBusyId === id}
        onClick={() => onMark(id, 'cancelled')}
        className="rounded-lg border border-rose-200 text-rose-700 px-2 py-1 text-[10px] font-bold disabled:opacity-50"
      >
        Cancel
      </button>
    </>
  );
}

export function AdvisorTodayBoard({
  date,
  rows = [],
  groups,
  title = "Today's board",
  emptyLabel = 'Nothing scheduled today',
  accentClass = 'border-violet-200',
  onMark,
  markBusyId,
}: Props) {
  const grouped = Array.isArray(groups)
    ? [...groups].sort(
        (a, b) =>
          String(a.time || '').localeCompare(String(b.time || '')) ||
          String(a.title || '').localeCompare(String(b.title || ''))
      )
    : null;
  const [wave, setWave] = useState({ n: 0, open: true });
  const empty = grouped ? grouped.length === 0 : rows.length === 0;
  const memberCount = grouped
    ? grouped.reduce((n, g) => n + g.members.length, 0)
    : rows.length;
  const countLabel = grouped
    ? `${grouped.length} class${grouped.length === 1 ? '' : 'es'} · ${memberCount} member${
        memberCount === 1 ? '' : 's'
      }`
    : `${rows.length} slot${rows.length === 1 ? '' : 's'}`;

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
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            {countLabel}
          </span>
          {grouped && grouped.length > 0 ? (
            <div className="flex gap-2">
              <button
                type="button"
                className="text-[10px] font-black uppercase tracking-wide text-slate-600"
                onClick={() => setWave((w) => ({ n: w.n + 1, open: true }))}
              >
                Expand all
              </button>
              <button
                type="button"
                className="text-[10px] font-black uppercase tracking-wide text-slate-400"
                onClick={() => setWave((w) => ({ n: w.n + 1, open: false }))}
              >
                Collapse all
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {empty ? (
        <p className="p-6 text-center text-sm text-slate-500">{emptyLabel}</p>
      ) : grouped ? (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {grouped.map((g) => (
            <FloorClassBlock
              key={`${g.id}:${wave.n}`}
              g={g}
              defaultOpen={wave.open}
              onMark={onMark}
              markBusyId={markBusyId}
            />
          ))}
        </ul>
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
                <MarkButtons
                  id={r.id}
                  status={r.status}
                  onMark={onMark}
                  markBusyId={markBusyId}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
