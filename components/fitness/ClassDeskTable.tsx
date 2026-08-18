'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { fc } from '@/components/fitness/FitForm';
import {
  RecurrenceFields,
  emptyRecurrenceForm,
  recurrenceApiPayload,
  validateRecurrenceForm,
  type RecurrenceFormValue,
} from '@/components/schedule/RecurrenceFields';
import {
  calendarCoverage,
  nextDateForWeekdays,
  suggestClassSchedule,
} from '@/lib/fitness/class-allocate';
import {
  durationFromStartEnd,
  endFromStartDuration,
} from '@/lib/fitness/session-times';
import type {
  FitgraphStore,
  FitMembershipPlan,
} from '@/lib/fitness/fitgraph';

type PostFn = (body: Record<string, unknown>) => Promise<Record<string, unknown>>;

type Draft = {
  code: string;
  name: string;
  price_zar: string;
  billing: string;
  schedule_label: string;
  description: string;
  public: boolean;
  coach_id: string;
  location: string;
  class_credits: string;
  pt_credits: string;
  access: string;
  programme_id: string;
};

const blankDraft = (): Draft => ({
  code: '',
  name: '',
  price_zar: '',
  billing: 'monthly',
  schedule_label: '',
  description: '',
  public: true,
  coach_id: '',
  location: '',
  class_credits: '',
  pt_credits: '',
  access: 'classes',
  programme_id: '',
});

function draftFromPlan(p: FitMembershipPlan, store: FitgraphStore): Draft {
  const cover = calendarCoverage(store, p, new Date().toISOString().slice(0, 10));
  const sessionCoach = cover.next?.coach_id || '';
  return {
    code: p.code || '',
    name: p.name || '',
    price_zar: p.price_zar != null ? String(p.price_zar) : '',
    billing: p.billing || 'monthly',
    schedule_label: p.schedule_label || '',
    description: p.description || '',
    public: p.public !== false,
    coach_id: p.default_coach_id || sessionCoach || '',
    location: p.location || '',
    class_credits: p.class_credits != null ? String(p.class_credits) : '',
    pt_credits: p.pt_credits != null ? String(p.pt_credits) : '',
    access: p.access || 'classes',
    programme_id: p.programme_id || '',
  };
}

