'use client';

import { useMemo, useState } from 'react';
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
import { sessionRosterNames } from '@/lib/fitness/class-allocate';
import { ProgrammeView } from '@/components/fitness/ProgrammeView';
import {
  hydrateProgramme,
  resolveProgrammeForSession,
} from '@/lib/fitness/movements';
import {
  SESSION_KIND_OPTIONS,
  SYS_COACH_TIME_CODE,
  SYS_PT_CODE,
  durationFromStartEnd,
  endFromStartDuration,
  patchFormForSessionKind,
  resolveSessionTimes,
  sessionKindFromRecord,
  sessionKindLabel,
  sessionKindTone,
  type FitSessionKind,
} from '@/lib/fitness/session-times';
import { storeUsesClassSubscribe } from '@/lib/fitness/vuka-class-catalog';
import {
  PracticeScheduleCalendar,
  type DiaryScope,
  type ScheduleEvent,
} from '@/components/schedule/PracticeScheduleCalendar';
import { WorkingHoursEditor } from '@/components/schedule/WorkingHoursEditor';
import { PracticeProfilePdfButton } from '@/components/schedule/PracticeProfilePdfButton';
import { ScheduleEventPeek } from '@/components/schedule/ScheduleEventPeek';
import {
  RecurrenceFields,
  emptyRecurrenceForm,
  recurrenceApiPayload,
  validateRecurrenceForm,
  type RecurrenceFormValue,
} from '@/components/schedule/RecurrenceFields';
import { normalizeWorkingHours } from '@/lib/schedule/working-hours';

