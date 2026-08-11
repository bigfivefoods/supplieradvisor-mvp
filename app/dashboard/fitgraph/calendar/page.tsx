'use client';

import { useMemo, useRef, useState } from 'react';
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
  type DiaryScope,
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
  const formAnchorRef = useRef<HTMLDivElement>(null);
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [personFilter, setPersonFilter] = useState('');
  const [diaryScope, setDiaryScope] = useState<DiaryScope>('practice');
  const [slotPicked, setSlotPicked] = useState<string | null>(null);
  const [form, setForm] = useState({
    class_type_id: '',
    coach_id: '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '06:00',
    location: 'Studio A',
    room: '',
    capacity: '',
    public: true,
    public_notes: '',
    class_plan: '',
    repeat: 'none' as 'none' | 'weekly',
    count: '8',
    weekdays: [] as number[],
    /** Optional: book these members onto the new class */
    client_ids: [] as string[],
    /** When exactly one member is selected, optional family attendee */
    family_member_id: '',
    member_query: '',
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
            s.room ? ` · ${s.room}` : ''
          }${s.public ? ' · public' : ''}`,
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

  const pickSlot = (slot: {
    date: string;
    start_time: string;
    person_id?: string | null;
  }) => {
    setDay(slot.date);
    setForm((f) => ({
      ...f,
      date: slot.date,
      start_time: slot.start_time.slice(0, 5),
      coach_id: slot.person_id || f.coach_id || personFilter || '',
      repeat: 'none',
    }));
    setSlotPicked(`${slot.date} · ${slot.start_time.slice(0, 5)}`);
    // Scroll schedule form into view
    requestAnimationFrame(() => {
      formAnchorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
    toast.message('Time selected', {
      description: `${slot.date} at ${slot.start_time.slice(0, 5)} — finish the class details below`,
    });
  };

  const bookMembersOntoSessions = async (sessionIds: string[]) => {
    const ids = form.client_ids;
    if (!ids.length || !sessionIds.length) return 0;
    let n = 0;
    for (const sessionId of sessionIds) {
      for (const clientId of ids) {
        await post({
          entity: 'bookings',
          action: 'upsert',
          record: {
            session_id: sessionId,
            client_id: clientId,
            family_member_id:
              ids.length === 1 && form.family_member_id
                ? form.family_member_id
                : null,
            status: 'booked',
            source: 'desk',
          },
        });
        n += 1;
      }
    }
    return n;
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
        room: form.room || undefined,
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
      const sessions = (data.sessions || []) as Array<{ id: string }>;
      const sessionIds = sessions.map((s) => s.id).filter(Boolean);
      const booked = await bookMembersOntoSessions(sessionIds);
      toast.success(
        booked > 0
          ? `${data.message || 'Series scheduled'} · ${form.client_ids.length} member(s) on each class`
          : data.message || 'Series scheduled'
      );
      setForm((f) => ({
        ...f,
        client_ids: [],
        family_member_id: '',
        member_query: '',
      }));
      setSlotPicked(null);
      return;
    }
    const sessionId = `ses_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    await post({
      entity: 'sessions',
      action: 'upsert',
      record: {
        id: sessionId,
        class_type_id: form.class_type_id,
        coach_id: form.coach_id || null,
        date: form.date,
        start_time: form.start_time,
        location: form.location,
        room: form.room || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        public: form.public,
        public_notes: form.public_notes || undefined,
        class_plan: form.class_plan.trim() || undefined,
        origin: 'owner',
      },
    });
    const booked = await bookMembersOntoSessions([sessionId]);
    if (booked > 0) {
      toast.success(
        form.public
          ? `Class scheduled with ${form.client_ids.length} member(s), published to website`
          : `Class scheduled with ${form.client_ids.length} member(s) booked`
      );
    } else {
      toast.success(
        form.public
          ? 'Class scheduled, coach assigned, published to website'
          : 'Class scheduled and coach assigned'
      );
    }
    setForm((f) => ({
      ...f,
      client_ids: [],
      family_member_id: '',
      member_query: '',
    }));
    setSlotPicked(null);
  };

  const selectedClientFamily = useMemo(() => {
    if (!store || form.client_ids.length !== 1) return [];
    const c = store.clients.find((x) => x.id === form.client_ids[0]);
    return (c?.family || []).filter((m) => m.active !== false);
  }, [store, form.client_ids]);

  const memberChoices = useMemo(() => {
    if (!store) return [];
    const q = form.member_query.trim().toLowerCase();
    return (store.clients || [])
      .filter((c) => c.active !== false)
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          String(c.email || '')
            .toLowerCase()
            .includes(q) ||
          String(c.code || '')
            .toLowerCase()
            .includes(q)
        );
      })
      .slice(0, 80);
  }, [store, form.member_query]);

  const toggleMember = (id: string) => {
    setForm((f) => {
      const on = f.client_ids.includes(id);
      const client_ids = on
        ? f.client_ids.filter((x) => x !== id)
        : [...f.client_ids, id];
      return {
        ...f,
        client_ids,
        family_member_id:
          client_ids.length === 1 ? f.family_member_id : '',
      };
    });
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
      description="Click empty time to schedule. Multiple coaches can run at the same time — concurrent sessions sit side-by-side (large floor / train anywhere). SupplierAdvisor only bills your platform subscription — member fees stay your own arrangement."
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
            defaultCollapsed
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
            diaryScope={diaryScope}
            onDiaryScopeChange={(scope) => {
              setDiaryScope(scope);
              if (scope === 'practice') setPersonFilter('');
            }}
            showDiaryScopeToggle
            personFilter={personFilter}
            onPersonFilterChange={(id) => {
              setPersonFilter(id);
              if (id) setForm((f) => ({ ...f, coach_id: id }));
            }}
            initialDate={day}
            emptyLabel="No classes"
            slotHint="Click empty time to add a class"
            onSelectDate={(date) => {
              setDay(date);
              setForm((f) => ({ ...f, date }));
            }}
            onSelectSlot={pickSlot}
            onSelectEvent={(ev) => {
              // Prefill form from existing class for quick re-use / edit flow
              setDay(ev.date);
              setForm((f) => ({
                ...f,
                date: ev.date,
                start_time: ev.start_time.slice(0, 5),
                coach_id: ev.person_id || f.coach_id,
              }));
              toast.message('Class selected', {
                description: `${ev.start_time.slice(0, 5)} · ${ev.title} — use join link below or schedule another at this time`,
              });
            }}
          />

          <div ref={formAnchorRef}>
          <FormCard
            tone="owner"
            title={
              slotPicked
                ? `Schedule class · ${slotPicked}`
                : 'Set out class · assign coach'
            }
            onSubmit={() => void add()}
            saving={saving}
            submitLabel={
              form.repeat === 'weekly'
                ? form.client_ids.length
                  ? `Schedule series + ${form.client_ids.length} member(s)`
                  : 'Schedule series'
                : form.client_ids.length
                  ? `Schedule class + ${form.client_ids.length} member(s)`
                  : 'Schedule class'
            }
          >
            {slotPicked ? (
              <p className="sm:col-span-2 lg:col-span-3 text-xs text-violet-700 dark:text-violet-300 font-medium rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/80 dark:bg-violet-950/40 px-3 py-2">
                Slot from calendar: <strong>{slotPicked}</strong>. Pick class
                type and coach, tick members to add, then save.
              </p>
            ) : (
              <p className="sm:col-span-2 lg:col-span-3 text-xs text-slate-500">
                Tip: open <strong>Day</strong> or <strong>Week</strong> view and
                click an empty time to fill date &amp; start time automatically.
                Select members below to book them onto the new class.
              </p>
            )}
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
              placeholder="Location / site"
              value={form.location}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
            />
            {(store.settings?.rooms || []).length > 0 ? (
              <select
                className={fc()}
                value={form.room}
                onChange={(e) =>
                  setForm((f) => ({ ...f, room: e.target.value }))
                }
              >
                <option value="">Room / studio…</option>
                {(store.settings?.rooms || []).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={fc()}
                placeholder="Room / studio (set list under Website)"
                value={form.room}
                onChange={(e) =>
                  setForm((f) => ({ ...f, room: e.target.value }))
                }
              />
            )}
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
            <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/30 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wide text-violet-800 dark:text-violet-200">
                  Add members to this class
                  {form.client_ids.length
                    ? ` · ${form.client_ids.length} selected`
                    : ''}
                </p>
                {form.client_ids.length > 0 ? (
                  <button
                    type="button"
                    className="text-[11px] font-bold text-violet-700 dark:text-violet-300 underline"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        client_ids: [],
                        family_member_id: '',
                      }))
                    }
                  >
                    Clear all
                  </button>
                ) : null}
              </div>
              <input
                className={fc()}
                placeholder="Search members by name, email, code…"
                value={form.member_query}
                onChange={(e) =>
                  setForm((f) => ({ ...f, member_query: e.target.value }))
                }
              />
              <div className="max-h-44 overflow-y-auto rounded-xl border border-violet-100 dark:border-violet-900 bg-white dark:bg-slate-950 divide-y divide-slate-100 dark:divide-slate-800">
                {memberChoices.length === 0 ? (
                  <p className="text-xs text-slate-500 px-3 py-4 text-center">
                    No members match. Add clients under FitAdvisor → Clients.
                  </p>
                ) : (
                  memberChoices.map((c) => {
                    const on = form.client_ids.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-start gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-violet-50/80 dark:hover:bg-violet-950/40"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={on}
                          onChange={() => toggleMember(c.id)}
                        />
                        <span className="min-w-0">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {c.name}
                          </span>
                          {c.booking_soft_block ? (
                            <span className="text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                              {' '}
                              ⚠ no-shows
                            </span>
                          ) : null}
                          {c.membership_status === 'frozen' ? (
                            <span className="text-[11px] text-slate-500">
                              {' '}
                              · frozen
                            </span>
                          ) : null}
                          <span className="block text-[11px] text-slate-500 truncate">
                            {[c.code, c.email].filter(Boolean).join(' · ') ||
                              '—'}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              {form.client_ids.length === 1 &&
              selectedClientFamily.length > 0 ? (
                <select
                  className={fc()}
                  value={form.family_member_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      family_member_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Attendee: account holder</option>
                  {selectedClientFamily.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.relationship ? ` · ${m.relationship}` : ''}
                      {m.is_minor ? ' (child)' : ''}
                    </option>
                  ))}
                </select>
              ) : form.client_ids.length > 1 ? (
                <p className="text-[11px] text-slate-500">
                  Multiple members selected — each is booked as the account
                  holder. For a family child, select only that parent account.
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Optional. Tick members now, or book later from Bookings /
                  Coach calendar.
                </p>
              )}
            </div>
            {form.date && form.start_time ? (
              <a
                className="sm:col-span-2 text-xs font-bold text-violet-700 underline"
                href={`/api/public/advisor/ics?module=fitgraph&date=${encodeURIComponent(form.date)}&start=${encodeURIComponent(form.start_time)}&title=${encodeURIComponent('FitAdvisor class')}&duration=45&location=${encodeURIComponent(form.location || '')}`}
              >
                Download .ics (add to calendar)
              </a>
            ) : null}
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
          </div>

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