export function ClassDeskTable({
  store,
  post,
  saving,
  classSubscribe,
}: {
  store: FitgraphStore;
  post: PostFn;
  saving: boolean;
  classSubscribe: boolean;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [addDraft, setAddDraft] = useState<Draft>(blankDraft);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<RecurrenceFormValue>(
    emptyRecurrenceForm()
  );
  const [cal, setCal] = useState({
    date: todayIso,
    start_time: '06:00',
    end_time: '07:00',
  });

  const coaches = useMemo(
    () => (store.coaches || []).filter((c) => c.active !== false),
    [store.coaches]
  );

  const plans = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...store.membership_plans]
      .filter((p) => p.active !== false)
      .filter((p) =>
        needle
          ? `${p.code} ${p.name} ${p.schedule_label || ''}`.toLowerCase().includes(
              needle
            )
          : true
      )
      .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
  }, [store.membership_plans, q]);

  const draftFor = (p: FitMembershipPlan): Draft =>
    drafts[p.id] || draftFromPlan(p, store);

  const setRow = (id: string, patch: Partial<Draft>) => {
    const p = store.membership_plans.find((x) => x.id === id);
    const current = p ? draftFor(p) : blankDraft();
    setDrafts((d) => ({ ...d, [id]: { ...current, ...patch } }));
  };

  const openEditor = (p: FitMembershipPlan) => {
    const next = openId === p.id ? null : p.id;
    setOpenId(next);
    setAdding(false);
    if (next && !p.unlocks_all_classes) {
      const hint = suggestClassSchedule(store, p);
      const cover = calendarCoverage(store, p, todayIso);
      setCal({
        date: cover.next?.date || nextDateForWeekdays(hint.weekdays, todayIso),
        start_time: cover.next?.start_time?.slice(0, 5) || hint.start_time,
        end_time:
          cover.next?.end_time?.slice(0, 5) ||
          hint.end_time ||
          endFromStartDuration(hint.start_time, hint.duration_min),
      });
      setRecurrence({
        ...emptyRecurrenceForm(),
        frequency: cover.count ? 'none' : hint.frequency,
        weekdays: hint.weekdays,
        interval: '1',
        count: '16',
        end_mode: 'count',
      });
    }
  };

  const savePlan = async (planId: string | null, d: Draft) => {
    if (!d.name.trim()) {
      toast.error('Name required');
      return;
    }
    const key = planId || 'new';
    setBusyId(key);
    try {
      if (!planId) {
        const created = await post({
          entity: 'membership_plans',
          action: 'upsert',
          record: {
            code: d.code.trim(),
            name: d.name.trim(),
            price_zar: Number(d.price_zar) || 0,
            billing: d.billing,
            schedule_label: d.schedule_label.trim() || undefined,
            description: d.description.trim() || undefined,
            public: d.public,
            location: d.location.trim() || undefined,
            default_coach_id: d.coach_id || null,
            class_credits: d.class_credits ? Number(d.class_credits) : null,
            pt_credits: d.pt_credits ? Number(d.pt_credits) : null,
            access: d.access,
            programme_id: d.programme_id || null,
          },
        });
        const plansNext = (
          (created.store as FitgraphStore | undefined)?.membership_plans || []
        ) as FitMembershipPlan[];
        const made =
          plansNext.find(
            (p) =>
              p.name === d.name.trim() &&
              (d.code.trim() ? p.code === d.code.trim() : true)
          ) || plansNext[plansNext.length - 1];
        if (made && d.coach_id) {
          await post({
            action: 'update_class_desk',
            plan_id: made.id,
            coach_id: d.coach_id,
          });
        }
        toast.success(classSubscribe ? 'Class added' : 'Plan added');
        setAdding(false);
        setAddDraft(blankDraft());
        if (made) setOpenId(made.id);
        return;
      }
      const data = await post({
        action: 'update_class_desk',
        plan_id: planId,
        coach_id: d.coach_id || null,
        patch: {
          code: d.code.trim(),
          name: d.name.trim(),
          price_zar: Number(d.price_zar) || 0,
          billing: d.billing,
          schedule_label: d.schedule_label.trim(),
          description: d.description.trim(),
          public: d.public,
          location: d.location.trim(),
          class_credits: d.class_credits ? Number(d.class_credits) : null,
          pt_credits: d.pt_credits ? Number(d.pt_credits) : null,
          access: d.access,
          programme_id: d.programme_id || null,
        },
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[planId];
        return next;
      });
      toast.success((data?.message as string) || 'Saved');
    } catch {
      /* toast from useFitgraph */
    } finally {
      setBusyId(null);
    }
  };

  const assignCoach = async (p: FitMembershipPlan, coachId: string) => {
    setRow(p.id, { coach_id: coachId });
    setBusyId(p.id);
    try {
      const data = await post({
        action: 'update_class_desk',
        plan_id: p.id,
        coach_id: coachId || null,
      });
      toast.success((data?.message as string) || 'Coach saved');
    } catch {
      /* toast */
    } finally {
      setBusyId(null);
    }
  };

  const saveUpcoming = async (p: FitMembershipPlan) => {
    const d = draftFor(p);
    setBusyId(p.id);
    try {
      const data = await post({
        action: 'update_class_desk',
        plan_id: p.id,
        coach_id: d.coach_id || null,
        patch: {
          schedule_label: d.schedule_label.trim(),
          location: d.location.trim(),
          public: d.public,
        },
        session: {
          start_time: cal.start_time,
          end_time: cal.end_time,
          location: d.location.trim(),
          public: d.public,
        },
      });
      toast.success((data?.message as string) || 'Upcoming dates updated');
    } catch {
      /* toast */
    } finally {
      setBusyId(null);
    }
  };

  const putOnCalendar = async (p: FitMembershipPlan) => {
    if (p.unlocks_all_classes) {
      toast.message('Schedule the individual classes');
      return;
    }
    const recErr = validateRecurrenceForm(recurrence);
    if (recErr) {
      toast.error(recErr);
      return;
    }
    const payload = recurrenceApiPayload(recurrence, cal.date);
    const d = draftFor(p);
    setBusyId(p.id);
    try {
      const data = await post({
        action: 'schedule_class',
        plan_id: p.id,
        date: cal.date,
        start_time: cal.start_time,
        end_time: cal.end_time,
        coach_id: d.coach_id || null,
        location: d.location || undefined,
        public: d.public,
        ...(payload || { frequency: 'none' }),
      });
      toast.success((data?.message as string) || 'On the calendar');
    } catch {
      /* toast */
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this class? Members stay on the book; diary dates stay until you delete them on Calendar.')) {
      return;
    }
    setBusyId(id);
    try {
      await post({ entity: 'membership_plans', action: 'delete', id });
      toast.success('Removed');
      if (openId === id) setOpenId(null);
    } catch {
      /* toast */
    } finally {
      setBusyId(null);
    }
  };

  const rowClass =
    'border-t border-slate-100 dark:border-white/10 align-middle';

  const renderEditor = (
    d: Draft,
    onChange: (patch: Partial<Draft>) => void,
    opts: { plan?: FitMembershipPlan; isNew?: boolean }
  ) => {
    const cover = opts.plan
      ? calendarCoverage(store, opts.plan, todayIso)
      : null;
    const unlimited = opts.plan?.unlocks_all_classes === true;
    return (
      <div className="space-y-3 px-3 py-3 bg-yellow-50/60 dark:bg-yellow-950/40">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className={fc()}
            placeholder="Code"
            value={d.code}
            onChange={(e) => onChange({ code: e.target.value })}
          />
          <input
            className={fc()}
            placeholder="Name"
            value={d.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
          <input
            className={fc()}
            type="number"
            placeholder="Price ZAR"
            value={d.price_zar}
            onChange={(e) => onChange({ price_zar: e.target.value })}
          />
          <select
            className={fc()}
            value={d.billing}
            onChange={(e) => onChange({ billing: e.target.value })}
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="annual">Annual</option>
            <option value="pack">Pack</option>
            <option value="drop_in">Drop-in</option>
          </select>
          <input
            className={fc()}
            placeholder="When (e.g. 5:00am Mon / Wed / Fri)"
            value={d.schedule_label}
            onChange={(e) => onChange({ schedule_label: e.target.value })}
          />
          {classSubscribe ? (
            <select
              className={fc()}
              value={d.coach_id}
              onChange={(e) => onChange({ coach_id: e.target.value })}
            >
              <option value="">Coach…</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                className={fc()}
                type="number"
                placeholder="Class credits"
                value={d.class_credits}
                onChange={(e) => onChange({ class_credits: e.target.value })}
              />
              <input
                className={fc()}
                type="number"
                placeholder="PT credits"
                value={d.pt_credits}
                onChange={(e) => onChange({ pt_credits: e.target.value })}
              />
            </>
          )}
          <input
            className={fc()}
            placeholder="Location"
            value={d.location}
            onChange={(e) => onChange({ location: e.target.value })}
          />
          <textarea
            className={fc() + ' min-h-[2.5rem] resize-y sm:col-span-2'}
            placeholder="What this includes"
            value={d.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
          <label className="inline-flex items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={d.public}
              onChange={(e) => onChange({ public: e.target.checked })}
            />
            On website
          </label>
        </div>

        {classSubscribe && !unlimited && !opts.isNew ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-yellow-200 dark:border-yellow-800 p-3">
            <p className="sm:col-span-2 lg:col-span-4 text-[10px] font-black uppercase tracking-wide text-yellow-800 dark:text-yellow-200">
              {cover && cover.count
                ? `On calendar · ${cover.count} upcoming${
                    cover.next ? ` · next ${cover.next.date}` : ''
                  }`
                : 'Not on calendar yet'}
            </p>
            <input
              className={fc()}
              type="date"
              value={cal.date}
              onChange={(e) => setCal((s) => ({ ...s, date: e.target.value }))}
            />
            <input
              className={fc()}
              type="time"
              value={cal.start_time}
              onChange={(e) => {
                const start = e.target.value;
                const dur = cal.end_time
                  ? durationFromStartEnd(cal.start_time, cal.end_time)
                  : 60;
                setCal((s) => ({
                  ...s,
                  start_time: start,
                  end_time: endFromStartDuration(start, dur),
                }));
              }}
            />
            <input
              className={fc()}
              type="time"
              value={cal.end_time}
              onChange={(e) =>
                setCal((s) => ({ ...s, end_time: e.target.value }))
              }
            />
            {cover && cover.count ? (
              <button
                type="button"
                disabled={saving && busyId === opts.plan?.id}
                className="rounded-xl border border-yellow-400 bg-white px-3 py-2 text-xs font-bold text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100"
                onClick={() => opts.plan && void saveUpcoming(opts.plan)}
              >
                Update upcoming dates
              </button>
            ) : null}
            <div className="sm:col-span-2 lg:col-span-4">
              <RecurrenceFields
                value={recurrence}
                onChange={setRecurrence}
                startDate={cal.date}
                inputClass={fc()}
                accent="yellow"
                unitLabel="classes"
              />
            </div>
            <button
              type="button"
              disabled={saving && busyId === opts.plan?.id}
              className="rounded-xl bg-yellow-400 px-3 py-2 text-xs font-black text-yellow-950 disabled:opacity-50"
              onClick={() => opts.plan && void putOnCalendar(opts.plan)}
            >
              {cover && cover.count
                ? 'Add more dates'
                : recurrence.frequency === 'none'
                  ? 'Add to calendar'
                  : 'Add repeating classes'}
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving && busyId === (opts.plan?.id || 'new')}
            className="rounded-xl bg-yellow-400 px-3 py-2 text-xs font-black text-yellow-950 disabled:opacity-50"
            onClick={() =>
              void savePlan(opts.plan?.id || null, d)
            }
          >
            {opts.isNew
              ? classSubscribe
                ? 'Add class'
                : 'Add plan'
              : 'Save changes'}
          </button>
          {opts.plan ? (
            <button
              type="button"
              disabled={saving && busyId === opts.plan.id}
              className="rounded-xl border border-rose-300 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-700 dark:text-rose-200"
              onClick={() => void remove(opts.plan!.id)}
            >
              Delete
            </button>
          ) : (
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
              onClick={() => {
                setAdding(false);
                setAddDraft(blankDraft());
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-[14rem] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          placeholder={classSubscribe ? 'Search classes…' : 'Search plans…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-xl bg-yellow-400 px-3 py-2 text-xs font-black text-yellow-950"
          onClick={() => {
            setAdding(true);
            setOpenId(null);
            setAddDraft(blankDraft());
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          {classSubscribe ? 'Add class' : 'Add plan'}
        </button>
      </div>
      {!coaches.length && classSubscribe ? (
        <p className="text-[11px] text-slate-500">
          No coaches yet — add them under{' '}
          <a
            href="/dashboard/fitgraph/coaches"
            className="font-bold text-yellow-700 underline dark:text-yellow-300"
          >
            Coaches
          </a>
          , then assign here.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-yellow-200 bg-white dark:!border-yellow-400 dark:!bg-yellow-950 dark:ring-1 dark:ring-yellow-500/40">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-yellow-50 text-left text-[10px] font-black uppercase tracking-wider text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-200">
            <tr>
              <th className="w-8 px-2 py-2.5" />
              <th className="px-2 py-2.5">Name</th>
              <th className="px-2 py-2.5">When</th>
              <th className="px-2 py-2.5">Price</th>
              {classSubscribe ? (
                <th className="px-2 py-2.5">Coach</th>
              ) : (
                <th className="px-2 py-2.5">Billing</th>
              )}
              {classSubscribe ? (
                <th className="px-2 py-2.5">On calendar</th>
              ) : null}
              <th className="px-2 py-2.5">Web</th>
              <th className="px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {adding ? (
              <tr className={rowClass}>
                <td colSpan={classSubscribe ? 8 : 7} className="p-0">
                  {renderEditor(
                    addDraft,
                    (patch) => setAddDraft((d) => ({ ...d, ...patch })),
                    { isNew: true }
                  )}
                </td>
              </tr>
            ) : null}
            {plans.length === 0 && !adding ? (
              <tr>
                <td
                  colSpan={classSubscribe ? 8 : 7}
                  className="px-3 py-10 text-center text-slate-500"
                >
                  Nothing here yet. Add a {classSubscribe ? 'class' : 'plan'}.
                </td>
              </tr>
            ) : (
              plans.map((p) => {
                const d = draftFor(p);
                const cover = calendarCoverage(store, p, todayIso);
                const open = openId === p.id;
                return (
                  <Fragment key={p.id}>
                    <tr className={rowClass}>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          className="p-1 text-yellow-800 dark:text-yellow-200"
                          onClick={() => openEditor(p)}
                          title={open ? 'Collapse' : 'Edit'}
                        >
                          {open ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={fc()}
                          value={d.name}
                          onChange={(e) => setRow(p.id, { name: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={fc()}
                          value={d.schedule_label}
                          placeholder="When"
                          onChange={(e) =>
                            setRow(p.id, { schedule_label: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={`${fc()} max-w-[7rem] tabular-nums`}
                          type="number"
                          value={d.price_zar}
                          onChange={(e) =>
                            setRow(p.id, { price_zar: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        {classSubscribe ? (
                          p.unlocks_all_classes ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <select
                              className={fc()}
                              value={d.coach_id}
                              disabled={saving && busyId === p.id}
                              onChange={(e) =>
                                void assignCoach(p, e.target.value)
                              }
                            >
                              <option value="">Coach…</option>
                              {coaches.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          )
                        ) : (
                          <select
                            className={fc()}
                            value={d.billing}
                            onChange={(e) =>
                              setRow(p.id, { billing: e.target.value })
                            }
                          >
                            <option value="monthly">Monthly</option>
                            <option value="weekly">Weekly</option>
                            <option value="annual">Annual</option>
                            <option value="pack">Pack</option>
                            <option value="drop_in">Drop-in</option>
                          </select>
                        )}
                      </td>
                      {classSubscribe ? (
                        <td className="px-2 py-1.5 text-[11px] text-slate-600 dark:text-yellow-100/80 whitespace-nowrap">
                          {p.unlocks_all_classes
                            ? 'All adult classes'
                            : cover.count
                              ? `${cover.count} · next ${cover.next?.date || ''}`
                              : 'Not on calendar'}
                        </td>
                      ) : null}
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={d.public}
                          onChange={(e) =>
                            setRow(p.id, { public: e.target.checked })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={saving && busyId === p.id}
                          className="rounded-lg bg-yellow-400 px-2.5 py-1 text-[11px] font-black text-yellow-950 disabled:opacity-50"
                          onClick={() => void savePlan(p.id, draftFor(p))}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="ml-1 p-1 text-rose-600 dark:text-rose-300"
                          title="Delete"
                          onClick={() => void remove(p.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr>
                        <td colSpan={classSubscribe ? 8 : 7} className="p-0">
                          {renderEditor(
                            d,
                            (patch) => setRow(p.id, patch),
                            { plan: p }
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


