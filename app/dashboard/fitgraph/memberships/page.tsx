'use client';

import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/fitness/FitForm';
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
import { storeUsesClassSubscribe } from '@/lib/fitness/vuka-class-catalog';

const blankForm = () => ({
  code: '',
  name: '',
  price_zar: '',
  billing: 'monthly',
  class_credits: '',
  pt_credits: '',
  description: '',
  public: true,
  access: 'classes',
  programme_id: '',
  schedule_label: '',
});

export default function MembershipsPage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const classSubscribe = store ? storeUsesClassSubscribe(store) : false;
  const formAnchorRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm);
  const [pt, setPt] = useState({
    client_id: '',
    coach_id: '',
    sessions_total: '10',
    price_zar: '',
  });
  const scheduleAnchorRef = useRef<HTMLDivElement>(null);
  const todayIso = new Date().toISOString().slice(0, 10);
  const [schedule, setSchedule] = useState({
    plan_id: '',
    date: todayIso,
    start_time: '06:00',
    end_time: '07:00',
    coach_id: '',
    location: '',
    room: '',
    capacity: '',
    public: true,
  });
  const [recurrence, setRecurrence] = useState<RecurrenceFormValue>(
    emptyRecurrenceForm()
  );

  const editing = useMemo(
    () =>
      editingId && store
        ? store.membership_plans.find((p) => p.id === editingId) || null
        : null,
    [store, editingId]
  );

  const startEdit = (id: string) => {
    const p = store?.membership_plans.find((x) => x.id === id);
    if (!p) {
      toast.error('Membership not found');
      return;
    }
    setEditingId(p.id);
    setForm({
      code: p.code || '',
      name: p.name || '',
      price_zar: p.price_zar != null ? String(p.price_zar) : '',
      billing: p.billing || 'monthly',
      class_credits:
        p.class_credits != null ? String(p.class_credits) : '',
      pt_credits: p.pt_credits != null ? String(p.pt_credits) : '',
      description: p.description || '',
      public: p.public !== false,
      access: p.access || 'classes',
      programme_id: p.programme_id || '',
      schedule_label: p.schedule_label || '',
    });
    requestAnimationFrame(() => {
      formAnchorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(blankForm());
  };

  const add = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'membership_plans',
      action: 'upsert',
      record: {
        ...(editingId ? { id: editingId } : {}),
        ...form,
        price_zar: Number(form.price_zar) || 0,
        class_credits: form.class_credits ? Number(form.class_credits) : null,
        pt_credits: form.pt_credits ? Number(form.pt_credits) : null,
        description: form.description.trim() || undefined,
        public: form.public,
        access: form.access,
        programme_id: form.programme_id || null,
        schedule_label: form.schedule_label.trim() || undefined,
      },
    });
    toast.success(editingId ? 'Plan updated' : 'Plan saved');
    cancelEdit();
  };

  const applySchedulePlan = (planId: string) => {
    const plan = store?.membership_plans.find((p) => p.id === planId);
    if (!store || !plan) {
      setSchedule((s) => ({ ...s, plan_id: planId }));
      return;
    }
    if (plan.unlocks_all_classes) {
      toast.message('Unlimited covers every adult class', {
        description: 'Schedule the individual classes instead.',
      });
      setSchedule((s) => ({ ...s, plan_id: '' }));
      return;
    }
    const hint = suggestClassSchedule(store, plan);
    const date = nextDateForWeekdays(hint.weekdays, todayIso);
    setSchedule({
      plan_id: plan.id,
      date,
      start_time: hint.start_time,
      end_time: hint.end_time,
      coach_id: '',
      location: hint.location,
      room: '',
      capacity: hint.capacity != null ? String(hint.capacity) : '',
      public: hint.public,
    });
    setRecurrence({
      ...emptyRecurrenceForm(),
      frequency: hint.frequency,
      weekdays: hint.weekdays,
      interval: '1',
      count: '16',
      end_mode: 'count',
    });
  };

  const putOnCalendar = async () => {
    if (!schedule.plan_id) {
      toast.error('Select a class');
      return;
    }
    if (!schedule.date || !schedule.start_time) {
      toast.error('Set date and start time');
      return;
    }
    const recErr = validateRecurrenceForm(recurrence);
    if (recErr) {
      toast.error(recErr);
      return;
    }
    const payload = recurrenceApiPayload(recurrence, schedule.date);
    try {
      const data = await post({
        action: 'schedule_class',
        plan_id: schedule.plan_id,
        date: schedule.date,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        coach_id: schedule.coach_id || null,
        location: schedule.location || undefined,
        room: schedule.room || undefined,
        capacity: schedule.capacity ? Number(schedule.capacity) : undefined,
        public: schedule.public,
        ...(payload || { frequency: 'none' }),
      });
      toast.success((data?.message as string) || 'On the calendar');
    } catch {
      /* toast from useFitgraph */
    }
  };

  const addPt = async () => {
    if (!pt.client_id) {
      toast.error('Select client');
      return;
    }
    await post({
      entity: 'pt_packs',
      action: 'upsert',
      record: {
        ...pt,
        coach_id: pt.coach_id || null,
        sessions_total: Number(pt.sessions_total) || 0,
        sessions_used: 0,
        price_zar: pt.price_zar ? Number(pt.price_zar) : null,
      },
    });
    toast.success('PT pack issued');
  };

  return (
    <FitgraphWorkbench
      title={classSubscribe ? 'Classes' : 'Membership plans'}
      titleAccent={classSubscribe ? 'rates · subscribe' : '& PT packs'}
      description={
        classSubscribe
          ? 'A class is the membership. Set the rate, put it on the calendar with repeats, then allocate members. Subscribers appear on those diary dates.'
          : 'Sellable memberships shown on your website. Members must pay first (Paystack / Apple Pay) before they can book classes. Assign desk-issued plans on Subscriptions.'
      }
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="owner"
            items={[
              {
                label: classSubscribe ? 'Classes' : 'Plans',
                value: Number(summary?.planCount) || store.membership_plans.length,
              },
              {
                label: 'Active subs',
                value: Number(summary?.activeSubscriptions) || 0,
              },
              {
                label: 'PT sessions left',
                value: Number(summary?.ptSessionsRemaining) || 0,
              },
            ]}
          />
          {store.settings?.joining_fee_zar != null ? (
            <p className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-950 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-100">
              Once-off joining R{store.settings.joining_fee_zar}
              {store.settings.joining_fee_waived
                ? ' — currently waived (free).'
                : '.'}{' '}
              {store.settings.joining_fee_note || ''}
            </p>
          ) : null}
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {classSubscribe ? (
              <>
                Put each class on the calendar below (with repeats). Then{' '}
                <a
                  href="/dashboard/fitgraph/membership"
                  className="font-bold text-yellow-700 underline dark:text-yellow-300"
                >
                  Membership
                </a>{' '}
                allocates people. They show on{' '}
                <a
                  href="/dashboard/fitgraph/calendar"
                  className="font-bold text-yellow-700 underline dark:text-yellow-300"
                >
                  Calendar
                </a>
                .
              </>
            ) : (
              <>
                Manage member billing status on{' '}
                <a
                  href="/dashboard/fitgraph/subscriptions"
                  className="font-bold text-yellow-700 underline dark:text-yellow-300"
                >
                  Subscriptions
                </a>
                .
              </>
            )}
          </p>
          <div ref={formAnchorRef}>
          <FormCard
            tone="owner"
            title={
              editingId
                ? `Edit ${classSubscribe ? 'class' : 'plan'} · ${editing?.name || form.name || '…'}`
                : classSubscribe
                  ? 'Add class'
                  : 'Add plan'
            }
            description={
              editingId
                ? classSubscribe
                  ? 'Update this class. Members already subscribed stay on it; the new rate applies from save.'
                  : 'Update this membership. Existing subscriptions stay on this plan; price and credits apply from the next save.'
                : undefined
            }
            onSubmit={() => void add()}
            saving={saving}
            submitLabel={
              editingId
                ? 'Save changes'
                : classSubscribe
                  ? 'Add class'
                  : 'Add plan'
            }
          >
            {editingId ? (
              <p className="sm:col-span-2 lg:col-span-3 text-xs text-yellow-700 dark:text-yellow-300 font-medium rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50/80 dark:bg-yellow-950/40 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Editing <strong>{editing?.code || editingId}</strong>
                </span>
                <button
                  type="button"
                  className="text-xs font-bold underline"
                  onClick={cancelEdit}
                >
                  Cancel · new {classSubscribe ? 'class' : 'plan'}
                </button>
              </p>
            ) : null}
            <input className={fc()} placeholder="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            <input className={fc()} placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input className={fc()} type="number" placeholder="Price ZAR" value={form.price_zar} onChange={(e) => setForm((f) => ({ ...f, price_zar: e.target.value }))} />
            <select className={fc()} value={form.billing} onChange={(e) => setForm((f) => ({ ...f, billing: e.target.value }))}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="annual">Annual</option>
              <option value="pack">Pack</option>
              <option value="drop_in">Drop-in</option>
            </select>
            {classSubscribe ? (
              <input
                className={fc()}
                placeholder="When (e.g. 5:00am Mon / Wed / Fri)"
                value={form.schedule_label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, schedule_label: e.target.value }))
                }
              />
            ) : (
              <>
                <input className={fc()} type="number" placeholder="Class credits (blank = unlimited)" value={form.class_credits} onChange={(e) => setForm((f) => ({ ...f, class_credits: e.target.value }))} />
                <input className={fc()} type="number" placeholder="PT credits" value={form.pt_credits} onChange={(e) => setForm((f) => ({ ...f, pt_credits: e.target.value }))} />
              </>
            )}
            <textarea
              className={fc() + ' min-h-[3rem] resize-y sm:col-span-2'}
              placeholder={
                classSubscribe
                  ? 'What this class includes (shown on the public shop)'
                  : 'What this membership includes (shown on the public shop)'
              }
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
            {!classSubscribe ? (
              <>
            <select
              className={fc()}
              value={form.access}
              onChange={(e) =>
                setForm((f) => ({ ...f, access: e.target.value }))
              }
            >
              <option value="classes">Unlocks classes</option>
              <option value="programme">Unlocks a programme</option>
              <option value="both">Classes + programme</option>
            </select>
            <select
              className={fc()}
              value={form.programme_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, programme_id: e.target.value }))
              }
            >
              <option value="">Include programme (optional)…</option>
              {(store.programmes || [])
                .filter((p) => p.active !== false && p.personal_for_coach !== true)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
              </>
            ) : null}
            <label className="flex items-center gap-2 text-sm font-medium col-span-full">
              <input
                type="checkbox"
                checked={form.public}
                onChange={(e) =>
                  setForm((f) => ({ ...f, public: e.target.checked }))
                }
              />
              {classSubscribe
                ? 'Sell on website / member portal'
                : 'Sell on website (public priced plans require Paystack / Apple Pay first)'}
            </label>
          </FormCard>
          </div>
          {classSubscribe ? (
            <div ref={scheduleAnchorRef}>
              <FormCard
                tone="owner"
                title="Put class on calendar"
                description="Pick the class, first date, time, and repeats. Subscribed members are booked onto those dates and show on Calendar."
                onSubmit={() => void putOnCalendar()}
                saving={saving}
                submitLabel={
                  recurrence.frequency === 'none'
                    ? 'Add to calendar'
                    : 'Add repeating classes'
                }
              >
                <select
                  className={fc()}
                  value={schedule.plan_id}
                  onChange={(e) => applySchedulePlan(e.target.value)}
                >
                  <option value="">Class…</option>
                  {store.membership_plans
                    .filter(
                      (p) => p.active !== false && p.unlocks_all_classes !== true
                    )
                    .sort(
                      (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.schedule_label ? ` · ${p.schedule_label}` : ''}
                      </option>
                    ))}
                </select>
                <select
                  className={fc()}
                  value={schedule.coach_id}
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, coach_id: e.target.value }))
                  }
                >
                  <option value="">Coach (optional)…</option>
                  {store.coaches
                    .filter((c) => c.active !== false)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <input
                  className={fc()}
                  type="date"
                  value={schedule.date}
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, date: e.target.value }))
                  }
                />
                <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Start
                  <input
                    className={fc()}
                    type="time"
                    value={schedule.start_time}
                    onChange={(e) => {
                      const start = e.target.value;
                      const dur = schedule.end_time
                        ? durationFromStartEnd(schedule.start_time, schedule.end_time)
                        : 60;
                      setSchedule((s) => ({
                        ...s,
                        start_time: start,
                        end_time: endFromStartDuration(start, dur),
                      }));
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                  End
                  <input
                    className={fc()}
                    type="time"
                    value={schedule.end_time}
                    onChange={(e) =>
                      setSchedule((s) => ({ ...s, end_time: e.target.value }))
                    }
                  />
                </label>
                <input
                  className={fc()}
                  placeholder="Location"
                  value={schedule.location}
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, location: e.target.value }))
                  }
                />
                <RecurrenceFields
                  value={recurrence}
                  onChange={setRecurrence}
                  startDate={schedule.date}
                  inputClass={fc()}
                  accent="yellow"
                  unitLabel="classes"
                />
                <label className="flex items-center gap-2 text-sm font-medium col-span-full">
                  <input
                    type="checkbox"
                    checked={schedule.public}
                    onChange={(e) =>
                      setSchedule((s) => ({ ...s, public: e.target.checked }))
                    }
                  />
                  List on public website calendar
                </label>
              </FormCard>
            </div>
          ) : null}
          <DataTable tone="owner"
            headers={
              classSubscribe
                ? ['Code', 'Name', 'When', 'Price', 'Coach', 'On calendar', 'Web']
                : ['Code', 'Name', 'When', 'Price', 'Billing', 'Web']
            }
            rows={[...store.membership_plans]
              .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
              .map((p) => {
                const cover = classSubscribe
                  ? calendarCoverage(store, p, todayIso)
                  : null;
                return {
              id: p.id,
              cells: [
                p.code,
                p.name,
                p.schedule_label || (p.addon ? 'Add-on' : '—'),
                p.price_zar,
                ...(classSubscribe
                  ? [
                      p.unlocks_all_classes
                        ? '—'
                        : cover?.coachNames.length
                          ? cover.coachNames.join(', ')
                          : '—',
                      p.unlocks_all_classes
                        ? 'All adult classes'
                        : cover && cover.count
                          ? `${cover.count} · next ${cover.next?.date || ''}`
                          : 'Not on calendar',
                    ]
                  : [p.billing]),
                p.public !== false ? 'Public' : 'Hidden',
              ],
            };
              })}
            onEdit={(id) => startEdit(id)}
            onDelete={(id) => {
              if (editingId === id) cancelEdit();
              void post({ entity: 'membership_plans', action: 'delete', id });
            }}
          />


          <FormCard tone="owner" title="Issue PT pack" onSubmit={() => void addPt()} saving={saving} submitLabel="Issue pack">
            <select className={fc()} value={pt.client_id} onChange={(e) => setPt((f) => ({ ...f, client_id: e.target.value }))}>
              <option value="">Client…</option>
              {store.clients.map((c) => (
                <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
              ))}
            </select>
            <select className={fc()} value={pt.coach_id} onChange={(e) => setPt((f) => ({ ...f, coach_id: e.target.value }))}>
              <option value="">Coach…</option>
              {store.coaches.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input className={fc()} type="number" placeholder="Sessions" value={pt.sessions_total} onChange={(e) => setPt((f) => ({ ...f, sessions_total: e.target.value }))} />
            <input className={fc()} type="number" placeholder="Price ZAR" value={pt.price_zar} onChange={(e) => setPt((f) => ({ ...f, price_zar: e.target.value }))} />
          </FormCard>
          <DataTable tone="owner"
            headers={['Client', 'Coach', 'Used / Total', 'Purchased', 'Price']}
            rows={store.pt_packs.map((p) => {
              const client = store.clients.find((c) => c.id === p.client_id);
              const coach = store.coaches.find((c) => c.id === p.coach_id);
              return {
                id: p.id,
                cells: [
                  client?.name || p.client_id,
                  coach?.name || '—',
                  `${p.sessions_used} / ${p.sessions_total}`,
                  p.purchased_at,
                  p.price_zar ?? '—',
                ],
              };
            })}
            onDelete={(id) => void post({ entity: 'pt_packs', action: 'delete', id })}
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
