'use client';

import { useState } from 'react';
import {
  FEEDBACK_FEELING_LABELS,
  FEEDBACK_TAG_OPTIONS,
  type FitClassFeedback,
} from '@/lib/fitness/fitgraph';

export type FeedbackFormValue = {
  feeling: number;
  intensity: number;
  enjoyment: number;
  would_return: number;
  comment: string;
  tags: string[];
};

const defaultValue = (seed?: Partial<FitClassFeedback> | null): FeedbackFormValue => ({
  feeling: seed?.feeling ?? 4,
  intensity: seed?.intensity ?? 6,
  enjoyment: seed?.enjoyment ?? 4,
  would_return: seed?.would_return ?? 4,
  comment: seed?.comment || '',
  tags: seed?.tags ? [...seed.tags] : [],
});

/**
 * Shared member / coach post-class feedback form.
 */
export function FitClassFeedbackForm({
  role,
  title,
  description,
  initial,
  busy,
  onSubmit,
  dark,
  requireIdentity,
  name,
  email,
  onNameChange,
  onEmailChange,
}: {
  role: 'member' | 'coach';
  title?: string;
  description?: string;
  initial?: Partial<FitClassFeedback> | null;
  busy?: boolean;
  onSubmit: (v: FeedbackFormValue) => void | Promise<void>;
  dark?: boolean;
  /** Member join: collect name/email to match booking */
  requireIdentity?: boolean;
  name?: string;
  email?: string;
  onNameChange?: (v: string) => void;
  onEmailChange?: (v: string) => void;
}) {
  const [v, setV] = useState<FeedbackFormValue>(() => defaultValue(initial));

  const shell = dark
    ? 'rounded-2xl border border-slate-700 bg-slate-950/50 p-4 space-y-3'
    : 'rounded-2xl border border-violet-100 bg-violet-50/50 p-4 space-y-3';
  const label = dark
    ? 'text-[10px] font-black uppercase tracking-wider text-amber-400/90'
    : 'text-[10px] font-black uppercase tracking-wider text-violet-700';
  const muted = dark ? 'text-slate-400' : 'text-slate-600';
  const input = dark
    ? 'w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100'
    : 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm';
  const chipOn = dark
    ? 'border-amber-500 bg-amber-500 text-amber-950'
    : 'border-violet-600 bg-violet-600 text-white';
  const chipOff = dark
    ? 'border-slate-600 bg-slate-900 text-slate-300'
    : 'border-violet-200 bg-white text-violet-900';

  const toggleTag = (t: string) => {
    setV((cur) => ({
      ...cur,
      tags: cur.tags.includes(t)
        ? cur.tags.filter((x) => x !== t)
        : [...cur.tags, t],
    }));
  };

  return (
    <div className={shell}>
      <div>
        <h3 className={`text-sm font-black ${dark ? 'text-amber-50' : 'text-slate-900'}`}>
          {title ||
            (role === 'coach'
              ? 'Your coach check-in'
              : 'How was class for you?')}
        </h3>
        <p className={`text-[11px] mt-0.5 ${muted}`}>
          {description ||
            (role === 'coach'
              ? 'After you train / teach — how you feel and how hard the class was.'
              : 'After class — how you feel and the intensity. Helps coaches plan better.')}
        </p>
      </div>

      {requireIdentity && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            className={input}
            placeholder="Name (as booked)"
            value={name || ''}
            onChange={(e) => onNameChange?.(e.target.value)}
          />
          <input
            className={input}
            type="email"
            placeholder="Email (as booked)"
            value={email || ''}
            onChange={(e) => onEmailChange?.(e.target.value)}
          />
        </div>
      )}

      <div>
        <div className="flex justify-between items-baseline gap-2">
          <span className={label}>How do you feel?</span>
          <span className={`text-[11px] font-bold ${muted}`}>
            {FEEDBACK_FEELING_LABELS[v.feeling] || v.feeling}/5
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          value={v.feeling}
          onChange={(e) =>
            setV((cur) => ({ ...cur, feeling: Number(e.target.value) }))
          }
          className="w-full mt-1 accent-violet-600"
        />
        <div className={`flex justify-between text-[9px] ${muted}`}>
          <span>Drained</span>
          <span>Energised</span>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-baseline gap-2">
          <span className={label}>Class intensity (RPE)</span>
          <span className={`text-[11px] font-bold ${muted}`}>{v.intensity}/10</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={v.intensity}
          onChange={(e) =>
            setV((cur) => ({ ...cur, intensity: Number(e.target.value) }))
          }
          className="w-full mt-1 accent-amber-500"
        />
        <div className={`flex justify-between text-[9px] ${muted}`}>
          <span>Easy</span>
          <span>Max effort</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="flex justify-between items-baseline gap-2">
            <span className={label}>Enjoyment</span>
            <span className={`text-[11px] font-bold ${muted}`}>
              {v.enjoyment}/5
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            value={v.enjoyment}
            onChange={(e) =>
              setV((cur) => ({ ...cur, enjoyment: Number(e.target.value) }))
            }
            className="w-full mt-1 accent-emerald-500"
          />
        </div>
        <div>
          <div className="flex justify-between items-baseline gap-2">
            <span className={label}>
              {role === 'coach' ? 'Would teach again' : 'Would do again'}
            </span>
            <span className={`text-[11px] font-bold ${muted}`}>
              {v.would_return}/5
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            value={v.would_return}
            onChange={(e) =>
              setV((cur) => ({
                ...cur,
                would_return: Number(e.target.value),
              }))
            }
            className="w-full mt-1 accent-sky-500"
          />
        </div>
      </div>

      <div>
        <p className={label + ' mb-1.5'}>Tags (optional)</p>
        <div className="flex flex-wrap gap-1.5">
          {FEEDBACK_TAG_OPTIONS.map((t) => {
            const on = v.tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                  on ? chipOn : chipOff
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <textarea
        className={input + ' min-h-[4rem] resize-y'}
        placeholder={
          role === 'coach'
            ? 'Notes for the owner (energy, equipment, class flow…)'
            : 'Anything else? (optional)'
        }
        value={v.comment}
        onChange={(e) => setV((cur) => ({ ...cur, comment: e.target.value }))}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => void onSubmit(v)}
        className={
          dark
            ? 'w-full rounded-xl bg-amber-500 text-amber-950 py-2.5 text-sm font-black disabled:opacity-50'
            : 'w-full rounded-xl bg-violet-600 text-white py-2.5 text-sm font-black disabled:opacity-50'
        }
      >
        {busy ? 'Saving…' : 'Submit feedback'}
      </button>
    </div>
  );
}
