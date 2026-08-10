'use client';

import { useState } from 'react';
import { Loader2, Stethoscope } from 'lucide-react';

type Props = {
  personId: string;
  personLabel?: string;
  bookingId?: string | null;
  onSave: (payload: {
    body: string;
    pain_score: number | null;
    function_score: number | null;
  }) => Promise<void>;
  accentClass?: string;
};

/** Quick visit note + outcome scores for desk */
export function AdvisorClinicalPanel({
  personId,
  personLabel,
  bookingId,
  onSave,
  accentClass = 'border-slate-200',
}: Props) {
  const [body, setBody] = useState('');
  const [pain, setPain] = useState('');
  const [fn, setFn] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!personId) return null;

  const save = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await onSave({
        body: body.trim(),
        pain_score: pain === '' ? null : Number(pain),
        function_score: fn === '' ? null : Number(fn),
      });
      setBody('');
      setPain('');
      setFn('');
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border ${accentClass} bg-white dark:bg-slate-950 p-4 space-y-3`}
    >
      <div className="flex items-center gap-2">
        <Stethoscope className="w-4 h-4 text-slate-500" />
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white">
            Visit note
          </p>
          <p className="text-[11px] text-slate-500">
            {personLabel || personId}
            {bookingId ? ` · booking ${bookingId.slice(0, 8)}` : ''}
          </p>
        </div>
      </div>
      <textarea
        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm min-h-[88px]"
        placeholder="Session / clinical note…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] font-bold text-slate-500">
          Pain 0–10
          <input
            type="number"
            min={0}
            max={10}
            className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm"
            value={pain}
            onChange={(e) => setPain(e.target.value)}
          />
        </label>
        <label className="text-[11px] font-bold text-slate-500">
          Function 0–10
          <input
            type="number"
            min={0}
            max={10}
            className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-sm"
            value={fn}
            onChange={(e) => setFn(e.target.value)}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={busy || !body.trim()}
        onClick={() => void save()}
        className="rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2 text-xs font-bold disabled:opacity-50 inline-flex items-center gap-2"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        {done ? 'Saved' : 'Save note'}
      </button>
    </div>
  );
}
