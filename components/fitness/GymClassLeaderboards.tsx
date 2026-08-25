'use client';

import { useState } from 'react';
import {
  standingLine,
  type ChallengeView,
  type CoachClassLeaderboard,
} from '@/lib/fitness/class-challenges';
import { GymClassChallengeBoard } from '@/components/fitness/GymClassChallengeBoard';
import { GymExpandSection } from '@/components/fitness/GymMemberPwaUi';

function BoardCard({
  view,
  color,
  ink,
  highlight,
}: {
  view: ChallengeView;
  color: string;
  ink: string;
  highlight?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p
        className={`text-sm font-black ${
          highlight ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-100'
        }`}
      >
        {view.class_name}
        <span className="ml-1 text-[11px] font-semibold text-slate-500">
          · {view.title}
        </span>
      </p>
      {highlight ? (
        <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200">
          {standingLine(view)}
          {view.my_score ? ` · ${view.my_score.display}` : ''}
        </p>
      ) : (
        <p className="text-[11px] font-semibold text-slate-500">
          {view.field
            ? `${view.field} on the board`
            : 'No scores yet'}
          {view.target_display ? ` · target ${view.target_display}` : ''}
        </p>
      )}
      <GymClassChallengeBoard challenge={view} color={color} ink={ink} />
    </div>
  );
}

export function GymClassLeaderboards({
  boards,
  groups,
  color,
  ink,
  highlight = false,
}: {
  boards?: ChallengeView[];
  groups?: CoachClassLeaderboard[];
  color: string;
  ink: string;
  highlight?: boolean;
}) {
  const [openClass, setOpenClass] = useState<Record<string, boolean>>({});
  if (groups?.length) {
    return (
      <div className="space-y-3">
        {groups.map((g, i) => {
          const open = openClass[g.class_type_id] ?? i === 0;
          const field = g.challenges.reduce((n, c) => n + c.field, 0);
          return (
            <GymExpandSection
              key={g.class_type_id}
              nested
              title={g.class_name}
              hint={
                g.challenges.length === 1
                  ? `${g.challenges[0].title}${
                      field ? ` · ${field} on the board` : ''
                    }`
                  : `${g.challenges.length} tests${
                      field ? ` · ${field} scores` : ''
                    }`
              }
              badge={
                <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black tabular-nums text-slate-800 dark:bg-white/15 dark:text-white">
                  {g.challenges.length}
                </span>
              }
              open={open}
              onToggle={() =>
                setOpenClass((prev) => ({
                  ...prev,
                  [g.class_type_id]: !open,
                }))
              }
            >
              {g.challenges.map((ch) => (
                <BoardCard
                  key={ch.id}
                  view={ch}
                  color={color}
                  ink={ink}
                />
              ))}
            </GymExpandSection>
          );
        })}
      </div>
    );
  }
  const list = boards || [];
  if (!list.length) {
    return (
      <p className="text-sm text-slate-500">
        When a coach sets a test on your class, your ranking shows here.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {list.map((view) => (
        <BoardCard
          key={view.id}
          view={view}
          color={color}
          ink={ink}
          highlight={highlight}
        />
      ))}
    </div>
  );
}

export function leaderboardHint(boards?: ChallengeView[]): string {
  if (!boards?.length) return 'Class tests and where you stand';
  const first = boards.find((b) => b.my_rank) || boards[0];
  return first ? `${first.class_name} · ${standingLine(first)}` : 'Class tests';
}
