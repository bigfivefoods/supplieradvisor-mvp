'use client';

import { useState } from 'react';

type CatalogueItem = {
  id: string;
  name: string;
  unit: string;
  win: 'higher' | 'faster';
  source: 'owner' | 'coach';
};

type AssignedItem = {
  id: string;
  name: string;
  unit: string;
  win: 'higher' | 'faster';
  source: 'owner' | 'coach';
  class_name?: string | null;
  assignment_id?: string | null;
  session_pinned?: boolean;
  field?: number;
};

export function GymBoardCoachPanel({
  catalogue,
  assigned,
  busy,
  onAssign,
  onUnassign,
  onCreateExtra,
}: {
  catalogue: CatalogueItem[];
  assigned: AssignedItem[];
  busy?: boolean;
  onAssign: (activityId: string, pinSession: boolean) => Promise<void> | void;
  onUnassign: (assignmentId: string) => Promise<void> | void;
  onCreateExtra: (v: {
    name: string;
    unit: string;
    win: 'higher' | 'faster';
    pin_session: boolean;
  }) => Promise<void> | void;
}) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [win, setWin] = useState<'higher' | 'faster'>('higher');
  const [pin, setPin] = useState(true);
  const assignedIds = new Set(assigned.map((a) => a.id));

  return (
    <div className="rounded-2xl border border-amber-300/40 bg-amber-50/40 p-3 space-y-3 dark:border-amber-500/30 dark:bg-amber-950/20">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
          Gym leadership board
        </p>
        <p className="text-[11px] font-semibold text-slate-500">
          Pin owner activities on this class, or add an extra. Members log
          scores in the PWA and rank by age and sex.
        </p>
      </div>
      {catalogue.filter((c) => c.source === 'owner').length ? (
        <ul className="space-y-1">
          {catalogue
            .filter((c) => c.source === 'owner')
            .map((c) => {
              const on = assignedIds.has(c.id);
              const row = assigned.find((a) => a.id === c.id);
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-white/80 px-2.5 py-1.5 text-sm dark:bg-neutral-900/80"
                >
                  <span className="min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {c.name}
                    </span>
                    <span className="ml-1 text-[11px] text-slate-500">
                      {c.unit}
                      {row?.field ? ` · ${row.field} logged` : ''}
                    </span>
                  </span>
                  {on && row?.assignment_id ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="text-[11px] font-black text-rose-700"
                      onClick={() => void onUnassign(row.assignment_id!)}
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      className="text-[11px] font-black text-slate-900 dark:text-white"
                      onClick={() => void onAssign(c.id, pin)}
                    >
                      Add
                    </button>
                  )}
                </li>
              );
            })}
        </ul>
      ) : (
        <p className="text-[11px] text-slate-500">
          The owner has not set gym activities yet (GymAdvisor → Leadership).
        </p>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <input
          className="input col-span-2 !py-1.5 !px-2 !text-sm"
          placeholder="Extra activity for this class"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="input !py-1.5 !px-2 !text-xs"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        >
          {['kg', 'reps', 'm', 'km', 'min', 'sec', 'rounds'].map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <select
          className="input !py-1.5 !px-2 !text-xs"
          value={win}
          onChange={(e) =>
            setWin(e.target.value === 'faster' ? 'faster' : 'higher')
          }
        >
          <option value="higher">Highest</option>
          <option value="faster">Fastest</option>
        </select>
        <label className="col-span-2 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={pin}
            onChange={(e) => setPin(e.target.checked)}
          />
          This session only
        </label>
        <button
          type="button"
          disabled={busy || !name.trim()}
          className="col-span-2 rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-amber-950 disabled:opacity-50"
          onClick={() =>
            void onCreateExtra({
              name: name.trim(),
              unit,
              win,
              pin_session: pin,
            })
          }
        >
          Add extra activity
        </button>
      </div>
    </div>
  );
}
