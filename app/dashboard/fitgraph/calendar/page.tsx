'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Link2, Share2 } from 'lucide-react';
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
import {
  RecurrenceFields,
  emptyRecurrenceForm,
  recurrenceApiPayload,
  validateRecurrenceForm,
  type RecurrenceFormValue,
} from '@/components/schedule/RecurrenceFields';
import { normalizeWorkingHours } from '@/lib/schedule/working-hours';

export default function CalendarPage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const formAnchorRef = useRef<HTMLDivElement>(null);
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [personFilter, setPersonFilter] = useState('');
  const [diaryScope, setDiaryScope] = useState<DiaryScope>('practice');
  const [slotPicked, setSlotPicked] = useState<string | null>(null);
  /**
   * Selected class on the main gym calendar — open for view/edit, coach, members.
   * null = create mode (new class).
   */
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [addMemberIds, setAddMemberIds] = useState<string[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
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
    status: 'scheduled',
  });
  const [recurrence, setRecurrence] = useState<RecurrenceFormValue>(
    emptyRecurrenceForm
  );

  const blankCreateForm = () => ({
    class_type_id: '',
    coach_id: personFilter || '',
    date: day,
    start_time: '06:00',
    location: 'Studio A',
    room: '',
    capacity: '',
    public: true,
    public_notes: '',
    class_plan: '',
    status: 'scheduled',
  });

  const scrollToForm = () => {
    requestAnimationFrame(() => {
      formAnchorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  /** Open an existing class from the calendar grid for view / edit. */
  const openSession = (sessionId: string) => {
    const s = store?.sessions.find((x) => x.id === sessionId);
    if (!s) {
      toast.error('Class not found');
      return;
    }
    setSelectedSessionId(s.id);
    setDay(s.date);
    setSlotPicked(null);
    setAddMemberIds([]);
    setMemberQuery('');
    setForm({
      class_type_id: s.class_type_id || '',
      coach_id: s.coach_id || '',
      date: s.date,
      start_time: String(s.start_time || '06:00').slice(0, 5),
      location: s.location || '',
      room: s.room || '',
      capacity: s.capacity != null ? String(s.capacity) : '',
      public: s.public === true,
      public_notes: s.public_notes || '',
      class_plan: s.class_plan || '',
      status: s.status || 'scheduled',
    });
    setRecurrence(emptyRecurrenceForm());
    scrollToForm();
  };

  const startCreateMode = (partial?: {
    date?: string;
    start_time?: string;
    coach_id?: string;
  }) => {
    setSelectedSessionId(null);
    setAddMemberIds([]);
    setMemberQuery('');
    setRecurrence(emptyRecurrenceForm());
    const d = partial?.date || day;
    setDay(d);
    setForm({
      ...blankCreateForm(),
      date: d,
      start_time: partial?.start_time || '06:00',
      coach_id: partial?.coach_id || personFilter || '',
    });
    if (partial?.date && partial?.start_time) {
      setSlotPicked(`${partial.date} · ${partial.start_time.slice(0, 5)}`);
    } else {
      setSlotPicked(null);
    }
    scrollToForm();
  };

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
    startCreateMode({
      date: slot.date,
      start_time: slot.start_time.slice(0, 5),
      coach_id: slot.person_id || personFilter || '',
    });
    toast.message('New class slot', {
      description: `${slot.date} at ${slot.start_time.slice(0, 5)} — finish details below, or click an existing class to open it`,
    });
  };

  const bookMembersOntoSession = async (
    sessionId: string,
    clientIds: string[]
  ) => {
    if (!clientIds.length || !sessionId) return 0;
    let n = 0;
    for (const clientId of clientIds) {
      await post({
        entity: 'bookings',
        action: 'upsert',
        record: {
          session_id: sessionId,
          client_id: clientId,
          status: 'booked',
          source: 'desk',
        },
      });
      n += 1;
    }
    return n;
  };

  /** Remove the open class from the calendar (optionally whole series). */
  const deleteSelected = async () => {
    if (!selectedSessionId || !store) return;
    const prev = store.sessions.find((x) => x.id === selectedSessionId);
    if (!prev) {
      toast.error('Class not found');
      return;
    }
    const seriesCount = prev.series_id
      ? store.sessions.filter((s) => s.series_id === prev.series_id).length
      : 0;
    if (
      !confirm(
        seriesCount > 1
          ? `Delete this class on ${prev.date} at ${String(prev.start_time).slice(0, 5)}? Bookings on it will be removed.`
          : `Delete this class from the calendar? Bookings on it will be removed.`
      )
    ) {
      return;
    }
    let deleteSeries = false;
    if (seriesCount > 1) {
      deleteSeries = confirm(
        `This class is part of a series (${seriesCount} classes). OK = delete the entire series, Cancel = delete only this date.`
      );
    }
    try {
      const data = await post({
        entity: 'sessions',
        action: 'delete',
        id: selectedSessionId,
        delete_series: deleteSeries,
      });
      toast.success(
        (data?.message as string) ||
          (deleteSeries ? 'Series deleted' : 'Class deleted')
      );
      setSelectedSessionId(null);
      setAddMemberIds([]);
      startCreateMode({ date: prev.date });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete class');
    }
  };

  /** Save edits to the open class (view/edit mode). */
  const saveSelected = async () => {
    if (!selectedSessionId || !store) return;
    const prev = store.sessions.find((x) => x.id === selectedSessionId);
    if (!prev) {
      toast.error('Class not found');
      return;
    }
    if (!form.class_type_id) {
      toast.error('Select a class type');
      return;
    }
    if (!form.date || !form.start_time) {
      toast.error('Set date and start time');
      return;
    }
    await post({
      entity: 'sessions',
      action: 'upsert',
      record: {
        ...prev,
        class_type_id: form.class_type_id,
        coach_id: form.coach_id || null,
        date: form.date,
        start_time: form.start_time,
        location: form.location || undefined,
        room: form.room || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        public: form.public,
        public_notes: form.public_notes || undefined,
        class_plan: form.class_plan || undefined,
        status: form.status || prev.status || 'scheduled',
      },
    });
    setDay(form.date);
    toast.success('Class updated');
  };

  /**
   * Step 1 only: create the class (type + when + room).
   * Coach and members are assigned afterwards on the class card.
   */
  const add = async () => {
    if (selectedSessionId) {
      await saveSelected();
      return;
    }
    if (!form.class_type_id) {
      toast.error('Select a class type first (Classes catalogue)');
      return;
    }
    if (!form.date || !form.start_time) {
      toast.error('Set date and start time');
      return;
    }
    if (recurrence.frequency !== 'none') {
      const recErr = validateRecurrenceForm(recurrence);
      if (recErr) {
        toast.error(recErr);
        return;
      }
      const payload = recurrenceApiPayload(recurrence, form.date);
      const data = await post({
        action: 'create_session_series',
        coach_id: form.coach_id || null,
        class_type_id: form.class_type_id,
        date: form.date,
        start_time: form.start_time,
        location: form.location || undefined,
        room: form.room || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        public: form.public,
        public_notes: form.public_notes || undefined,
        class_plan: form.class_plan.trim() || undefined,
        ...payload,
      });
      const sessions = (data.sessions || []) as Array<{ id: string }>;
      const firstId = sessions[0]?.id || null;
      toast.success(
        form.coach_id
          ? data.message || 'Series scheduled'
          : `${data.message || 'Series scheduled'} — assign a coach on each class, then add members`
      );
      setSlotPicked(null);
      if (firstId) {
        // post() refreshes store async in React — open by id + current form values
        setSelectedSessionId(firstId);
        setAddMemberIds([]);
        setDay(form.date);
        scrollToForm();
      }
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
    toast.success(
      form.coach_id
        ? form.public
          ? 'Class created with coach · published'
          : 'Class created with coach — now add members below'
        : 'Class created — next: assign a coach, then add members'
    );
    setSlotPicked(null);
    setDay(form.date);
    // Reload form from server store happens via post(); open by id after brief tick
    setSelectedSessionId(sessionId);
    setAddMemberIds([]);
    scrollToForm();
  };

  const memberChoices = useMemo(() => {
    if (!store) return [];
    const q = memberQuery.trim().toLowerCase();
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
  }, [store, memberQuery]);

  const toggleAddMember = (id: string) => {
    setAddMemberIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  };

  const saveMembersOnSession = async (sessionId: string) => {
    if (!addMemberIds.length) {
      toast.error('Select at least one member');
      return;
    }
    const n = await bookMembersOntoSession(sessionId, addMemberIds);
    toast.success(
      n === 1 ? 'Member added to class' : `${n} members added to class`
    );
    setAddMemberIds([]);
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
      titleAccent="main gym diary"
      description="Main gym calendar: click a class to open it (view/edit · coach · members). Click empty time to create. Multiple coaches can run at the same time. SA bills platform subscription only — member fees stay yours."
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
            slotHint="Click empty time to add a class · click a class to open"
            selectedEventId={selectedSessionId}
            onSelectDate={(date) => {
              setDay(date);
              setForm((f) => ({ ...f, date }));
            }}
            onSelectSlot={pickSlot}
            onSelectEvent={(ev) => {
              openSession(ev.id);
              toast.message('Class open', {
                description: `${ev.start_time.slice(0, 5)} · ${ev.title} — edit details, coach, or members below`,
              });
            }}
          />

          <div ref={formAnchorRef}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="grid flex-1 min-w-[240px] grid-cols-3 gap-2 text-center text-[11px] font-bold">
              {[
                {
                  n: '1',
                  t: selectedSessionId ? 'View / edit' : 'Create class',
                  d: selectedSessionId ? 'Details · room' : 'Type · when · room',
                },
                { n: '2', t: 'Assign coach', d: 'On the class' },
                { n: '3', t: 'Add members', d: 'On the class' },
              ].map((s) => (
                <div
                  key={s.n}
                  className={`rounded-2xl border px-2 py-2 ${
                    selectedSessionId
                      ? 'border-violet-400 bg-violet-50 text-violet-900 dark:border-violet-500 dark:bg-violet-950 dark:text-violet-100'
                      : s.n === '1'
                        ? 'border-violet-400 bg-violet-50 text-violet-900 dark:border-violet-500 dark:bg-violet-950 dark:text-violet-100'
                        : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                  }`}
                >
                  <div className="text-[10px] font-black uppercase tracking-wide opacity-70">
                    Step {s.n}
                  </div>
                  <div>{s.t}</div>
                  <div className="text-[10px] font-medium opacity-70">{s.d}</div>
                </div>
              ))}
            </div>
            {selectedSessionId ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-violet-300 bg-white px-3 py-2 text-xs font-bold text-violet-800 dark:border-violet-600 dark:bg-violet-950 dark:text-violet-100"
                  onClick={() => startCreateMode({ date: day })}
                >
                  + New class
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200"
                  onClick={() => void deleteSelected()}
                >
                  Delete class
                </button>
              </div>
            ) : null}
          </div>
          <FormCard
            tone="owner"
            title={
              selectedSessionId
                ? `Open class · ${form.date} ${form.start_time}`
                : slotPicked
                  ? `Create class · ${slotPicked}`
                  : 'Create class'
            }
            description={
              selectedSessionId
                ? 'Edit details below, then Save — or Delete class above. Coach and members are managed on the open class card.'
                : undefined
            }
            onSubmit={() => void add()}
            saving={saving}
            submitLabel={
              selectedSessionId
                ? 'Save changes'
                : recurrence.frequency !== 'none'
                  ? 'Create class series'
                  : 'Create class'
            }
          >
            {selectedSessionId ? (
              <p className="sm:col-span-2 lg:col-span-3 text-xs text-violet-700 dark:text-violet-300 font-medium rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/80 dark:bg-violet-950/40 px-3 py-2">
                Viewing / editing this class. Change fields and <strong>Save changes</strong>,
                use <strong>Delete class</strong> to remove it from the calendar
                (series can delete one date or all), or assign coach and members on the
                card below. Click empty calendar time for a new class.
              </p>
            ) : slotPicked ? (
              <p className="sm:col-span-2 lg:col-span-3 text-xs text-violet-700 dark:text-violet-300 font-medium rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/80 dark:bg-violet-950/40 px-3 py-2">
                Slot from calendar: <strong>{slotPicked}</strong>. Choose a{' '}
                <strong>class type</strong> (add types under Classes first),
                save the class, then assign coach and members on the open card.
              </p>
            ) : (
              <p className="sm:col-span-2 lg:col-span-3 text-xs text-slate-500">
                <strong>Click a class</strong> on the calendar to open it, or click empty
                time to create. Catalogue first under Classes if needed.
                {!store.class_types.length ? (
                  <>
                    {' '}
                    No class types yet —{' '}
                    <Link
                      href="/dashboard/fitgraph/classes"
                      className="font-bold text-violet-700 underline"
                    >
                      add class types
                    </Link>{' '}
                    first.
                  </>
                ) : null}
              </p>
            )}
            <select
              className={fc()}
              value={form.class_type_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, class_type_id: e.target.value }))
              }
            >
              <option value="">Class type (required)…</option>
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
              <option value="">Coach (optional now — step 2)…</option>
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
            {selectedSessionId ? (
              <select
                className={fc()}
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                <option value="scheduled">Status: scheduled</option>
                <option value="completed">Status: completed</option>
                <option value="cancelled">Status: cancelled</option>
              </select>
            ) : null}
            {!selectedSessionId ? (
              <RecurrenceFields
                value={recurrence}
                onChange={setRecurrence}
                startDate={form.date}
                inputClass={fc()}
                accent="violet"
                unitLabel="classes"
              />
            ) : null}
            {!selectedSessionId ? (
            <p className="sm:col-span-2 lg:col-span-3 text-[11px] text-slate-500 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-3 py-2">
              <strong>After create:</strong> the class opens automatically so you
              can assign a coach and add members. Coach can stay blank until later.
            </p>
            ) : null}
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
            <strong>Click any class</strong> on the calendar to open it for
            view/edit · coach · members. Join links work once a class exists.{' '}
            <Link
              href="/dashboard/fitgraph/classes"
              className="font-bold text-violet-700 underline"
            >
              Class types
            </Link>{' '}
            ·{' '}
            <Link
              href="/dashboard/fitgraph/coach-calendar"
              className="font-bold text-violet-700 underline"
            >
              Coach calendar
            </Link>{' '}
            ·{' '}
            <Link
              href="/dashboard/fitgraph/bookings"
              className="font-bold text-violet-700 underline"
            >
              Desk · bookings
            </Link>
            .
          </p>

          <div className="space-y-2">
            <h3 className="text-sm font-black text-slate-800 dark:text-violet-100">
              Classes on {day}
              {selectedSessionId ? ' · open class highlighted' : ''}
            </h3>
            {daySessions.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-2xl">
                No classes on {day}. Click empty calendar time to create one.
              </p>
            ) : (
              daySessions.map((s) => {
                const ct = store.class_types.find(
                  (c) => c.id === s.class_type_id
                );
                const coach = store.coaches.find((c) => c.id === s.coach_id);
                const booked = sessionBookingCount(store, s.id);
                const cap = s.capacity ?? ct?.capacity ?? 0;
                const managing = selectedSessionId === s.id;
                const roster = store.bookings.filter(
                  (b) =>
                    b.session_id === s.id &&
                    b.status !== 'cancelled'
                );
                return (
                  <ListRowCard
                    key={s.id}
                    tone="owner"
                    actions={
                      <>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 dark:text-violet-300"
                          onClick={() => {
                            if (managing) {
                              startCreateMode({ date: day });
                            } else {
                              openSession(s.id);
                            }
                          }}
                        >
                          {managing ? 'Close' : 'Open'}
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 dark:text-sky-300"
                          onClick={() => {
                            openSession(s.id);
                            setAddMemberIds([]);
                            setMemberQuery('');
                          }}
                        >
                          Members
                        </button>
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
                    <div className="space-y-3">
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
                        {s.location || s.room || '—'} · {booked}/{cap} booked
                        {!coach ? (
                          <span className="ml-1 font-bold text-amber-700 dark:text-amber-300">
                            · needs coach
                          </span>
                        ) : null}
                      </div>
                      {s.class_plan ? (
                        <p className="text-[11px] text-violet-800 dark:text-violet-200 whitespace-pre-wrap line-clamp-3">
                          {s.class_plan}
                        </p>
                      ) : null}

                      {/* Step 2 — assign coach */}
                      <div className="rounded-xl border border-violet-100 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/30 px-3 py-2 space-y-1.5">
                        <p className="text-[10px] font-black uppercase tracking-wide text-violet-700 dark:text-violet-300">
                          Step 2 · Assign coach
                        </p>
                        <select
                          className="w-full rounded-lg border border-slate-200 text-xs px-2 py-2 dark:border-violet-500/40 dark:bg-violet-950 dark:text-violet-50"
                          value={s.coach_id || ''}
                          onChange={(e) =>
                            void reassignCoach(s.id, e.target.value)
                          }
                        >
                          <option value="">Unassigned — pick coach…</option>
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
                      </div>

                      {/* Step 3 — members */}
                      {managing ? (
                        <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/30 px-3 py-2 space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-wide text-sky-800 dark:text-sky-200">
                            Step 3 · Add members
                            {addMemberIds.length
                              ? ` · ${addMemberIds.length} selected`
                              : ''}
                          </p>
                          {roster.length > 0 ? (
                            <p className="text-[11px] text-slate-600 dark:text-slate-300">
                              Already on class:{' '}
                              {roster
                                .map((b) => {
                                  const cl = store.clients.find(
                                    (c) => c.id === b.client_id
                                  );
                                  return (
                                    b.family_member_name ||
                                    cl?.name ||
                                    b.client_id
                                  );
                                })
                                .join(', ')}
                            </p>
                          ) : null}
                          <input
                            className={fc()}
                            placeholder="Search members…"
                            value={memberQuery}
                            onChange={(e) => setMemberQuery(e.target.value)}
                          />
                          <div className="max-h-40 overflow-y-auto rounded-lg border border-sky-100 dark:border-sky-900 bg-white dark:bg-slate-950 divide-y divide-slate-100 dark:divide-slate-800">
                            {memberChoices.map((c) => {
                              const already = roster.some(
                                (b) => b.client_id === c.id
                              );
                              const on = addMemberIds.includes(c.id);
                              return (
                                <label
                                  key={c.id}
                                  className={`flex items-start gap-2 px-2.5 py-1.5 text-sm ${
                                    already
                                      ? 'opacity-50'
                                      : 'cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-950/40'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1"
                                    disabled={already}
                                    checked={already || on}
                                    onChange={() =>
                                      !already && toggleAddMember(c.id)
                                    }
                                  />
                                  <span>
                                    <span className="font-semibold">
                                      {c.name}
                                    </span>
                                    {already ? (
                                      <span className="text-[10px] text-slate-500">
                                        {' '}
                                        · already booked
                                      </span>
                                    ) : null}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            disabled={saving || !addMemberIds.length}
                            className="rounded-xl bg-sky-600 text-white px-3 py-2 text-xs font-bold disabled:opacity-50"
                            onClick={() => void saveMembersOnSession(s.id)}
                          >
                            {addMemberIds.length
                              ? `Book ${addMemberIds.length} member(s)`
                              : 'Book selected members'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="text-[11px] font-bold text-sky-700 dark:text-sky-300 underline"
                          onClick={() => {
                            openSession(s.id);
                            setAddMemberIds([]);
                          }}
                        >
                          Step 3 · Add members ({booked} on class)
                        </button>
                      )}
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
