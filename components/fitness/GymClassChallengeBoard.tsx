'use client';

import { useState } from 'react';
import { Trophy } from 'lucide-react';
import {
  CHALLENGE_UNITS,
  type ChallengeView,
} from '@/lib/fitness/class-challenges';

const fieldClass =
  'mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-neutral-950';

export function GymClassChallengeBoard({
  challenge,
  color,
  ink,
  busy,
  canEdit,
  canLog,
  pinSessionDefault,
  onSave,
  onClose,
  onLog,
}: {
  challenge: ChallengeView | null;
  color: string;
  ink: string;
  busy?: boolean;
  canEdit?: boolean;
  canLog?: boolean;
  pinSessionDefault?: boolean;
  onSave?: (patch: {
    title: string;
    unit: string;
    win: 'higher' | 'faster';
    target: string;
    notes: string;
    pin_session: boolean;
  }) => void | Promise<void>;
  onClose?: () => void | Promise<void>;
  onLog?: (patch: {
    value: string;
    division: 'rx' | 'scaled';
  }) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(!challenge && Boolean(canEdit));
  const [title, setTitle] = useState(challenge?.title || '');
  const [unit, setUnit] = useState(challenge?.unit || 'kg');
  const [win, setWin] = useState<'higher' | 'faster'>(
    challenge?.win || 'higher'
  );
  const [target, setTarget] = useState(
    challenge?.target_display?.replace(/\s+\S+$/, '') || ''
  );
  const [notes, setNotes] = useState(challenge?.notes || '');
  const [pinSession, setPinSession] = useState(pinSessionDefault === true);
  const [score, setScore] = useState(
    challenge?.my_score?.display.replace(/\s+\S+$/, '') || ''
  );
  const [division, setDivision] = useState<'rx' | 'scaled'>(
    challenge?.my_score?.division || 'rx'
  );

  const board = challenge?.board || [];

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
            <Trophy className="h-3.5 w-3.5" />
            Class board
          </p>
          {challenge ? (
            <>
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {challenge.title}
              </p>
              <p className="text-[11px] text-slate-500">
                {challenge.win === 'faster' ? 'Fastest wins' : 'Highest wins'}
                {challenge.target_display
                  ? ` · target ${challenge.target_display}`
                  : ''}
                {challenge.class_name ? ` · ${challenge.class_name}` : ''}
              </p>
            </>
          ) : (
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {canEdit
                ? 'Set a test for this class'
                : 'No test on this class yet'}
            </p>
          )}
        </div>
        {canEdit && challenge ? (
          <button
            type="button"
            className="text-[11px] font-black text-slate-500"
            onClick={() => {
              setTitle(challenge.title);
              setUnit(challenge.unit);
              setWin(challenge.win);
              setTarget(
                challenge.target_display?.replace(/\s+\S+$/, '') || ''
              );
              setNotes(challenge.notes || '');
              setEditing((v) => !v);
            }}
          >
            {editing ? 'Hide' : 'Edit'}
          </button>
        ) : null}
      </div>

      {canEdit && (editing || !challenge) ? (
        <div className="space-y-2">
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-slate-500">
              Test
            </span>
            <input
              className={fieldClass}
              placeholder="Back squat 5RM"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Unit
              </span>
              <select
                className={fieldClass}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {CHALLENGE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Winner
              </span>
              <select
                className={fieldClass}
                value={win}
                onChange={(e) =>
                  setWin(e.target.value as 'higher' | 'faster')
                }
              >
                <option value="higher">Highest score</option>
                <option value="faster">Fastest time</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-slate-500">
              Target {win === 'faster' ? '(e.g. 2:30)' : ''}
            </span>
            <input
              className={fieldClass}
              placeholder={win === 'faster' ? '2:30' : '140'}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={pinSession}
              onChange={(e) => setPinSession(e.target.checked)}
            />
            This session only
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !title.trim() || !onSave}
              onClick={() =>
                void onSave?.({
                  title: title.trim(),
                  unit,
                  win,
                  target,
                  notes,
                  pin_session: pinSession,
                })
              }
              className="min-h-11 flex-1 rounded-xl text-sm font-black disabled:opacity-50"
              style={{ backgroundColor: color, color: ink }}
            >
              {busy ? 'Saving…' : challenge ? 'Update test' : 'Set test'}
            </button>
            {challenge && onClose ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onClose()}
                className="min-h-11 rounded-xl border border-slate-200 px-3 text-[11px] font-black dark:border-white/15"
              >
                Close
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {canLog && challenge && challenge.status === 'open' ? (
        <div className="space-y-2">
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-slate-500">
              Your score {challenge.unit ? `(${challenge.unit})` : ''}
            </span>
            <input
              className={fieldClass}
              placeholder={
                challenge.win === 'faster' ? '2:30' : `e.g. 140`
              }
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </label>
          <div className="flex gap-1">
            {(['rx', 'scaled'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDivision(d)}
                className={`rounded-full px-3 py-1 text-[11px] font-black ${
                  division === d
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'border border-slate-200 text-slate-500 dark:border-white/15'
                }`}
              >
                {d === 'rx' ? 'Rx' : 'Scaled'}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy || !score.trim() || !onLog}
            onClick={() => void onLog?.({ value: score.trim(), division })}
            className="min-h-11 w-full rounded-xl text-sm font-black disabled:opacity-50"
            style={{ backgroundColor: color, color: ink }}
          >
            {busy
              ? 'Saving…'
              : challenge.my_score
                ? 'Update my score'
                : 'Log my score'}
          </button>
        </div>
      ) : null}

      {board.length ? (
        <ol className="space-y-1.5">
          {board.map((row) => (
            <li
              key={`${row.rank}-${row.name}`}
              className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 dark:bg-neutral-950"
            >
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  {row.rank}. {row.name}
                  {row.division === 'scaled' ? (
                    <span className="ml-1 text-[10px] font-bold uppercase text-slate-400">
                      Scaled
                    </span>
                  ) : null}
                </p>
                {row.injured ? (
                  <p className="text-[10px] font-semibold text-rose-600">
                    Injury
                    {row.injury_label ? ` · ${row.injury_label}` : ''}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-sm font-black tabular-nums text-slate-900 dark:text-white">
                  {row.display}
                </p>
                {row.pct != null ? (
                  <p className="text-[10px] font-bold text-slate-400">
                    {row.pct}% of target
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : challenge ? (
        <p className="text-xs text-slate-500">
          No scores yet. People on this class log after they attend.
        </p>
      ) : null}
    </div>
  );
}
