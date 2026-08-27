'use client';

import { useState } from 'react';
import type { GymBoardActivityView, GymBoardDivision } from '@/lib/fitness/gym-leaderboard';

export function GymLeadershipBoard({
  division,
  activities,
  busy,
  color = '#E8E830',
  onLog,
}: {
  division: GymBoardDivision;
  activities: GymBoardActivityView[];
  busy?: boolean;
  color?: string;
  onLog?: (activityId: string, value: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  if (division.need_profile) {
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
        Add your birthday and sex on You so the gym can place you in the right
        age group and board.
      </p>
    );
  }

  if (!activities.length) {
    return (
      <p className="text-sm text-slate-500">
        No leadership activities on your classes yet. After your coach pins
        one, log your score here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] font-bold text-slate-600">
        {division.sex === 'female' ? 'Women' : 'Men'} · {division.band_label}
        {division.age != null ? ` · ${division.age}y` : ''}
      </p>
      {activities.map((a) => (
        <div
          key={a.id}
          className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2 dark:border-white/10 dark:bg-neutral-900"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {a.name}
              </p>
              <p className="text-[11px] font-semibold text-slate-500">
                {a.standing}
                {a.benchmark ? ` · bench ${a.benchmark.display}` : ''}
                {a.class_name ? ` · ${a.class_name}` : ''}
              </p>
            </div>
            {a.my_score ? (
              <p className="text-sm font-black tabular-nums" style={{ color }}>
                {a.my_score.display}
              </p>
            ) : null}
          </div>
          {onLog ? (
            <div className="flex gap-2">
              <input
                className="input flex-1 !py-1.5 !px-2 !text-sm"
                placeholder={a.win === 'faster' ? '2:30' : `Score (${a.unit})`}
                value={draft[a.id] ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [a.id]: e.target.value }))
                }
              />
              <button
                type="button"
                disabled={busy || !String(draft[a.id] || '').trim()}
                className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
                onClick={() => void onLog(a.id, draft[a.id] || '')}
              >
                Log
              </button>
            </div>
          ) : null}
          {a.board.length ? (
            <ol className="space-y-0.5">
              {a.board.slice(0, 8).map((r) => (
                <li
                  key={r.client_id}
                  className={`flex items-center justify-between text-sm ${
                    r.is_me ? 'font-black text-slate-900 dark:text-white' : 'text-slate-600'
                  }`}
                >
                  <span>
                    <span className="tabular-nums text-slate-400 mr-2">
                      {r.rank}
                    </span>
                    {r.is_me ? 'You' : r.name}
                  </span>
                  <span className="tabular-nums font-semibold">
                    {r.display}
                    {r.pct != null ? (
                      <span className="ml-1 text-[10px] text-slate-400">
                        {r.pct}%
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[11px] text-slate-500">Be first on this board.</p>
          )}
        </div>
      ))}
    </div>
  );
}
