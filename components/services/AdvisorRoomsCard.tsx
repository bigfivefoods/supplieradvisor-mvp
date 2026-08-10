'use client';

import { useState } from 'react';
import { DoorOpen, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  rooms: string[];
  saving?: boolean;
  onSave: (rooms: string[]) => Promise<void>;
  accentClass?: string;
  label?: string;
  hint?: string;
};

/**
 * Named rooms / chairs / studios used as diary resources.
 */
export function AdvisorRoomsCard({
  rooms: initial,
  saving,
  onSave,
  accentClass = 'border-slate-200',
  label = 'Rooms & resources',
  hint = 'Surgeries, bays, studios or chairs. Pick one when scheduling so the diary shows where the visit runs.',
}: Props) {
  const [rooms, setRooms] = useState(() =>
    (initial || []).map((r) => String(r).trim()).filter(Boolean)
  );
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const add = () => {
    const n = draft.trim();
    if (!n) return;
    if (rooms.some((r) => r.toLowerCase() === n.toLowerCase())) {
      toast.error('Already listed');
      return;
    }
    setRooms((r) => [...r, n]);
    setDraft('');
  };

  const remove = (name: string) => {
    setRooms((r) => r.filter((x) => x !== name));
  };

  const save = async () => {
    setBusy(true);
    try {
      await onSave(rooms);
      toast.success('Rooms saved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-3xl border ${accentClass} bg-white dark:bg-slate-950 p-4 sm:p-5 space-y-3`}
    >
      <div className="flex items-start gap-2">
        <DoorOpen className="w-4 h-4 text-slate-500 mt-0.5" />
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {label}
          </p>
          <p className="text-[11px] text-slate-500">{hint}</p>
        </div>
      </div>

      {rooms.length === 0 ? (
        <p className="text-sm text-slate-500">No rooms yet — add Surgery 1, Bay A, Studio…</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {rooms.map((r) => (
            <li
              key={r}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold"
            >
              {r}
              <button
                type="button"
                className="text-slate-400 hover:text-rose-600"
                onClick={() => remove(r)}
                aria-label={`Remove ${r}`}
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          className="flex-1 min-w-[10rem] rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm"
          placeholder="Room name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
        <button
          type="button"
          disabled={busy || saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1.5 text-xs font-bold disabled:opacity-50"
        >
          {busy || saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : null}
          Save rooms
        </button>
      </div>
    </div>
  );
}
