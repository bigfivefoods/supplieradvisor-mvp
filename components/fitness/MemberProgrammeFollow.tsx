'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Dumbbell, MessageSquareHeart } from 'lucide-react';
import { ProgrammeCalendarGrid } from '@/components/fitness/ProgrammeCalendarGrid';
import { MovementThumb } from '@/components/fitness/MovementThumb';
import type { MemberProgrammeFollowView } from '@/lib/fitness/programme-follow';

const FEELING_LABELS = [
  '',
  'Drained',
  'Tired',
  'OK',
  'Good',
  'Energised',
] as const;
import type { FitHydratedProgrammeBlock } from '@/lib/fitness/movements';

export type ProgrammeLogDraft = {
  enrollment_id: string;
  block_id: string;
  date: string;
  status: 'done' | 'skipped' | 'partial';
  feeling: number;
  rpe: number;
  comment: string;
  item_checks: Array<{ item_id: string; done: boolean }>;
};

export function MemberProgrammeFollow({
  follows,
  busyId,
  onLog,
}: {
  follows: MemberProgrammeFollowView[];
  busyId?: string | null;
  onLog: (v: ProgrammeLogDraft) => void | Promise<void>;
}) {
  const [openId, setOpenId] = useState(follows[0]?.enrollment_id || null);
  const open = follows.find((f) => f.enrollment_id === openId) || follows[0];

  if (!follows.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
        <p className="text-sm font-black text-slate-900 dark:text-white">
          Your programmes
        </p>
        <p className="mt-1 text-xs text-slate-500">
          When your coach assigns a plan, or you buy one in Shop, it shows up
          here as a calendar you can follow.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {follows.length > 1 ? (
        <div className="flex flex-wrap gap-1">
          {follows.map((f) => (
            <button
              key={f.enrollment_id}
              type="button"
              onClick={() => setOpenId(f.enrollment_id)}
              className={`rounded-full px-3 py-1 text-[11px] font-black ${
                open?.enrollment_id === f.enrollment_id
                  ? 'bg-yellow-400 text-yellow-950'
                  : 'border border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300'
              }`}
            >
              {f.name} · {f.progress.pct}%
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <FollowCard
          key={open.enrollment_id}
          follow={open}
          busy={
            busyId === open.enrollment_id || busyId === 'programme'
          }
          onLog={onLog}
        />
      ) : null}
    </div>
  );
}

function FollowCard({
  follow,
  busy,
  onLog,
}: {
  follow: MemberProgrammeFollowView;
  busy?: boolean;
  onLog: (v: ProgrammeLogDraft) => void | Promise<void>;
}) {
  const [picked, setPicked] = useState<{
    week: number;
    weekday: number;
  } | null>(
    follow.today
      ? { week: follow.today.week, weekday: follow.today.weekday }
      : null
  );

  const day = useMemo(() => {
    if (picked) {
      return (
        follow.days.find(
          (d) => d.week === picked.week && d.weekday === picked.weekday
        ) || null
      );
    }
    return follow.today || follow.days.find((d) => d.block) || null;
  }, [follow, picked]);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            Programme · {follow.weeks} week{follow.weeks === 1 ? '' : 's'}
          </p>
          <h2 className="text-sm font-black text-slate-900 dark:text-white">
            {follow.name}
          </h2>
          {follow.coach_name ? (
            <p className="text-[11px] text-slate-500">
              Coach {follow.coach_name}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-xl font-black tabular-nums text-slate-900 dark:text-white">
            {follow.progress.pct}%
          </p>
          <p className="text-[10px] font-bold text-slate-500">
            {follow.progress.done}/{follow.progress.total} days
          </p>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-yellow-400"
          style={{ width: `${Math.min(100, follow.progress.pct)}%` }}
        />
      </div>
      {follow.description ? (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {follow.description}
        </p>
      ) : null}
      {follow.follow_notes ? (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {follow.follow_notes}
        </p>
      ) : null}

      <ProgrammeCalendarGrid
        weeks={follow.weeks}
        blocks={follow.days
          .filter((d) => d.block)
          .map((d) => ({
            id: d.block!.id,
            week: d.week,
            weekday: d.weekday,
            title: d.block!.title,
            notes: d.block!.notes,
            items: d.block!.items,
          }))}
        movements={follow.days.flatMap(
          (d) =>
            d.block?.items
              .map((it) => it.movement)
              .filter((m): m is NonNullable<typeof m> => Boolean(m)) || []
        )}
        startDate={follow.start_date}
        today={follow.days.find((d) => d.is_today)?.date}
        logs={follow.days
          .map((d) => d.log)
          .filter((l): l is NonNullable<typeof l> => Boolean(l))}
        selected={picked}
        onSelect={(week, weekday) => setPicked({ week, weekday })}
        mode="follow"
      />

      {day?.block ? (
        <DayLog
          key={day.block.id}
          enrollmentId={follow.enrollment_id}
          date={day.date}
          block={day.block}
          feelingDefault={day.log?.feeling ?? 4}
          rpeDefault={day.log?.rpe ?? 6}
          commentDefault={day.log?.comment || ''}
          coachComment={day.log?.coach_comment}
          checksDefault={day.log?.item_checks}
          logged={day.log?.status}
          busy={busy}
          onLog={onLog}
        />
      ) : (
        <p className="text-xs text-slate-500">
          Rest day — pick a training square on the calendar.
        </p>
      )}

      {follow.recent_feedback.length ? (
        <div>
          <p className="mb-1 text-[10px] font-black uppercase text-slate-500">
            Recent feedback
          </p>
          <ul className="space-y-1.5">
            {follow.recent_feedback.map((f, i) => (
              <li
                key={`${f.date}-${i}`}
                className="rounded-xl border border-slate-100 px-3 py-2 dark:border-white/10"
              >
                <p className="text-[11px] font-bold text-slate-500">
                  {f.date} · {f.status}
                  {f.feeling
                    ? ` · ${FEELING_LABELS[f.feeling] || f.feeling}/5`
                    : ''}
                  {f.rpe ? ` · RPE ${f.rpe}` : ''}
                </p>
                {f.comment ? (
                  <p className="text-xs text-slate-800 dark:text-slate-200">
                    {f.comment}
                  </p>
                ) : null}
                {f.coach_comment ? (
                  <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
                    Coach: {f.coach_comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DayLog({
  enrollmentId,
  date,
  block,
  feelingDefault,
  rpeDefault,
  commentDefault,
  coachComment,
  checksDefault,
  logged,
  busy,
  onLog,
}: {
  enrollmentId: string;
  date: string;
  block: FitHydratedProgrammeBlock;
  feelingDefault: number;
  rpeDefault: number;
  commentDefault: string;
  coachComment?: string;
  checksDefault?: Array<{ item_id: string; done?: boolean }>;
  logged?: string | null;
  busy?: boolean;
  onLog: (v: ProgrammeLogDraft) => void | Promise<void>;
}) {
  const [feeling, setFeeling] = useState(feelingDefault);
  const [rpe, setRpe] = useState(rpeDefault);
  const [comment, setComment] = useState(commentDefault);
  const [doneIds, setDoneIds] = useState<Set<string>>(
    () =>
      new Set(
        (checksDefault || [])
          .filter((c) => c.done !== false)
          .map((c) => c.item_id)
          .concat(
            checksDefault?.length
              ? []
              : block.items.map((it) => it.id)
          )
      )
  );

  const submit = (status: 'done' | 'skipped' | 'partial') => {
    const checks = block.items.map((it) => ({
      item_id: it.id,
      done: status === 'skipped' ? false : doneIds.has(it.id),
    }));
    const all = checks.length > 0 && checks.every((c) => c.done);
    const none = checks.every((c) => !c.done);
    const resolved: 'done' | 'skipped' | 'partial' =
      status === 'skipped'
        ? 'skipped'
        : status === 'partial'
          ? 'partial'
          : all
            ? 'done'
            : none
              ? 'skipped'
              : 'partial';
    void onLog({
      enrollment_id: enrollmentId,
      block_id: block.id,
      date,
      status: resolved,
      feeling,
      rpe,
      comment,
      item_checks: checks,
    });
  };

  return (
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-950/40">
      <div className="flex items-center gap-2 text-amber-950 dark:text-amber-100">
        <Dumbbell className="h-4 w-4" />
        <p className="text-sm font-black">
          {block.title || 'Session'} · {date}
        </p>
      </div>
      {block.notes ? (
        <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
          {block.notes}
        </p>
      ) : null}
      {coachComment ? (
        <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
          Coach: {coachComment}
        </p>
      ) : null}
      <ul className="space-y-2">
        {block.items.map((it, i) => {
          const mv = it.movement;
          const on = doneIds.has(it.id);
          return (
            <li key={it.id} className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setDoneIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(it.id)) next.delete(it.id);
                    else next.add(it.id);
                    return next;
                  })
                }
                className={`mt-1 h-5 w-5 shrink-0 rounded-md border ${
                  on
                    ? 'border-emerald-600 bg-emerald-500 text-white'
                    : 'border-slate-300 bg-white'
                }`}
                aria-label={on ? 'Done' : 'Not done'}
              >
                {on ? <CheckCircle2 className="h-4 w-4" /> : null}
              </button>
              <div className="h-10 w-10 overflow-hidden rounded-md bg-slate-100">
                {mv ? (
                  <MovementThumb
                    name={mv.name}
                    category={mv.category}
                    code={mv.code || mv.id}
                    imageUrl={mv.image_url}
                    muscles={mv.muscles}
                    equipment={mv.equipment}
                    className="!h-10"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center text-[11px] font-black">
                    {i + 1}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {mv?.name || 'Movement'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {[
                    it.sets ? `${it.sets} sets` : null,
                    it.reps ? `${it.reps}` : null,
                    it.rest_sec != null ? `${it.rest_sec}s rest` : null,
                    it.tempo ? `tempo ${it.tempo}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'As prescribed'}
                </p>
                {it.notes ? (
                  <p className="text-[11px] text-slate-600">{it.notes}</p>
                ) : null}
                {mv?.overview || mv?.description ? (
                  <p className="text-[11px] text-slate-500">
                    {mv.overview || mv.description}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <label className="block text-[10px] font-black uppercase text-amber-900">
        How it felt · {feeling}/5 {FEELING_LABELS[feeling] || ''}
        <input
          type="range"
          min={1}
          max={5}
          value={feeling}
          onChange={(e) => setFeeling(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
      <label className="block text-[10px] font-black uppercase text-amber-900">
        Effort · {rpe}/10
        <input
          type="range"
          min={1}
          max={10}
          value={rpe}
          onChange={(e) => setRpe(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
      <textarea
        className="min-h-[3rem] w-full resize-y rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-800 dark:bg-neutral-950"
        placeholder="How did the session go?"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {logged ? (
        <p className="text-[11px] font-bold text-emerald-700">
          Logged as {logged}. You can update it.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => submit('done')}
          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Done
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit('partial')}
          className="rounded-xl border border-amber-300 px-3 py-2 text-xs font-black text-amber-950"
        >
          Partial
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit('skipped')}
          className="rounded-xl px-3 py-2 text-xs font-bold text-rose-600"
        >
          Skip
        </button>
      </div>
      <p className="flex items-center gap-1 text-[10px] text-amber-900/80">
        <MessageSquareHeart className="h-3 w-3" />
        Your coach sees feeling, effort and comments.
      </p>
    </div>
  );
}
