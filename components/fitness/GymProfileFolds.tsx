'use client';

import { useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  MessageSquareHeart,
  Shield,
  Trophy,
} from 'lucide-react';
import {
  BODY_REGIONS,
  INJURY_SIDES,
  INJURY_STATUSES,
} from '@/lib/health/body-map';
import {
  PB_TITLE_PRESETS,
  PB_UNITS,
  type FitInjuryEntry,
  type FitPersonalBest,
} from '@/lib/fitness/person-records';
import { GymClassRateCard, GymExpandSection } from '@/components/fitness/GymMemberPwaUi';

export type ProfileFeedbackRow = {
  id: string;
  title: string;
  date: string;
  feeling?: number | null;
  intensity?: number | null;
  enjoyment?: number | null;
  comment?: string | null;
  source?: string;
};

export type ProfilePendingRate = {
  booking_id: string;
  title: string;
  date: string;
};

const fieldClass =
  'mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-neutral-950';
const labelClass = 'text-[10px] font-bold uppercase text-slate-500';

function emptyPb(): {
  id: string;
  title: string;
  value: string;
  unit: string;
  achieved_on: string;
  notes: string;
} {
  return {
    id: '',
    title: '',
    value: '',
    unit: 'kg',
    achieved_on: '',
    notes: '',
  };
}

function emptyInjury(): {
  id: string;
  area: string;
  side: string;
  status: string;
  onset: string;
  notes: string;
  modifications: string;
  pain_score: string;
} {
  return {
    id: '',
    area: '',
    side: 'n/a',
    status: 'recovering',
    onset: '',
    notes: '',
    modifications: '',
    pain_score: '',
  };
}

