'use client';

import { Check, UserX } from 'lucide-react';

export type BookedRosterRow = {
  booking_id: string;
  client_id?: string;
  name: string;
  status: string;
  rsvp?: 'coming' | 'not_coming' | null;
  coach_feedback?: string | null;
};

export function ClassBookedRoster({
  roster,
  addQuery,
  onAddQuery,
  addChoices,
  selectedIds,
  onToggleAdd,
  onBook,
  onMark,
  saving,
  emptyLabel = 'Nobody booked on this class yet.',
}: {
  roster: BookedRosterRow[];
  addQuery: string;
  onAddQuery: (v: string) => void;
  addChoices: Array<{ id: string; name: string; already?: boolean }>;
  selectedIds: string[];
  onToggleAdd: (id: string) => void;
  onBook: () => void;
  onMark?: (bookingId: string, status: 'attended' | 'no_show' | 'booked') => void;
  saving?: boolean;
  emptyLabel?: string;
}) {
  const q = addQuery.trim();
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/50 px-3 py-2 space-y-2 dark:border-sky-800 dark:bg-sky-950/30">
      <p className="text-[10px] font-black uppercase tracking-wide text-sky-800 dark:text-sky-200">
        Booked on this class · {roster.length}
      </p>
      {roster.length === 0 ? (
        <p className="text-[11px] text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-sky-100 dark:divide-sky-900 rounded-lg border border-sky-100 bg-white dark:border-sky-900 dark:bg-slate-950">
          {roster.map((r) => (
            <li
              key={r.booking_id}
              className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-yellow-50">
                  {r.name}
                </p>
                <p className="text-[10px] uppercase font-bold text-slate-500">
                  {r.status.replace(/_/g, ' ')}
                  {r.rsvp === 'coming'
                    ? ' · will attend'
                    : r.rsvp === 'not_coming'
                      ? ' · won’t attend'
                      : ''}
                </p>
                {r.coach_feedback ? (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Coach: {r.coach_feedback}
                  </p>
                ) : null}
              </div>
              {onMark && r.status !== 'cancelled' ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    title="Attended"
                    className={`rounded-lg border p-1.5 text-xs ${
                      r.status === 'attended'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-200 dark:border-slate-600'
                    }`}
                    onClick={() => onMark(r.booking_id, 'attended')}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="No-show"
                    className={`rounded-lg border p-1.5 text-xs ${
                      r.status === 'no_show'
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : 'border-slate-200 dark:border-slate-600'
                    }`}
                    onClick={() => onMark(r.booking_id, 'no_show')}
                  >
                    <UserX className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <input
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-sky-800 dark:bg-slate-950 dark:text-yellow-50"
        placeholder="Search to add a booked member…"
        value={addQuery}
        onChange={(e) => onAddQuery(e.target.value)}
      />
      {q.length > 0 && q.length < 2 ? (
        <p className="text-[11px] text-slate-500">Type at least 2 letters to search members.</p>
      ) : null}
      {q.length >= 2 ? (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-sky-100 bg-white divide-y divide-slate-100 dark:border-sky-900 dark:bg-slate-950 dark:divide-slate-800">
          {addChoices.length === 0 ? (
            <p className="px-2.5 py-2 text-[11px] text-slate-500">No matching members.</p>
          ) : (
            addChoices.map((c) => {
              const on = selectedIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex items-start gap-2 px-2.5 py-1.5 text-sm ${
                    c.already
                      ? 'opacity-50'
                      : 'cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-950/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={c.already}
                    checked={c.already || on}
                    onChange={() => !c.already && onToggleAdd(c.id)}
                  />
                  <span>
                    <span className="font-semibold">{c.name}</span>
                    {c.already ? (
                      <span className="text-[10px] text-slate-500"> · already booked</span>
                    ) : null}
                  </span>
                </label>
              );
            })
          )}
        </div>
      ) : null}
      <button
        type="button"
        disabled={saving || !selectedIds.length}
        className="rounded-xl bg-sky-600 text-white px-3 py-2 text-xs font-bold disabled:opacity-50"
        onClick={onBook}
      >
        {selectedIds.length
          ? `Book ${selectedIds.length} member(s)`
          : 'Book selected members'}
      </button>
    </div>
  );
}