export default function CalendarPage() {
  const { companyId, store, loading, saving, post, summary } = useFitgraph();
  const classSubscribe = store ? storeUsesClassSubscribe(store) : false;
  const classCatalogueHref = classSubscribe
    ? '/dashboard/fitgraph/memberships'
    : '/dashboard/fitgraph/classes';
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [editorOpen, setEditorOpen] = useState(false);
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
    session_kind: 'class' as FitSessionKind,
    class_type_id: '',
    coach_id: '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '06:00',
    end_time: '06:45',
    location: 'Studio A',
    room: '',
    capacity: '',
    public: true,
    public_notes: '',
    class_plan: '',
    notes: '',
    status: 'scheduled',
    programme_id: '',
  });
  const [recurrence, setRecurrence] = useState<RecurrenceFormValue>(
    emptyRecurrenceForm
  );

  const blankCreateForm = () => ({
    session_kind: 'class' as FitSessionKind,
    class_type_id: '',
    coach_id: personFilter || '',
    date: day,
    start_time: '06:00',
    end_time: '06:45',
    location: 'Studio A',
    room: '',
    capacity: '',
    public: true,
    public_notes: '',
    class_plan: '',
    notes: '',
    status: 'scheduled',
    programme_id: '',
  });

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
    const kind = sessionKindFromRecord({
      session_kind: s.session_kind,
      class_code: store?.class_types.find((c) => c.id === s.class_type_id)
        ?.code,
    });
    const times = resolveSessionTimes({
      start_time: String(s.start_time || '06:00').slice(0, 5),
      end_time: s.end_time,
      duration_min: s.duration_min,
      fallbackDuration: kind === 'class' ? 45 : 60,
    });
    setForm({
      session_kind: kind,
      class_type_id: s.class_type_id || '',
      coach_id: s.coach_id || '',
      date: s.date,
      start_time: times.start_time,
      end_time: times.end_time,
      location: s.location || '',
      room: s.room || '',
      capacity: s.capacity != null ? String(s.capacity) : '',
      public: kind === 'class' && s.public === true,
      public_notes: s.public_notes || '',
      class_plan: s.class_plan || '',
      notes: s.notes || '',
      status: s.status || 'scheduled',
      programme_id: s.programme_id || '',
    });
    setRecurrence(emptyRecurrenceForm());
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setSelectedSessionId(null);
    setSlotPicked(null);
    setAddMemberIds([]);
    setMemberQuery('');
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
    const start = partial?.start_time || '06:00';
    setForm({
      ...blankCreateForm(),
      date: d,
      start_time: start,
      end_time: endFromStartDuration(start, 45),
      coach_id: partial?.coach_id || personFilter || '',
    });
    if (partial?.date && partial?.start_time) {
      setSlotPicked(`${partial.date} · ${partial.start_time.slice(0, 5)}`);
    } else {
      setSlotPicked(`${d} · ${(partial?.start_time || '06:00').slice(0, 5)}`);
    }
    setEditorOpen(true);
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
        const kind = sessionKindFromRecord({
          session_kind: s.session_kind,
          class_code: ct?.code,
        });
        const times = resolveSessionTimes({
          start_time: s.start_time,
          end_time: s.end_time,
          duration_min: s.duration_min,
          fallbackDuration: ct?.default_duration_min ?? 45,
        });
        const noteTitle = (s.notes || '').split('\n')[0]?.trim();
        const title =
          kind === 'coach_personal'
            ? noteTitle || 'Coach personal'
            : kind === 'private_pt'
              ? `PT · ${ct?.name || 'Personal training'}`
              : ct?.name || 'Class';
        const names = sessionRosterNames(store, s.id);
        const namePreview =
          names.length === 0
            ? `${booked}${cap ? `/${cap}` : ''} booked`
            : names.length <= 3
              ? names.join(', ')
              : `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
        return {
          id: s.id,
          date: s.date,
          start_time: times.start_time,
          end_time: times.end_time,
          duration_min: times.duration_min,
          title,
          subtitle: s.location || undefined,
          person_id: s.coach_id || null,
          person_name: coach?.name,
          status: s.status,
          public: s.public === true,
          meta:
            kind === 'coach_personal'
              ? `Personal block${s.room ? ` · ${s.room}` : ''}`
              : [namePreview, s.room, s.public ? 'public' : '']
                  .filter(Boolean)
                  .join(' · '),
          tone: sessionKindTone(kind),
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
    toast.message('New calendar slot', {
      description: `${slot.date} at ${slot.start_time.slice(0, 5)} — pick class, private PT, or personal time`,
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
      closeEditor();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete class');
    }
  };

  /** Save edits to the open class (view/edit mode). Supports series “this & future”. */
  const saveSelected = async (editScope: 'one' | 'future' = 'one') => {
    if (!selectedSessionId || !store) return;
    const prev = store.sessions.find((x) => x.id === selectedSessionId);
    if (!prev) {
      toast.error('Class not found');
      return;
    }
    if (form.session_kind === 'class' && !form.class_type_id) {
      toast.error('Select a class type');
      return;
    }
    if (form.session_kind !== 'class' && !form.coach_id) {
      toast.error('Pick a coach for private PT or personal time');
      return;
    }
    if (!form.date || !form.start_time) {
      toast.error('Set date and start time');
      return;
    }
    const { resolveSeriesEditIds, applySeriesPatch } = await import(
      '@/lib/services/advisor-series-edit'
    );
    const scope =
      editScope === 'future' && prev.series_id
        ? ('future' as const)
        : ('one' as const);
    const ids = resolveSeriesEditIds(
      store.sessions.map((s) => ({
        id: s.id,
        date: s.date,
        series_id: s.series_id,
      })),
      prev.id,
      scope
    );
    const times = resolveSessionTimes({
      start_time: form.start_time,
      end_time: form.end_time,
    });
    const patch = {
      start_time: times.start_time,
      end_time: times.end_time,
      duration_min: times.duration_min,
      location: form.location || undefined,
      capacity: form.capacity ? Number(form.capacity) : null,
      class_type_id: form.class_type_id,
      session_kind: form.session_kind,
      public: form.session_kind === 'class' && form.public,
      public_notes: form.public_notes || undefined,
      class_plan: form.class_plan || undefined,
      notes: form.notes || undefined,
      status: form.status || prev.status || 'scheduled',
      programme_id: form.programme_id || null,
    };
    for (const id of ids) {
      const row = store.sessions.find((s) => s.id === id);
      if (!row) continue;
      const isAnchor = id === prev.id;
      const next = applySeriesPatch(row, patch, {
        isAnchor,
        newDate: isAnchor ? form.date : undefined,
      });
      await post({
        entity: 'sessions',
        action: 'upsert',
        record: {
          ...next,
          coach_id: isAnchor ? form.coach_id || null : row.coach_id,
          room: isAnchor ? form.room || null : row.room,
        },
      });
    }
    setDay(form.date);
    toast.success(
      scope === 'future'
        ? `Updated ${ids.length} sessions (this & future)`
        : `${sessionKindLabel(form.session_kind)} updated`
    );
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
    if (form.session_kind === 'class' && !form.class_type_id) {
      toast.error('Select a class type first (Classes catalogue)');
      return;
    }
    if (form.session_kind !== 'class' && !form.coach_id) {
      toast.error('Pick a coach for private PT or personal time');
      return;
    }
    if (!form.date || !form.start_time) {
      toast.error('Set date, start time and end time');
      return;
    }
    const createTimes = resolveSessionTimes({
      start_time: form.start_time,
      end_time: form.end_time,
    });
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
        session_kind: form.session_kind,
        date: form.date,
        start_time: createTimes.start_time,
        end_time: createTimes.end_time,
        duration_min: createTimes.duration_min,
        location: form.location || undefined,
        room: form.room || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        public: form.session_kind === 'class' && form.public,
        public_notes: form.public_notes || undefined,
        class_plan: form.class_plan.trim() || undefined,
        notes: form.notes.trim() || undefined,
        programme_id: form.programme_id || null,
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
        session_kind: form.session_kind,
        coach_id: form.coach_id || null,
        date: form.date,
        start_time: createTimes.start_time,
        end_time: createTimes.end_time,
        duration_min: createTimes.duration_min,
        location: form.location,
        room: form.room || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        public: form.session_kind === 'class' && form.public,
        public_notes: form.public_notes || undefined,
        class_plan: form.class_plan.trim() || undefined,
        notes: form.notes.trim() || undefined,
        origin: 'owner',
        programme_id: form.programme_id || null,
      },
    });
    toast.success(
      form.session_kind === 'coach_personal'
        ? 'Personal time blocked on the calendar'
        : form.session_kind === 'private_pt'
          ? 'Private PT booked — add the member in this window'
          : form.coach_id
            ? form.public
              ? 'Class created with coach · published'
              : 'Class created with coach — add members in this window'
            : 'Class created — next: assign a coach, then add members'
    );
    setSlotPicked(null);
    setDay(form.date);
    // Reload form from server store happens via post(); open by id after brief tick
    setSelectedSessionId(sessionId);
    setAddMemberIds([]);
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
      description="Main gym calendar: expand to fill the screen, step months, and click a class or block to edit it. Click empty time to add a class, private PT, or a coach’s own training. Multiple coaches can run at the same time."
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
            accentClass="border-yellow-200 dark:border-yellow-800"
          />

          <div className="flex flex-wrap items-center gap-2 -mt-2">
            <PracticeProfilePdfButton
              companyId={companyId}
              module="fitgraph"
              label="Download gym practice PDF"
            />
            <span className="text-[11px] text-slate-500">
              Full practice sheet (hours, coaches, classes). Calendar PDFs are on
              the grid · A4 PDF.
            </span>
          </div>

          <PracticeScheduleCalendar
            title="Class schedule"
            printBrand={
              store.settings?.brand_name || 'GymAdvisor · SupplierAdvisor'
            }
            pdfExport={{
              companyId: companyId || '',
              module: 'fitgraph',
              personId: personFilter || null,
            }}
            accent="yellow"
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
            emptyLabel="No sessions"
            slotHint="Click empty time to add a class, PT, or personal block"
            selectedEventId={selectedSessionId}
            onSelectDate={(date) => {
              setDay(date);
              setForm((f) => ({ ...f, date }));
            }}
            onSelectSlot={pickSlot}
            onSelectEvent={(ev) => {
              openSession(ev.id);
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 -mt-2">
            <p className="text-xs text-slate-500">
              Click a class or personal block to edit it. Expand the calendar to
              fill the screen. Use the month name to jump months.
            </p>
            <button
              type="button"
              className="rounded-xl border border-yellow-300 bg-white px-3 py-2 text-xs font-bold text-yellow-800 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-100"
              onClick={() => startCreateMode({ date: day })}
            >
              + Class / PT / block
            </button>
          </div>

          <ScheduleEventPeek
            open={editorOpen}
            title={
              selectedSessionId
                ? `${sessionKindLabel(form.session_kind)} · ${form.date} ${form.start_time}${form.end_time ? `–${form.end_time}` : ''}`
                : slotPicked
                  ? `New session · ${slotPicked}`
                  : 'New session'
            }
            subtitle={
              selectedSessionId
                ? form.session_kind === 'coach_personal'
                  ? 'Coach’s own training or blocked diary time'
                  : 'Edit details, coach and members here'
                : 'Group class, private PT, or coach personal time'
            }
            onClose={closeEditor}
          >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="grid flex-1 min-w-[240px] grid-cols-3 gap-2 text-center text-[11px] font-bold">
              {[
                {
                  n: '1',
                  t: selectedSessionId ? 'View / edit' : 'Create',
                  d: selectedSessionId ? 'Details · time' : 'Kind · when · room',
                },
                { n: '2', t: 'Assign coach', d: 'Required for PT / block' },
                { n: '3', t: 'Add members', d: 'Classes & PT only' },
              ].map((s) => (
                <div
                  key={s.n}
                  className={`rounded-2xl border px-2 py-2 ${
                    selectedSessionId
                      ? 'border-yellow-400 bg-yellow-50 text-yellow-900 dark:border-yellow-500 dark:bg-yellow-950 dark:text-yellow-100'
                      : s.n === '1'
                        ? 'border-yellow-400 bg-yellow-50 text-yellow-900 dark:border-yellow-500 dark:bg-yellow-950 dark:text-yellow-100'
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
                  className="rounded-xl border border-yellow-300 bg-white px-3 py-2 text-xs font-bold text-yellow-800 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-100"
                  onClick={() => startCreateMode({ date: day })}
                >
                  + New session
                </button>
                {store?.sessions.find((s) => s.id === selectedSessionId)
                  ?.series_id ? (
                  <button
                    type="button"
                    disabled={saving}
                    className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-50 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100"
                    onClick={() => void saveSelected('future')}
                  >
                    Save this &amp; future
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={saving}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200"
                  onClick={() => void deleteSelected()}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
          <FormCard
            tone="owner"
            title={
              selectedSessionId
                ? `${sessionKindLabel(form.session_kind)} · ${form.date} ${form.start_time}${form.end_time ? `–${form.end_time}` : ''}`
                : slotPicked
                  ? `Create session · ${slotPicked}`
                  : 'Create session'
            }
            description={
              selectedSessionId
                ? 'Edit details here, then Save — or Delete above. Coach is on this form; members are listed under the save button (not for personal blocks).'
                : undefined
            }
            onSubmit={() => void add()}
            saving={saving}
            submitLabel={
              selectedSessionId
                ? 'Save changes'
                : recurrence.frequency !== 'none'
                  ? form.session_kind === 'coach_personal'
                    ? 'Block repeating personal time'
                    : form.session_kind === 'private_pt'
                      ? 'Create PT series'
                      : 'Create class series'
                  : form.session_kind === 'coach_personal'
                    ? 'Block personal time'
                    : form.session_kind === 'private_pt'
                      ? 'Book private PT'
                      : 'Create class'
            }
          >
            {selectedSessionId ? (
              <p className="sm:col-span-2 lg:col-span-3 text-xs text-yellow-700 dark:text-yellow-300 font-medium rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50/80 dark:bg-yellow-950/40 px-3 py-2">
                Viewing / editing this class. Change fields and <strong>Save changes</strong>,
                use <strong>Delete class</strong> to remove it from the calendar
                (series can delete one date or all), or assign coach and members on the
                this window. Click empty calendar time for a new class.
              </p>
            ) : slotPicked ? (
              <p className="sm:col-span-2 lg:col-span-3 text-xs text-yellow-700 dark:text-yellow-300 font-medium rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50/80 dark:bg-yellow-950/40 px-3 py-2">
                Slot from calendar: <strong>{slotPicked}</strong>. Choose a{' '}
                <strong>class type</strong> (add types under Classes first),
                save the class, then assign coach and members on the open card.
              </p>
            ) : (
              <p className="sm:col-span-2 lg:col-span-3 text-xs text-slate-500">
                <strong>Click a class</strong> on the calendar to open it, or click empty
                time to create. Catalogue first under{' '}
                {classSubscribe ? 'Classes' : 'Class types'} if needed.
                {!store.class_types.length ? (
                  <>
                    {' '}
                    No classes yet —{' '}
                    <Link
                      href={classCatalogueHref}
                      className="font-bold text-yellow-700 underline"
                    >
                      add {classSubscribe ? 'a class' : 'class types'}
                    </Link>{' '}
                    first.
                  </>
                ) : null}
              </p>
            )}
            <select
              className={fc()}
              value={form.session_kind}
              onChange={(e) =>
                setForm((f) =>
                  patchFormForSessionKind(
                    f,
                    e.target.value as FitSessionKind,
                    store.class_types
                  )
                )
              }
            >
              {SESSION_KIND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {form.session_kind !== 'coach_personal' ? (
              <select
                className={fc()}
                value={form.class_type_id}
                onChange={(e) => {
                  const ct = store.class_types.find(
                    (c) => c.id === e.target.value
                  );
                  const inferred = sessionKindFromRecord({
                    class_code: ct?.code,
                  });
                  setForm((f) => {
                    if (inferred !== 'class' && inferred !== f.session_kind) {
                      return {
                        ...patchFormForSessionKind(
                          f,
                          inferred,
                          store.class_types
                        ),
                        class_type_id: e.target.value,
                      };
                    }
                    return { ...f, class_type_id: e.target.value };
                  });
                }}
              >
                <option value="">
                  {form.session_kind === 'private_pt'
                    ? 'PT type (optional)…'
                    : 'Class type (required)…'}
                </option>
                {store.class_types
                  .filter((c) =>
                    c.active !== false &&
                    (form.session_kind === 'private_pt'
                      ? c.code !== SYS_COACH_TIME_CODE
                      : c.code !== SYS_PT_CODE && c.code !== SYS_COACH_TIME_CODE)
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            ) : (
              <p className="text-xs text-slate-500 px-1 self-center">
                Blocks the coach’s diary — not member-bookable.
              </p>
            )}
            <select
              className={fc()}
              value={form.coach_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, coach_id: e.target.value }))
              }
            >
              <option value="">
                {form.session_kind === 'class'
                  ? 'Coach (optional now — step 2)…'
                  : 'Coach (required)…'}
              </option>
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
            <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
              Start
              <input
                className={fc()}
                type="time"
                value={form.start_time}
                onChange={(e) =>
                  setForm((f) => {
                    const next = e.target.value;
                    const dur = f.end_time
                      ? durationFromStartEnd(f.start_time, f.end_time)
                      : 45;
                    return {
                      ...f,
                      start_time: next,
                      end_time: endFromStartDuration(next, dur),
                    };
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
              End
              <input
                className={fc()}
                type="time"
                value={form.end_time}
                onChange={(e) =>
                  setForm((f) => ({ ...f, end_time: e.target.value }))
                }
              />
            </label>
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
            {form.session_kind !== 'coach_personal' ? (
              <input
                className={fc()}
                type="number"
                placeholder="Capacity override"
                value={form.capacity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, capacity: e.target.value }))
                }
              />
            ) : null}
            {form.session_kind === 'coach_personal' ? (
              <textarea
                className={fc() + ' min-h-[4rem] resize-y sm:col-span-2'}
                placeholder="What this time is for (private — own training, admin, errands…)"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            ) : (
              <textarea
                className={fc() + ' min-h-[4rem] resize-y sm:col-span-2'}
                placeholder="Class plan / activities (members see this)"
                value={form.class_plan}
                onChange={(e) =>
                  setForm((f) => ({ ...f, class_plan: e.target.value }))
                }
              />
            )}
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
                accent="yellow"
                unitLabel={
                  form.session_kind === 'coach_personal'
                    ? 'blocks'
                    : form.session_kind === 'private_pt'
                      ? 'sessions'
                      : 'classes'
                }
              />
            ) : null}
            {!selectedSessionId ? (
            <p className="sm:col-span-2 lg:col-span-3 text-[11px] text-slate-500 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-3 py-2">
              <strong>After create:</strong>{' '}
              {form.session_kind === 'coach_personal'
                ? 'personal time is blocked on the coach diary. Members cannot book it.'
                : form.session_kind === 'private_pt'
                  ? 'the PT session opens so you can add the member.'
                  : 'the class opens automatically so you can assign a coach and add members. Coach can stay blank until later.'}
            </p>
            ) : null}
            {form.date && form.start_time ? (
              <a
                className="sm:col-span-2 text-xs font-bold text-yellow-700 underline"
                href={`/api/public/advisor/ics?module=fitgraph&date=${encodeURIComponent(form.date)}&start=${encodeURIComponent(form.start_time)}&title=${encodeURIComponent(
                  form.session_kind === 'coach_personal'
                    ? form.notes.split('\n')[0] || 'Coach personal time'
                    : form.session_kind === 'private_pt'
                      ? 'Private PT'
                      : 'GymAdvisor class'
                )}&duration=${durationFromStartEnd(form.start_time, form.end_time || endFromStartDuration(form.start_time, 45))}&location=${encodeURIComponent(form.location || '')}`}
              >
                Download .ics (add to calendar)
              </a>
            ) : null}
            <select
              className={fc()}
              value={form.programme_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, programme_id: e.target.value }))
              }
            >
              <option value="">Programme (optional)…</option>
              {(store.programmes || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {form.session_kind === 'class' ? (
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
            ) : (
              <p className="sm:col-span-2 text-[11px] text-slate-500">
                {form.session_kind === 'private_pt'
                  ? 'Private PT stays off the public website. Add the member after saving.'
                  : 'Personal time stays private on the coach diary. Members cannot book it.'}
              </p>
            )}
          </FormCard>
          {store && (form.programme_id || selectedSessionId)
            ? (() => {
                const s = selectedSessionId
                  ? store.sessions.find((x) => x.id === selectedSessionId)
                  : null;
                const found =
                  (form.programme_id &&
                    (store.programmes || []).find(
                      (p) => p.id === form.programme_id
                    )) ||
                  (s
                    ? resolveProgrammeForSession(store.programmes || [], {
                        id: s.id,
                        class_type_id: s.class_type_id,
                        coach_id: s.coach_id,
                        session_kind: s.session_kind,
                        programme_id: s.programme_id,
                      })
                    : null);
                if (!found) return null;
                return (
                  <ProgrammeView
                    programme={hydrateProgramme(found, store.movements || [])}
                  />
                );
              })()
            : null}
          {selectedSessionId && store && form.session_kind !== 'coach_personal' ? (
            <div className="mt-4 space-y-3">
              {(() => {
                const s = store.sessions.find((x) => x.id === selectedSessionId);
                if (!s) return null;
                const booked = sessionBookingCount(store, s.id);
                const roster = store.bookings.filter(
                  (b) =>
                    b.session_id === s.id && b.status !== 'cancelled'
                );
                return (
                  <div className="rounded-xl border border-sky-200 bg-sky-50/50 px-3 py-2 space-y-2 dark:border-sky-800 dark:bg-sky-950/30">
                    <p className="text-[10px] font-black uppercase tracking-wide text-sky-800 dark:text-sky-200">
                      Members on this class
                      {addMemberIds.length
                        ? ` · ${addMemberIds.length} selected`
                        : ` · ${booked} booked`}
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
                              b.family_member_name || cl?.name || b.client_id
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
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-sky-100 bg-white divide-y divide-slate-100 dark:border-sky-900 dark:bg-slate-950 dark:divide-slate-800">
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
                              <span className="font-semibold">{c.name}</span>
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
                    <p className="text-[11px] text-slate-500">
                      Gym invoices are monthly memberships, not per class.{' '}
                      <Link
                        href="/dashboard/fitgraph/accounts"
                        className="font-bold text-yellow-800 underline"
                      >
                        Send this month’s invoices
                      </Link>
                    </p>
                  </div>
                );
              })()}
            </div>
          ) : null}
          </ScheduleEventPeek>

          <p className="text-xs text-slate-500">
            <strong>Click any session</strong> on the calendar to open it.
            Private PT and coach personal time use start and end times. Join
            links work for classes and PT.{' '}
            <Link
              href={classCatalogueHref}
              className="font-bold text-yellow-700 underline"
            >
              {classSubscribe ? 'Classes' : 'Class types'}
            </Link>{' '}
            ·{' '}
            <Link
              href="/dashboard/fitgraph/coach-calendar"
              className="font-bold text-yellow-700 underline"
            >
              Coach calendar
            </Link>{' '}
            ·{' '}
            <Link
              href="/dashboard/fitgraph/bookings"
              className="font-bold text-yellow-700 underline"
            >
              Desk · bookings
            </Link>
            .
          </p>

          <div className="space-y-2">
            <h3 className="text-sm font-black text-slate-800 dark:text-yellow-100">
              Sessions on {day}
              {selectedSessionId ? ' · open session highlighted' : ''}
            </h3>
            {daySessions.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-2xl">
                Nothing on {day}. Click empty calendar time to add a class, PT,
                or personal block.
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
                const kind = sessionKindFromRecord({
                  session_kind: s.session_kind,
                  class_code: ct?.code,
                });
                const times = resolveSessionTimes({
                  start_time: s.start_time,
                  end_time: s.end_time,
                  duration_min: s.duration_min,
                });
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
                          className="inline-flex items-center gap-1 text-xs font-bold text-yellow-700 dark:text-yellow-300"
                          onClick={() => {
                            if (managing) {
                              closeEditor();
                            } else {
                              openSession(s.id);
                            }
                          }}
                        >
                          {managing ? 'Close' : 'Open'}
                        </button>
                        {kind !== 'coach_personal' ? (
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
                        ) : null}
                        {kind !== 'coach_personal' ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-bold text-yellow-700 dark:text-yellow-300"
                            onClick={() => void copyInvite(s.id)}
                            title="Copy B2C join link for members"
                          >
                            <Share2 className="w-3.5 h-3.5" /> Join link
                          </button>
                        ) : null}
                        {kind === 'class' ? (
                          <button
                            type="button"
                            className={`text-xs font-bold ${toneLinkClass('owner')}`}
                            onClick={() => void togglePublic(s.id, !s.public)}
                          >
                            {s.public ? 'Unpublish' : 'Publish'}
                          </button>
                        ) : null}
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
                      <div className="font-bold text-sm text-slate-900 dark:text-yellow-50">
                        {times.start_time}–{times.end_time} ·{' '}
                        {kind === 'coach_personal'
                          ? s.notes?.split('\n')[0] || 'Coach personal'
                          : ct?.name || sessionKindLabel(kind)}
                        <span className="ml-2 text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded dark:text-slate-300 dark:bg-slate-800">
                          {sessionKindLabel(kind)}
                        </span>
                        {kind === 'class' && s.public ? (
                          <span className="ml-2 text-[10px] font-black uppercase text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded dark:text-yellow-100 dark:bg-yellow-800">
                            Public
                          </span>
                        ) : kind !== 'coach_personal' ? (
                          <span className="ml-2 text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded dark:text-neutral-400 dark:bg-neutral-800">
                            Invite
                          </span>
                        ) : null}
                        {s.series_id ? (
                          <span className="ml-1 text-[10px] font-black uppercase text-amber-700">
                            series
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-yellow-200/80">
                        {s.location || s.room || '—'} · {booked}/{cap} booked
                        {!coach ? (
                          <span className="ml-1 font-bold text-amber-700 dark:text-amber-300">
                            · needs coach
                          </span>
                        ) : null}
                      </div>
                      {s.class_plan ? (
                        <p className="text-[11px] text-yellow-800 dark:text-yellow-200 whitespace-pre-wrap line-clamp-3">
                          {s.class_plan}
                        </p>
                      ) : null}

                      {/* Step 2 — assign coach */}
                      <div className="rounded-xl border border-yellow-100 dark:border-yellow-800 bg-yellow-50/40 dark:bg-yellow-950/30 px-3 py-2 space-y-1.5">
                        <p className="text-[10px] font-black uppercase tracking-wide text-yellow-700 dark:text-yellow-300">
                          Step 2 · Assign coach
                        </p>
                        <select
                          className="w-full rounded-lg border border-slate-200 text-xs px-2 py-2 dark:border-yellow-500/40 dark:bg-yellow-950 dark:text-yellow-50"
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
                      {kind === 'coach_personal' ? (
                        <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                          Personal block — members cannot book this slot.
                        </p>
                      ) : managing ? (
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
                    `${s.start_time}${s.end_time ? `–${s.end_time}` : ''}`,
                    `${ct?.name || '—'}${
                      s.session_kind && s.session_kind !== 'class'
                        ? ` · ${sessionKindLabel(s.session_kind)}`
                        : ''
                    }`,
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