export function GymProfileFolds({
  pbs,
  injuries,
  feedback,
  pending,
  busyId,
  color,
  ink,
  onSavePb,
  onDeletePb,
  onSaveInjury,
  onDeleteInjury,
  onRateClass,
  admin,
}: {
  pbs: FitPersonalBest[];
  injuries: FitInjuryEntry[];
  feedback: ProfileFeedbackRow[];
  pending?: ProfilePendingRate[];
  busyId?: string | null;
  color: string;
  ink: string;
  onSavePb: (row: Record<string, unknown>) => void | Promise<void>;
  onDeletePb: (id: string) => void | Promise<void>;
  onSaveInjury: (row: Record<string, unknown>) => void | Promise<void>;
  onDeleteInjury: (id: string) => void | Promise<void>;
  onRateClass?: (
    bookingId: string,
    v: { feeling: number; intensity: number; enjoyment: number; comment: string }
  ) => void | Promise<void>;
  admin: ReactNode;
}) {
  const [pbOpen, setPbOpen] = useState(pbs.length > 0);
  const [injOpen, setInjOpen] = useState(injuries.length > 0);
  const [fbOpen, setFbOpen] = useState(Boolean(pending?.length) || feedback.length > 0);
  const [adminOpen, setAdminOpen] = useState(true);
  const [pbForm, setPbForm] = useState(emptyPb);
  const [injForm, setInjForm] = useState(emptyInjury);
  const [addingPb, setAddingPb] = useState(false);
  const [addingInj, setAddingInj] = useState(false);

  const editPb = (row: FitPersonalBest) => {
    setAddingPb(true);
    setPbForm({
      id: row.id,
      title: row.title,
      value: row.value,
      unit: row.unit || 'kg',
      achieved_on: row.achieved_on || '',
      notes: row.notes || '',
    });
    setPbOpen(true);
  };
  const editInj = (row: FitInjuryEntry) => {
    setAddingInj(true);
    setInjForm({
      id: row.id,
      area: row.area,
      side: row.side || 'n/a',
      status: row.status || 'recovering',
      onset: row.onset || '',
      notes: row.notes || '',
      modifications: row.modifications || '',
      pain_score: row.pain_score != null ? String(row.pain_score) : '',
    });
    setInjOpen(true);
  };

  return (
    <div className="space-y-3">
      <GymExpandSection
        title="PBs"
        hint={
          pbs.length
            ? `${pbs.length} personal best${pbs.length === 1 ? '' : 's'}`
            : 'Add and update your personal bests'
        }
        icon={<Trophy className="h-4 w-4" />}
        badge={
          pbs.length ? (
            <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-black tabular-nums text-white dark:bg-white dark:text-slate-900">
              {pbs.length}
            </span>
          ) : undefined
        }
        open={pbOpen}
        onToggle={() => setPbOpen((v) => !v)}
      >
        {pbs.length ? (
          <ul className="space-y-2">
            {pbs.map((row) => (
              <li
                key={row.id}
                className="flex items-start justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {row.title}
                  </p>
                  <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">
                    {row.value}
                    {row.unit ? ` ${row.unit}` : ''}
                    {row.achieved_on ? ` · ${row.achieved_on}` : ''}
                  </p>
                  {row.notes ? (
                    <p className="mt-0.5 text-xs text-slate-500">{row.notes}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 text-[11px] font-black text-slate-500"
                  onClick={() => editPb(row)}
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            Log lifts, runs, and gym tests so you can see them improve.
          </p>
        )}
        {addingPb ? (
          <div className="space-y-2 rounded-2xl border border-slate-200 p-3 dark:border-white/10">
            <div className="flex flex-wrap gap-1">
              {PB_TITLE_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPbForm((f) => ({ ...f, title: t }))}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    pbForm.title === t
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                      : 'border-slate-200 text-slate-600 dark:border-white/15'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <label className="block">
              <span className={labelClass}>Movement / test</span>
              <input
                className={fieldClass}
                value={pbForm.title}
                onChange={(e) =>
                  setPbForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className={labelClass}>Result</span>
                <input
                  className={fieldClass}
                  value={pbForm.value}
                  onChange={(e) =>
                    setPbForm((f) => ({ ...f, value: e.target.value }))
                  }
                />
              </label>
              <label className="block">
                <span className={labelClass}>Unit</span>
                <select
                  className={fieldClass}
                  value={pbForm.unit}
                  onChange={(e) =>
                    setPbForm((f) => ({ ...f, unit: e.target.value }))
                  }
                >
                  {PB_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className={labelClass}>Date</span>
              <input
                type="date"
                className={fieldClass}
                value={pbForm.achieved_on}
                onChange={(e) =>
                  setPbForm((f) => ({ ...f, achieved_on: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className={labelClass}>Notes</span>
              <input
                className={fieldClass}
                value={pbForm.notes}
                onChange={(e) =>
                  setPbForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busyId === 'pb' || !pbForm.title.trim() || !pbForm.value.trim()}
                onClick={() =>
                  void Promise.resolve(
                    onSavePb({
                      id: pbForm.id || undefined,
                      title: pbForm.title.trim(),
                      value: pbForm.value.trim(),
                      unit: pbForm.unit,
                      achieved_on: pbForm.achieved_on || null,
                      notes: pbForm.notes,
                    })
                  ).then(() => {
                    setAddingPb(false);
                    setPbForm(emptyPb());
                  })
                }
                className="min-h-11 flex-1 rounded-xl text-sm font-black disabled:opacity-50"
                style={{ backgroundColor: color, color: ink }}
              >
                {busyId === 'pb' ? 'Saving…' : 'Save PB'}
              </button>
              {pbForm.id ? (
                <button
                  type="button"
                  disabled={busyId === 'pb'}
                  onClick={() =>
                    void Promise.resolve(onDeletePb(pbForm.id)).then(() => {
                      setAddingPb(false);
                      setPbForm(emptyPb());
                    })
                  }
                  className="min-h-11 rounded-xl border border-rose-200 px-3 text-[11px] font-black text-rose-700 dark:border-rose-500/40"
                >
                  Delete
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAddingPb(false);
                    setPbForm(emptyPb());
                  }}
                  className="min-h-11 rounded-xl border border-slate-200 px-3 text-[11px] font-black dark:border-white/15"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPbForm(emptyPb());
              setAddingPb(true);
            }}
            className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-[11px] font-black text-slate-600 dark:border-white/20"
          >
            Add a PB
          </button>
        )}
      </GymExpandSection>

      <GymExpandSection
        title="Injuries"
        hint={
          injuries.length
            ? `${injuries.length} on file — add or update so sessions can be adapted`
            : 'Add and update injuries so coaches know how to adapt'
        }
        icon={<AlertTriangle className="h-4 w-4" />}
        badge={
          injuries.length ? (
            <span className="shrink-0 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-black tabular-nums text-white">
              {injuries.length}
            </span>
          ) : undefined
        }
        open={injOpen}
        onToggle={() => setInjOpen((v) => !v)}
      >
        {injuries.length ? (
          <ul className="space-y-2">
            {injuries.map((row) => (
              <li
                key={row.id}
                className="flex items-start justify-between gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2.5 dark:border-rose-500/30 dark:bg-rose-950/30"
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {row.area}
                    {row.side && row.side !== 'n/a' ? ` · ${row.side}` : ''}
                  </p>
                  <p className="text-[11px] font-semibold text-rose-800 dark:text-rose-200">
                    {row.status || 'noted'}
                    {row.onset ? ` · since ${row.onset}` : ''}
                    {row.pain_score != null ? ` · pain ${row.pain_score}/10` : ''}
                  </p>
                  {row.notes ? (
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                      {row.notes}
                    </p>
                  ) : null}
                  {row.modifications ? (
                    <p className="mt-0.5 text-xs text-slate-500">
                      Adapt: {row.modifications}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 text-[11px] font-black text-slate-500"
                  onClick={() => editInj(row)}
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            Nothing on file. Add an injury or niggle so sessions can be modified.
          </p>
        )}
        {addingInj ? (
          <div className="space-y-2 rounded-2xl border border-slate-200 p-3 dark:border-white/10">
            <label className="block">
              <span className={labelClass}>Area</span>
              <select
                className={fieldClass}
                value={injForm.area}
                onChange={(e) =>
                  setInjForm((f) => ({ ...f, area: e.target.value }))
                }
              >
                <option value="">Pick area…</option>
                {BODY_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className={labelClass}>Side</span>
                <select
                  className={fieldClass}
                  value={injForm.side}
                  onChange={(e) =>
                    setInjForm((f) => ({ ...f, side: e.target.value }))
                  }
                >
                  {INJURY_SIDES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>Status</span>
                <select
                  className={fieldClass}
                  value={injForm.status}
                  onChange={(e) =>
                    setInjForm((f) => ({ ...f, status: e.target.value }))
                  }
                >
                  {INJURY_STATUSES.filter((s) => s !== 'none').map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className={labelClass}>Started</span>
                <input
                  type="date"
                  className={fieldClass}
                  value={injForm.onset}
                  onChange={(e) =>
                    setInjForm((f) => ({ ...f, onset: e.target.value }))
                  }
                />
              </label>
              <label className="block">
                <span className={labelClass}>Pain 0–10</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  className={fieldClass}
                  value={injForm.pain_score}
                  onChange={(e) =>
                    setInjForm((f) => ({ ...f, pain_score: e.target.value }))
                  }
                />
              </label>
            </div>
            <label className="block">
              <span className={labelClass}>Notes</span>
              <textarea
                className={`${fieldClass} min-h-[3rem] py-2`}
                value={injForm.notes}
                onChange={(e) =>
                  setInjForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className={labelClass}>How to adapt sessions</span>
              <textarea
                className={`${fieldClass} min-h-[3rem] py-2`}
                value={injForm.modifications}
                onChange={(e) =>
                  setInjForm((f) => ({ ...f, modifications: e.target.value }))
                }
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busyId === 'injury' || !injForm.area}
                onClick={() =>
                  void Promise.resolve(
                    onSaveInjury({
                      id: injForm.id || undefined,
                      area: injForm.area,
                      side: injForm.side,
                      status: injForm.status,
                      onset: injForm.onset || null,
                      notes: injForm.notes,
                      modifications: injForm.modifications,
                      pain_score:
                        injForm.pain_score === '' ? null : Number(injForm.pain_score),
                    })
                  ).then(() => {
                    setAddingInj(false);
                    setInjForm(emptyInjury());
                  })
                }
                className="min-h-11 flex-1 rounded-xl text-sm font-black disabled:opacity-50"
                style={{ backgroundColor: color, color: ink }}
              >
                {busyId === 'injury' ? 'Saving…' : 'Save injury'}
              </button>
              {injForm.id ? (
                <button
                  type="button"
                  disabled={busyId === 'injury'}
                  onClick={() =>
                    void Promise.resolve(onDeleteInjury(injForm.id)).then(() => {
                      setAddingInj(false);
                      setInjForm(emptyInjury());
                    })
                  }
                  className="min-h-11 rounded-xl border border-rose-200 px-3 text-[11px] font-black text-rose-700 dark:border-rose-500/40"
                >
                  Delete
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAddingInj(false);
                    setInjForm(emptyInjury());
                  }}
                  className="min-h-11 rounded-xl border border-slate-200 px-3 text-[11px] font-black dark:border-white/15"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setInjForm(emptyInjury());
              setAddingInj(true);
            }}
            className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-[11px] font-black text-slate-600 dark:border-white/20"
          >
            Add an injury
          </button>
        )}
      </GymExpandSection>

      <GymExpandSection
        title="Feedback"
        hint={
          pending?.length
            ? `${pending.length} class${pending.length === 1 ? '' : 'es'} to rate`
            : feedback.length
              ? `${feedback.length} rating${feedback.length === 1 ? '' : 's'} from classes you attended`
              : 'Ratings from classes you attended'
        }
        icon={<MessageSquareHeart className="h-4 w-4" />}
        badge={
          (pending?.length || feedback.length) ? (
            <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-black tabular-nums text-white dark:bg-white dark:text-slate-900">
              {(pending?.length || 0) + feedback.length}
            </span>
          ) : undefined
        }
        open={fbOpen}
        onToggle={() => setFbOpen((v) => !v)}
      >
        {pending?.length && onRateClass ? (
          <div className="space-y-2">
            {pending.map((f) => (
              <GymClassRateCard
                key={f.booking_id}
                className={f.title}
                date={f.date}
                busy={busyId === `rate:${f.booking_id}`}
                onSubmit={(v) => void onRateClass(f.booking_id, v)}
              />
            ))}
          </div>
        ) : null}
        {feedback.length ? (
          <ul className="space-y-2">
            {feedback.map((f) => (
              <li
                key={f.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/5"
              >
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  {f.title}
                </p>
                <p className="text-[11px] text-slate-500">
                  {f.date}
                  {f.source ? ` · ${f.source}` : ''}
                  {f.feeling != null ? ` · feel ${f.feeling}/5` : ''}
                  {f.intensity != null ? ` · RPE ${f.intensity}/10` : ''}
                  {f.enjoyment != null ? ` · enjoy ${f.enjoyment}/5` : ''}
                </p>
                {f.comment ? (
                  <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                    {f.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : !pending?.length ? (
          <p className="text-sm text-slate-500">
            After you attend a class and rate it, it shows here.
          </p>
        ) : null}
      </GymExpandSection>

      <GymExpandSection
        title="Admin"
        hint="Name, contact, photo, and gym records"
        icon={<Shield className="h-4 w-4" />}
        open={adminOpen}
        onToggle={() => setAdminOpen((v) => !v)}
      >
        {admin}
      </GymExpandSection>
    </div>
  );
}
