'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Link2, Repeat, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import {
  DataTable,
  FormCard,
  ListRowCard,
  StatRow,
  fc,
  toneLinkClass,
} from '@/components/fitness/FitForm';
import { sessionBookingCount } from '@/lib/fitness/fitgraph';
import {
  PracticeScheduleCalendar,
  type ScheduleEvent,
} from '@/components/schedule/PracticeScheduleCalendar';
import { WorkingHoursEditor } from '@/components/schedule/WorkingHoursEditor';
import { normalizeWorkingHours } from '@/lib/schedule/working-hours';

const WEEKDAYS = [
  { v: 1, l: 'Mon' },
  { v: 2, l: 'Tue' },
  { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' },
  { v: 6, l: 'Sat' },
  { v: 0, l: 'Sun' },
];

export default function CalendarPage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [personFilter, setPersonFilter] = useState('');
  const [form, setForm] = useState({
    class_type_id: '',
    coach_id: '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '06:00',
    location: 'Studio A',
    capacity: '',
    public: true,
    public_notes: '',
    class_plan: '',
    repeat: 'none' as 'none' | 'weekly',
    count: '8',
    weekdays: [] as number[],
  });

  const daySessions = useMemo(() => {
    if (!store) return [];
    return store.sessions
      .filter((s) => s.date === day && s.status !== 'cancelled')
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [store, day]);

  const scheduleEvents: ScheduleEvent[] = useMemo(() => {
    if (!store) return [];
    return store.sessions
      .filter((s) => s.status !== 'cancelled')
      .map((s) => {
        const ct = store.class_types.find((c) => c.id === s.class_type_id);
        const coach = store.coaches.find((c) => c.id === s.coach_id);
        const booked = sessionBookingCount(store, s.id);
        const cap = s.capacity ?? ct?.capacity ?? 0;
        return {
          id: s.id,
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
          duration_min: s.duration_min ?? ct?.default_duration_min ?? 45,
          title: ct?.name || 'Class',
          subtitle: s.location || undefined,
          person_id: s.coach_id || null,
          person_name: coach?.name,
          status: s.status,
          public: s.public === true,
          meta: `${booked}${cap ? `/${cap}` : ''} booked${
            s.public ? ' · public' : ''
          }`,
          tone: 'violet' as const,
        };
      });
  }, [store]);

  const schedulePeople = useMemo(
    () =>
      (store?.coaches || [])
        .filter((c) => c.active !== false)
        .map((c) => ({
          id: c.id,
          name: c.name,
          role: (c.specialties || []).slice(0, 2).join(', ') || undefined,
        })),
    [store]
  );

  const workingHours = useMemo(
    () => normalizeWorkingHours(store?.settings?.working_hours),
    [store?.settings?.working_hours]
  );

  const saveHours = async (hours: typeof workingHours) => {
    await post({
      action: 'update_settings',
      settings: {
        ...(store?.settings || {}),
        working_hours: hours,
      },
    });
    toast.success('Gym working hours saved');
  };

  const add = async () => {
    if (!form.class_type_id) {
      toast.error('Select a class type');
      return;
    }
    if (!form.coach_id) {
      toast.error('Assign a coach');
      return;
    }
    if (form.repeat === 'weekly') {
      const data = await post({
        action: 'create_session_series',
        coach_id: form.coach_id,
        class_type_id: form.class_type_id,
        date: form.date,
        start_time: form.start_time,
        location: form.location || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        public: form.public,
        public_notes: form.public_notes || undefined,
        class_plan: form.class_plan.trim() || undefined,
        repeat: 'weekly',
        count: Number(form.count) || 8,
        weekdays:
          form.weekdays.length > 0
            ? form.weekdays
            : [new Date(form.date + 'T12:00:00').getDay()],
      });
      toast.success(data.message || 'Series scheduled');
      return;
    }
    await post({
      entity: 'sessions',
      action: 'upsert',
      record: {
        class_type_id: form.class_type_id,
        coach_id: form.coach_id || null,
        date: form.date,
        start_time: form.start_time,
        location: form.location,
        capacity: form.capacity ? Number(form.capacity) : null,
        public: form.public,
        public_notes: form.public_notes || undefined,
        class_plan: form.class_plan.trim() || undefined,
        origin: 'owner',
      },
    });
    toast.success(
      form.public
        ? 'Class scheduled, coach assigned, published to website'
        : 'Class scheduled and coach assigned'
    );
  };

  const copyInvite = async (sessionId: string) => {
    const data = await post({
      action: 'issue_class_invite',
      session_id: sessionId,
    });
    const inv = data.invite as
      | { path?: string; text?: string }
      | undefined;
    if (!inv?.path || typeof window === 'undefined') {
      toast.error('Could not create invite link');
      return;
    }
    const url = `${window.location.origin}${inv.path}`;
    const full = `${inv.text || 'Join this class'}\n${url}`;
    await navigator.clipboard.writeText(full);
    toast.success('B2C join link copied — send via WhatsApp / email');
  };

  const togglePublic = async (id: string, next: boolean) => {
    const s = store?.sessions.find((x) => x.id === id);
    if (!s) return;
    await post({
      entity: 'sessions',
      action: 'upsert',
      record: {
        ...s,
        public: next,
      },
    });
    toast.success(next ? 'Shared on website' : 'Hidden from website');
  };

  const reassignCoach = async (id: string, coachId: string) => {
    const s = store?.sessions.find((x) => x.id === id);
    if (!s) return;
    await post({
      entity: 'sessions',
      action: 'upsert',
      record: {
        ...s,
        coach_id: coachId || null,
      },
    });
    toast.success('Coach updated');
  };

  return (
    <FitgraphWorkbench
      title="Calendar"
      titleAccent="gym schedule"
      description="Day, week and month views — set gym hours, filter by coach, schedule sessions and publish to the website."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="owner"
            items={[
              { label: 'On selected day', value: daySessions.length },
              {
                label: 'Today (hub)',
                value: Number(summary?.sessionsToday) || 0,
              },
              {
                label: 'Public upcoming',
                value: Number(summary?.publicSessionsUpcoming) || 0,
              },
              {
                label: 'Coaches',
                value: schedulePeople.length,
              },
            ]}
          />

          <WorkingHoursEditor
            value={workingHours}
            onSave={saveHours}
            saving={saving}
            title="Gym working hours"
            description="Open days and studio hours. Closed days are dimmed on the calendar; day view follows your open window."
            accentClass="border-violet-200 dark:border-violet-800"
          />

          <PracticeScheduleCalendar
            title="Class schedule"
            accent="violet"
            events={scheduleEvents}
            people={schedulePeople}
            peopleLabel="Coach"
            workingHours={workingHours}
            personFilter={personFilter}
            onPersonFilterChange={(id) => {
              setPersonFilter(id);
              if (id) setForm((f) => ({ ...f, coach_id: id }));
            }}
            initialDate={day}
            emptyLabel="No classes"
            onSelectDate={(date) => {
              setDay(date);
              setForm((f) => ({ ...f, date }));
            }}
          />

          <FormCard
            tone="owner"
            title="Set out class · assign coach"
            onSubmit={() => void add()}
            saving={saving}
            submitLabel={
              form.repeat === 'weekly' ? 'Schedule series' : 'Schedule class'
            }
          >
            <select
              className={fc()}
              value={form.class_type_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, class_type_id: e.target.value }))
              }
            >
              <option value="">Class type…</option>
              {store.class_types.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className={fc()}
              value={form.coach_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, coach_id: e.target.value }))
              }
            >
              <option value="">Coach (required)…</option>
              {store.coaches
                .filter((c) => c.active !== false)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {(c.specialties || []).length
                      ? ` · ${(c.specialties || []).join(', ')}`
                      : ''}
                  </option>
                ))}
            </select>
            <input
              className={fc()}
              type="date"
              value={form.date}
              onChange={(e) =>
                setForm((f) => ({ ...f, date: e.target.value }))
              }
            />
            <input
              className={fc()}
              type="time"
              value={form.start_time}
              onChange={(e) =>
                setForm((f) => ({ ...f, start_time: e.target.value }))
              }
            />
            <input
              className={fc()}
              placeholder="Location / room"
              value={form.location}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
            />
            <input
              className={fc()}
              type="number"
              placeholder="Capacity override"
              value={form.capacity}
              onChange={(e) =>
                setForm((f) => ({ ...f, capacity: e.target.value }))
              }
            />
            <textarea
              className={fc() + ' min-h-[4rem] resize-y sm:col-span-2'}
              placeholder="Class plan / activities (members see this)"
              value={form.class_plan}
              onChange={(e) =>
                setForm((f) => ({ ...f, class_plan: e.target.value }))
              }
            />
            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                  form.repeat === 'none'
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'border-slate-200 dark:border-violet-600'
                }`}
                onClick={() => setForm((f) => ({ ...f, repeat: 'none' }))}
              >
                One-off
              </button>
              <button
                type="button"
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1 ${
                  form.repeat === 'weekly'
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'border-slate-200 dark:border-violet-600'
                }`}
                onClick={() => setForm((f) => ({ ...f, repeat: 'weekly' }))}
              >
                <Repeat className="w-3 h-3" /> Weekly series
              </button>
            </div>
            {form.repeat === 'weekly' && (
              <>
                <div className="sm:col-span-2 flex flex-wrap gap-1">
                  {WEEKDAYS.map((w) => {
                    const on = form.weekdays.includes(w.v);
                    return (
                      <button
                        key={w.v}
                        type="button"
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                          on
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'border-slate-200 dark:border-violet-600'
                        }`}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            weekdays: on
                              ? f.weekdays.filter((x) => x !== w.v)
                              : [...f.weekdays, w.v],
                          }))
                        }
                      >
                        {w.l}
                      </button>
                    );
                  })}
                </div>
                <input
                  className={fc()}
                  type="number"
                  min={1}
                  max={52}
                  placeholder="Weeks"
                  value={form.count}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, count: e.target.value }))
                  }
                />
              </>
            )}
            <label className="flex items-center gap-2 text-sm font-medium px-1 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.public}
                onChange={(e) =>
                  setForm((f) => ({ ...f, public: e.target.checked }))
                }
              />
              List on public website calendar
            </label>
          </FormCard>

          <p className="text-xs text-slate-500">
            After scheduling, use <strong>Copy join link</strong> on a class to
            WhatsApp/email members (B2C). They book and add to calendar.{' '}
            <Link
              href="/dashboard/fitgraph/coach-calendar"
              className="font-bold text-violet-700 underline"
            >
              Coach calendar
            </Link>{' '}
            for plan/actuals.
          </p>

          <div className="space-y-2">
            {daySessions.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-2xl">
                No sessions on {day}. Schedule one above and assign a coach.
              </p>
            ) : (
              daySessions.map((s) => {
                const ct = store.class_types.find(
                  (c) => c.id === s.class_type_id
                );
                const coach = store.coaches.find((c) => c.id === s.coach_id);
                const booked = sessionBookingCount(store, s.id);
                const cap = s.capacity ?? ct?.capacity ?? 0;
                return (
                  <ListRowCard
                    key={s.id}
                    tone="owner"
                    actions={
                      <>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 dark:text-violet-300"
                          onClick={() => void copyInvite(s.id)}
                          title="Copy B2C join link for members"
                        >
                          <Share2 className="w-3.5 h-3.5" /> Join link
                        </button>
                        <button
                          type="button"
                          className={`text-xs font-bold ${toneLinkClass('owner')}`}
                          onClick={() => void togglePublic(s.id, !s.public)}
                        >
                          {s.public ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          className="text-rose-600 dark:text-rose-400 text-xs font-bold"
                          onClick={() =>
                            void post({
                              entity: 'sessions',
                              action: 'delete',
                              id: s.id,
                            })
                          }
                        >
                          Remove
                        </button>
                      </>
                    }
                  >
                    <div className="space-y-2">
                      <div className="font-bold text-sm text-slate-900 dark:text-violet-50">
                        {s.start_time} · {ct?.name || 'Class'}
                        {s.public ? (
                          <span className="ml-2 text-[10px] font-black uppercase text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded dark:text-violet-100 dark:bg-violet-800">
                            Public
                          </span>
                        ) : (
                          <span className="ml-2 text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded dark:text-neutral-400 dark:bg-neutral-800">
                            Invite
                          </span>
                        )}
                        {s.series_id ? (
                          <span className="ml-1 text-[10px] font-black uppercase text-amber-700">
                            series
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-violet-200/80">
                        {coach?.name || 'No coach'}
                        {(coach?.specialties || []).length
                          ? ` (${(coach?.specialties || []).join(', ')})`
                          : ''}{' '}
                        · {s.location || '—'} · {booked}/{cap} booked
                      </div>
                      {s.class_plan ? (
                        <p className="text-[11px] text-violet-800 dark:text-violet-200 whitespace-pre-wrap line-clamp-3">
                          {s.class_plan}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-[10px] font-black uppercase text-violet-600/80 dark:text-violet-300/80">
                          Coach
                        </span>
                        <select
                          className="rounded-lg border border-slate-200 text-xs px-2 py-1 dark:border-violet-500/40 dark:bg-violet-950 dark:text-violet-50"
                          value={s.coach_id || ''}
                          onChange={(e) =>
                            void reassignCoach(s.id, e.target.value)
                          }
                        >
                          <option value="">Unassigned</option>
                          {store.coaches.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </ListRowCard>
                );
              })
            )}
          </div>

          <DataTable tone="owner"
            headers={[
              'Date',
              'Time',
              'Class',
              'Coach',
              'Room',
              'Cap',
              'Booked',
              'Web',
              'Status',
            ]}
            rows={[...store.sessions]
              .sort((a, b) =>
                a.date === b.date
                  ? a.start_time.localeCompare(b.start_time)
                  : a.date.localeCompare(b.date)
              )
              .slice(0, 50)
              .map((s) => {
                const ct = store.class_types.find(
                  (c) => c.id === s.class_type_id
                );
                const coach = store.coaches.find((c) => c.id === s.coach_id);
                return {
                  id: s.id,
                  cells: [
                    s.date,
                    s.start_time,
                    ct?.name || '—',
                    coach?.name || '—',
                    s.location || '—',
                    s.capacity ?? '—',
                    sessionBookingCount(store, s.id),
                    s.public ? 'Public' : 'Private',
                    s.status,
                  ],
                };
              })}
            onDelete={(id) =>
              void post({ entity: 'sessions', action: 'delete', id })
            }
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
