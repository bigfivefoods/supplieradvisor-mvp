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
  sessionRosterNames,
  sessionRosterRows,
} from '@/lib/fitness/class-allocate';
import { ClassBookedRoster } from '@/components/fitness/ClassBookedRoster';
import { ProgrammeView } from '@/components/fitness/ProgrammeView';
import {
  hydrateProgramme,
  resolveProgrammeForSession,
} from '@/lib/fitness/movements';
import { listedFitMovements } from '@/lib/fitness/movement-catalog';
import {
  SESSION_KIND_OPTIONS,
  SYS_COACH_AWAY_CODE,
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
import {
  formatAgreedRateZar,
  gymCalendarPaint,
} from '@/lib/fitness/gym-calendar-color';
import { clinicRoomNames } from '@/lib/clinic/clinic-rooms';
import type { SeriesEditScope } from '@/lib/services/advisor-series-edit';
import { AdvisorExpandablePanel } from '@/components/advisors/AdvisorExpandablePanel';
import { AdvisorWaitlistDesk } from '@/components/services/AdvisorWaitlistDesk';
import { buildDeskSlotWaitlist } from '@/lib/services/advisor-waitlist-desk';
import {
  STAFF_AWAY_REASON_OPTIONS,
  awayUntilRecurrence,
  isGymDiaryBlockKind,
  staffAwayTitle,
} from '@/lib/services/staff-away';

export default function CalendarPage() {
  const { companyId, store, loading, saving, post, summary, load } =
    useFitgraph({ library: true });
  const classSubscribe = store ? storeUsesClassSubscribe(store) : false;
  const classCatalogueHref = '/dashboard/fitgraph/classes';
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
  const [seriesScope, setSeriesScope] = useState<SeriesEditScope>('future');
  const [form, setForm] = useState({
    session_kind: 'class' as FitSessionKind,
    class_type_id: '',
    coach_id: '',
    client_id: '',
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
    personal_reason: 'leave',
    until: '',
    agreed_rate_zar: '',
  });
  const [recurrence, setRecurrence] = useState<RecurrenceFormValue>(
    emptyRecurrenceForm
  );
  const [statsOpen, setStatsOpen] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [waitlistOpen, setWaitlistOpen] = useState(true);
  const [attendOverride, setAttendOverride] = useState<
    Record<string, 'attended' | 'no_show' | 'booked'>
  >({});
  const attendPending = useRef(
    new Map<
      string,
      {
        status: 'attended' | 'no_show' | 'booked';
        client_id?: string;
        session_id?: string | null;
      }
    >()
  );
  const attendChain = useRef(Promise.resolve());
  const selectedSessionIdRef = useRef(selectedSessionId);
  selectedSessionIdRef.current = selectedSessionId;

  const blankCreateForm = () => ({
    session_kind: 'class' as FitSessionKind,
    class_type_id: '',
    coach_id: personFilter || '',
    client_id: '',
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
    personal_reason: 'leave',
    until: '',
    agreed_rate_zar: '',
  });

  /** Open an existing class from the calendar grid for view / edit. */
  const openSession = (sessionId: string) => {
    const s = store?.sessions.find((x) => x.id === sessionId);
    if (!store || !s) {
      toast.error('Class not found');
      return;
    }
    setSelectedSessionId(s.id);
    setDay(s.date);
    setSlotPicked(null);
    setAddMemberIds([]);
    setMemberQuery('');
    setSeriesScope('future');
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
      client_id:
        kind === 'private_pt'
          ? sessionRosterRows(store, s.id)[0]?.client_id || ''
          : '',
      capacity: s.capacity != null ? String(s.capacity) : '',
      public: kind === 'class' && s.public === true,
      public_notes: s.public_notes || '',
      class_plan: s.class_plan || '',
      notes: s.notes || '',
      status: s.status || 'scheduled',
      programme_id: s.programme_id || '',
      personal_reason: s.personal_reason || 'leave',
      until: '',
      agreed_rate_zar:
        s.agreed_rate_zar != null
          ? String(s.agreed_rate_zar)
          : (() => {
              const member = sessionRosterRows(store, s.id)[0];
              const cl = member
                ? store.clients.find((c) => c.id === member.client_id)
                : null;
              const r = cl?.private_rate_zar ?? cl?.agreed_rate_zar;
              return r != null ? String(r) : '';
            })(),
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
    setSeriesScope('future');
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
      .filter((s) => !store.removed_ids?.sessions?.includes(s.id))
      .map((s) => {
        const ct = store.class_types.find((c) => c.id === s.class_type_id);
        const coach = store.coaches.find((c) => c.id === s.coach_id);
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
          kind === 'away'
            ? staffAwayTitle(s.personal_reason) +
              (noteTitle ? ` · ${noteTitle}` : '')
            : kind === 'coach_personal'
              ? noteTitle || 'Coach personal'
              : kind === 'private_pt'
                ? `PT · ${ct?.name || 'Personal training'}`
                : ct?.name || 'Class';
        const names = sessionRosterNames(store, s.id);
        const namePreview =
          names.length === 0
            ? kind === 'class'
              ? 'Nobody booked'
              : ''
            : names.join(', ');
        const rateLabel =
          kind === 'private_pt'
            ? formatAgreedRateZar(
                s.agreed_rate_zar ??
                  store.clients.find((c) => names.includes(c.name))
                    ?.private_rate_zar ??
                  store.clients.find((c) =>
                    sessionRosterRows(store, s.id).some(
                      (r) => r.client_id === c.id
                    )
                  )?.private_rate_zar
              )
            : null;
        const paint = gymCalendarPaint(store, s);
        return {
          id: s.id,
          date: s.date,
          start_time: times.start_time,
          end_time: times.end_time,
          duration_min: times.duration_min,
          title,
          subtitle: [s.room, s.location].filter(Boolean).join(' · ') || undefined,
          person_id: s.coach_id || null,
          person_name:
            coach?.name ||
            (kind === 'class' || kind === 'private_pt' ? 'No coach' : undefined),
          status: s.status,
          public: s.public === true,
          meta:
            kind === 'away'
              ? staffAwayTitle(s.personal_reason)
              : kind === 'coach_personal'
                ? `Personal block${s.room ? ` · ${s.room}` : ''}`
                : [namePreview, rateLabel].filter(Boolean).join(' · '),
          tone: sessionKindTone(kind),
          color: paint.color,
          stripeColor: paint.stripeColor,
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

  const roomNames = useMemo(() => {
    const listed = clinicRoomNames(store?.settings?.rooms);
    const current = String(form.room || '').trim();
    if (current && !listed.includes(current)) return [...listed, current];
    return listed;
  }, [store?.settings?.rooms, form.room]);

  const deskSlotWaitlist = useMemo(() => {
    if (!store) return [];
    return buildDeskSlotWaitlist({
      bookings: store.bookings,
      appointments: store.sessions.map((s) => ({
        id: s.id,
        date: s.date,
        start_time: s.start_time,
        service_id: s.class_type_id,
        practitioner_id: s.coach_id,
      })),
      people: store.clients,
      services: store.class_types,
      clinicians: store.coaches,
    });
  }, [store]);

  const waitlistCount =
    store?.bookings.filter((b) => b.status === 'waitlist').length || 0;

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
    if (!clientIds.length || !sessionId) {
      return { added: 0, skipped: 0, message: 'No members added' };
    }
    const data = await post({
      action: 'add_session_members',
      session_id: sessionId,
      client_ids: clientIds,
      lite: true,
    });
    return {
      added: Number(data.added || 0),
      skipped: Number(data.skipped || 0),
      message: String(data.message || ''),
    };
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
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete class');
    }
  };

  /** Save edits to the open class (view/edit mode). Supports series scopes. */
  const saveSelected = async (editScope: SeriesEditScope = 'one') => {
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
      toast.error('Pick a coach for private PT, personal time, or away');
      return;
    }
    if (!form.date || !form.start_time) {
      toast.error('Set date and start time');
      return;
    }
    const { resolveSeriesEditIds, applySeriesPatch } = await import(
      '@/lib/services/advisor-series-edit'
    );
    const scope: SeriesEditScope =
      prev.series_id && (editScope === 'future' || editScope === 'all')
        ? editScope
        : 'one';
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
      room: form.room || null,
      coach_id: form.coach_id || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      class_type_id: form.class_type_id,
      session_kind: form.session_kind,
      personal_reason:
        form.session_kind === 'away' ? form.personal_reason : null,
      public: form.session_kind === 'class' && form.public,
      public_notes: form.public_notes || undefined,
      class_plan: form.class_plan || undefined,
      notes: form.notes || undefined,
      status: form.status || prev.status || 'scheduled',
      programme_id: form.programme_id || null,
      agreed_rate_zar:
        form.agreed_rate_zar.trim() === ''
          ? null
          : Number(form.agreed_rate_zar),
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
        record: next,
      });
    }
    if (
      form.session_kind === 'private_pt' &&
      form.client_id &&
      ids.length
    ) {
      for (const id of ids) {
        await bookMembersOntoSession(id, [form.client_id]);
      }
      const rate =
        form.agreed_rate_zar.trim() === ''
          ? null
          : Number(form.agreed_rate_zar);
      if (rate != null && Number.isFinite(rate)) {
        await post({
          entity: 'clients',
          action: 'upsert',
          record: { id: form.client_id, private_rate_zar: rate },
        });
      }
    }
    setDay(form.date);
    toast.success(
      scope === 'all'
        ? `Updated ${ids.length} sessions (entire series)`
        : scope === 'future'
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
      await saveSelected(seriesScope);
      return;
    }
    if (form.session_kind === 'class' && !form.class_type_id) {
      toast.error('Select a class type first (Classes catalogue)');
      return;
    }
    if (form.session_kind !== 'class' && !form.coach_id) {
      toast.error('Pick a coach for private PT, personal time, or away');
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
    const awayUntil = awayUntilRecurrence(form.date, form.until);
    const useSeries =
      recurrence.frequency !== 'none' ||
      (form.session_kind === 'away' && Boolean(awayUntil));
    if (useSeries) {
      const recErr =
        recurrence.frequency !== 'none'
          ? validateRecurrenceForm(recurrence)
          : null;
      if (recErr) {
        toast.error(recErr);
        return;
      }
      const payload =
        recurrence.frequency !== 'none'
          ? recurrenceApiPayload(recurrence, form.date)
          : awayUntil;
      const data = await post({
        action: 'create_session_series',
        coach_id: form.coach_id || null,
        class_type_id: form.class_type_id,
        session_kind: form.session_kind,
        personal_reason:
          form.session_kind === 'away' ? form.personal_reason : undefined,
        date: form.date,
        start_time: createTimes.start_time,
        end_time: createTimes.end_time,
        duration_min: createTimes.duration_min,
        location: form.location || undefined,
        room: form.room || undefined,
        agreed_rate_zar:
          form.agreed_rate_zar.trim() === ''
            ? null
            : Number(form.agreed_rate_zar),
        capacity: form.capacity ? Number(form.capacity) : undefined,
        public: form.session_kind === 'class' && form.public,
        public_notes: form.public_notes || undefined,
        class_plan: form.class_plan.trim() || undefined,
        notes: form.notes.trim() || undefined,
        programme_id: form.programme_id || null,
        until: form.session_kind === 'away' ? form.until || undefined : undefined,
        ...payload,
      });
      const sessions = (data.sessions || []) as Array<{ id: string }>;
      const firstId = sessions[0]?.id || null;
      if (
        form.session_kind === 'private_pt' &&
        form.client_id &&
        sessions.length
      ) {
        for (const s of sessions) {
          if (s.id) await bookMembersOntoSession(s.id, [form.client_id]);
        }
        const rate =
          form.agreed_rate_zar.trim() === ''
            ? null
            : Number(form.agreed_rate_zar);
        if (rate != null && Number.isFinite(rate)) {
          await post({
            entity: 'clients',
            action: 'upsert',
            record: { id: form.client_id, private_rate_zar: rate },
          });
        }
      }
      toast.success(
        form.session_kind === 'private_pt' && form.client_id
          ? `${data.message || 'Series scheduled'} — member booked on ${sessions.length} session${sessions.length === 1 ? '' : 's'}`
          : form.coach_id
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
        personal_reason:
          form.session_kind === 'away' ? form.personal_reason : undefined,
        coach_id: form.coach_id || null,
        date: form.date,
        start_time: createTimes.start_time,
        end_time: createTimes.end_time,
        duration_min: createTimes.duration_min,
        location: form.location,
        room: form.room || null,
        agreed_rate_zar:
          form.agreed_rate_zar.trim() === ''
            ? null
            : Number(form.agreed_rate_zar),
        capacity: form.capacity ? Number(form.capacity) : null,
        public: form.session_kind === 'class' && form.public,
        public_notes: form.public_notes || undefined,
        class_plan: form.class_plan.trim() || undefined,
        notes: form.notes.trim() || undefined,
        origin: 'owner',
        programme_id: form.programme_id || null,
      },
    });
    if (form.session_kind === 'private_pt' && form.client_id) {
      await bookMembersOntoSession(sessionId, [form.client_id]);
      const rate =
        form.agreed_rate_zar.trim() === ''
          ? null
          : Number(form.agreed_rate_zar);
      if (rate != null && Number.isFinite(rate)) {
        await post({
          entity: 'clients',
          action: 'upsert',
          record: { id: form.client_id, private_rate_zar: rate },
        });
      }
    }
    toast.success(
      form.session_kind === 'away'
        ? 'Away marked on the calendar'
        : form.session_kind === 'coach_personal'
        ? 'Personal time blocked on the calendar'
        : form.session_kind === 'private_pt'
          ? form.client_id
            ? 'Private PT booked with the member'
            : 'Private PT booked — add the member in this window'
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
    if (q.length < 2) return [];
    return (store.clients || [])
      .filter((c) => c.active !== false)
      .filter((c) => {
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
      .slice(0, 20);
  }, [store, memberQuery]);

  const rosterFor = (sessionId: string) => {
    if (!store) return [];
    return sessionRosterRows(store, sessionId).map((r) => ({
      ...r,
      status: attendOverride[r.booking_id] || r.status,
    }));
  };

  const flushAttendance = async () => {
    const marks = [...attendPending.current.entries()].map(
      ([booking_id, rec]) => ({
        booking_id,
        status: rec.status,
        client_id: rec.client_id,
        session_id: rec.session_id || selectedSessionIdRef.current,
      })
    );
    attendPending.current.clear();
    if (!marks.length) return;
    try {
      if (marks.length === 1) {
        await post(
          {
            action: 'mark_attendance',
            booking_id: marks[0].booking_id,
            status: marks[0].status,
            session_id: marks[0].session_id,
            client_id: marks[0].client_id,
            lite: true,
          },
          { quiet: true }
        );
      } else {
        await post(
          {
            action: 'mark_attendance_bulk',
            session_id: marks[0].session_id,
            marks,
            lite: true,
          },
          { quiet: true }
        );
      }
      setAttendOverride((prev) => {
        const next = { ...prev };
        for (const m of marks) {
          if (next[m.booking_id] === m.status) delete next[m.booking_id];
        }
        return next;
      });
    } catch (e) {
      setAttendOverride((prev) => {
        const next = { ...prev };
        for (const m of marks) {
          if (next[m.booking_id] === m.status) delete next[m.booking_id];
        }
        return next;
      });
      toast.error(e instanceof Error ? e.message : 'Could not update attendance');
    }
  };

  const markRoster = (
    bookingId: string,
    status: 'attended' | 'no_show' | 'booked',
    clientId?: string
  ) => {
    setAttendOverride((prev) => ({ ...prev, [bookingId]: status }));
    attendPending.current.set(bookingId, {
      status,
      client_id: clientId,
      session_id: selectedSessionIdRef.current,
    });
    attendChain.current = attendChain.current.then(() => flushAttendance());
  };

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
    const onClass = new Set(
      rosterFor(sessionId)
        .map((r) => r.client_id)
        .filter(Boolean)
    );
    const ids = addMemberIds.filter((id) => !onClass.has(id));
    if (!ids.length) {
      toast.message('Already on this class');
      setAddMemberIds([]);
      return;
    }
    const result = await bookMembersOntoSession(sessionId, ids);
    if (result.added > 0) {
      toast.success(
        result.message ||
          (result.added === 1
            ? 'Member added to class'
            : `${result.added} members added to class`)
      );
    } else {
      toast.message(result.message || 'Already on this class');
    }
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
      description="Stats, then this week’s gym diary, then waitlist, then working hours. Click a class to open it. Multiple coaches can run at the same time."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <AdvisorExpandablePanel
            title={`Today ${Number(summary?.sessionsToday) || 0} · Upcoming ${Number(summary?.sessionsUpcoming) || 0} · Waitlist ${waitlistCount} · On board ${scheduleEvents.filter((e) => e.status === 'scheduled').length}`}
            description="Diary counts for this gym. Collapse to focus on the week view."
            open={statsOpen}
            onToggle={() => setStatsOpen((v) => !v)}
            accentClass="border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/30"
            titleClass="text-yellow-950 dark:text-yellow-50"
            hintClass="text-yellow-800/80 dark:text-yellow-200/80"
          >
            <StatRow
              tone="owner"
              items={[
                {
                  label: 'Today',
                  value: Number(summary?.sessionsToday) || 0,
                },
                {
                  label: 'Upcoming',
                  value: Number(summary?.sessionsUpcoming) || 0,
                },
                {
                  label: 'Waitlist',
                  value: waitlistCount,
                },
                {
                  label: 'On board',
                  value: scheduleEvents.filter((e) => e.status === 'scheduled')
                    .length,
                },
              ]}
            />
          </AdvisorExpandablePanel>

          <AdvisorExpandablePanel
            title="Gym schedule · this week"
            description="Default is this week. Click a class to open it; click empty time to schedule a class, private PT, or personal block."
            open={calendarOpen}
            onToggle={() => setCalendarOpen((v) => !v)}
            accentClass="border-yellow-200 bg-white dark:border-yellow-800 dark:bg-neutral-950"
            titleClass="text-yellow-950 dark:text-yellow-50"
            hintClass="text-yellow-800/80 dark:text-yellow-200/80"
          >
            <PracticeScheduleCalendar
              title="Gym schedule"
              defaultView="week"
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
                toast.message('Class open', {
                  description: `${ev.start_time.slice(0, 5)} · ${ev.title} — edit in the pop-out`,
                });
              }}
            />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-black uppercase tracking-wide text-slate-500">
                  Classes
                </span>
                {(store.class_types || [])
                  .filter(
                    (c) =>
                      c.active !== false &&
                      c.code !== SYS_PT_CODE &&
                      c.code !== SYS_COACH_TIME_CODE &&
                      c.code !== SYS_COACH_AWAY_CODE
                  )
                  .slice(0, 12)
                  .map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 font-bold"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: c.color || '#E8E830',
                        }}
                      />
                      {c.name}
                    </span>
                  ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-black uppercase tracking-wide text-slate-500">
                  Coaches
                </span>
                {(store.coaches || [])
                  .filter((c) => c.active !== false && c.color)
                  .slice(0, 12)
                  .map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 font-bold"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: c.color || '#d97706' }}
                      />
                      {c.name}
                    </span>
                  ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                Class colour fills the block; coach colour is the left stripe.
                Set colours on Classes and Coaches.
              </p>
              <button
                type="button"
                className="rounded-xl border border-yellow-300 bg-white px-3 py-2 text-xs font-bold text-yellow-800 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-100"
                onClick={() => startCreateMode({ date: day })}
              >
                + Class / PT / block
              </button>
            </div>
          </AdvisorExpandablePanel>

          <AdvisorExpandablePanel
            title={`Waitlist · ${waitlistCount}`}
            description="Members waiting on a full class. Open by default."
            open={waitlistOpen}
            onToggle={() => setWaitlistOpen((v) => !v)}
            accentClass="border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/30"
            titleClass="text-yellow-950 dark:text-yellow-50"
            hintClass="text-yellow-800/80 dark:text-yellow-200/80"
          >
            <AdvisorWaitlistDesk
              queue={[]}
              slotWaitlist={deskSlotWaitlist}
              accentClass="border-yellow-200"
              embedded
              post={async (body) => {
                await post(body);
              }}
              onRefresh={() => {
                void load();
              }}
              calendarHref="/dashboard/fitgraph/calendar"
            />
            <p className="text-xs text-slate-500">
              Front desk tools:{' '}
              <Link
                href="/dashboard/fitgraph/bookings"
                className="font-bold text-yellow-700 underline"
              >
                Desk · bookings
              </Link>{' '}
              (mark attended, feedback links) · this calendar is the main diary.
            </p>
          </AdvisorExpandablePanel>

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
              Practice sheet (hours, coaches, classes). Schedule PDFs: A4 PDF on
              the calendar.
            </span>
          </div>

          <ScheduleEventPeek
            open={editorOpen}
            title={
              selectedSessionId
                ? `${sessionKindLabel(form.session_kind)} · ${form.date} ${form.start_time}${form.end_time ? `–${form.end_time}` : ''}${
                    form.coach_id
                      ? ` · ${store.coaches.find((c) => c.id === form.coach_id)?.name || 'coach'}`
                      : ' · no coach'
                  }`
                : slotPicked
                  ? `New session · ${slotPicked}`
                  : 'New session'
            }
            subtitle={
              selectedSessionId
                ? form.session_kind === 'away'
                  ? 'This person is not available — do not assign them classes'
                  : form.session_kind === 'coach_personal'
                  ? 'Coach’s own training or blocked diary time'
                  : 'Coach, time and booked members — change the coach if they can’t take this class'
                : 'Group class, private PT, personal time, or away / leave'
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
                {
                  n: '3',
                  t: 'Booked members',
                  d:
                    form.session_kind === 'private_pt'
                      ? 'Private client on this session'
                      : 'Roster for this class',
                },
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
                  <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100">
                    Series · save uses the scope below
                  </span>
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
          {selectedSessionId && !isGymDiaryBlockKind(form.session_kind) ? (
            <div className="mb-3 rounded-2xl border border-yellow-300 bg-yellow-50 px-3 py-3 dark:border-yellow-700 dark:bg-yellow-950/40">
              <p className="text-[10px] font-black uppercase tracking-wide text-yellow-800 dark:text-yellow-200">
                Coach for this session
              </p>
              <p className="text-base font-black text-slate-900 dark:text-yellow-50">
                {store.coaches.find((c) => c.id === form.coach_id)?.name ||
                  'No coach assigned'}
                {(() => {
                  const c = store.coaches.find((x) => x.id === form.coach_id);
                  if (!c) return null;
                  const unavailable =
                    c.active === false ||
                    (c.end_date && c.end_date < form.date);
                  return unavailable ? (
                    <span className="ml-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                      Not available
                    </span>
                  ) : null;
                })()}
              </p>
              <select
                className="mt-2 w-full rounded-xl border border-yellow-200 bg-white px-3 py-2 text-sm font-semibold dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-50"
                value={form.coach_id}
                onChange={(e) => {
                  const id = e.target.value;
                  setForm((f) => ({ ...f, coach_id: id }));
                  const seriesId = store.sessions.find(
                    (s) => s.id === selectedSessionId
                  )?.series_id;
                  if (!seriesId) void reassignCoach(selectedSessionId, id);
                }}
              >
                <option value="">Unassigned — pick a coach…</option>
                {store.coaches
                  .filter((c) => c.active !== false || c.id === form.coach_id)
                  .map((c) => {
                    const unavailable =
                      c.active === false ||
                      (c.end_date && c.end_date < form.date);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {unavailable ? ' · not available' : ''}
                        {(c.specialties || []).length
                          ? ` · ${(c.specialties || []).join(', ')}`
                          : ''}
                      </option>
                    );
                  })}
              </select>
              <p className="mt-1 text-[11px] text-slate-600 dark:text-yellow-100/80">
                {store.sessions.find((s) => s.id === selectedSessionId)
                  ?.series_id
                  ? 'On a series, pick the coach then Save with This and future or Entire series.'
                  : 'Change the coach if they can’t take this class. Saves as soon as you pick someone.'}
              </p>
            </div>
          ) : null}
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
                ? store?.sessions.find((s) => s.id === selectedSessionId)
                    ?.series_id
                  ? seriesScope === 'all'
                    ? 'Save entire series'
                    : seriesScope === 'future'
                      ? 'Save this & future'
                      : 'Save this date only'
                  : 'Save changes'
                : recurrence.frequency !== 'none' ||
                    (form.session_kind === 'away' && Boolean(form.until))
                  ? form.session_kind === 'away'
                    ? 'Mark away (all days)'
                    : form.session_kind === 'coach_personal'
                    ? 'Block repeating personal time'
                    : form.session_kind === 'private_pt'
                      ? 'Create PT series'
                      : 'Create class series'
                  : form.session_kind === 'away'
                    ? 'Mark away'
                    : form.session_kind === 'coach_personal'
                    ? 'Block personal time'
                    : form.session_kind === 'private_pt'
                      ? 'Book private PT'
                      : 'Create class'
            }
          >
            {selectedSessionId ? (
              <p className="sm:col-span-2 lg:col-span-3 text-xs text-yellow-700 dark:text-yellow-300 font-medium rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50/80 dark:bg-yellow-950/40 px-3 py-2">
                Viewing / editing this session. Change time, room, coach or
                member, then save. Series dates use the scope below. Delete can
                remove one date or the whole series.
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
            {form.session_kind === 'away' ? (
              <>
                <select
                  className={fc()}
                  value={form.personal_reason}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, personal_reason: e.target.value }))
                  }
                >
                  {STAFF_AWAY_REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {!selectedSessionId ? (
                  <input
                    className={fc()}
                    type="date"
                    title="Last day away (optional)"
                    value={form.until}
                    min={form.date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, until: e.target.value }))
                    }
                  />
                ) : null}
              </>
            ) : null}
            {!isGymDiaryBlockKind(form.session_kind) ? (
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
                      ? c.code !== SYS_COACH_TIME_CODE &&
                        c.code !== SYS_COACH_AWAY_CODE
                      : c.code !== SYS_PT_CODE &&
                        c.code !== SYS_COACH_TIME_CODE &&
                        c.code !== SYS_COACH_AWAY_CODE)
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
            {selectedSessionId ? null : (
            <select
              className={fc()}
              value={form.coach_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, coach_id: e.target.value }))
              }
            >
              <option value="">
                {form.session_kind === 'class'
                  ? 'Coach (optional now — assign after create)…'
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
            )}
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
            {roomNames.length > 0 ? (
              <select
                className={fc()}
                value={form.room}
                onChange={(e) =>
                  setForm((f) => ({ ...f, room: e.target.value }))
                }
                title="Room / studio from Floor → Rooms"
              >
                <option value="">Room / studio…</option>
                {roomNames.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-[11px] text-slate-500 self-center">
                No rooms yet — add them under{' '}
                <Link
                  href="/dashboard/fitgraph/rooms"
                  className="font-bold text-yellow-700 underline"
                >
                  Floor → Rooms
                </Link>
                .
              </p>
            )}
            {form.session_kind === 'private_pt' ? (
              <>
                <select
                  className={fc()}
                  value={form.client_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    const cl = store.clients.find((c) => c.id === id);
                    const rate = cl?.private_rate_zar ?? cl?.agreed_rate_zar;
                    setForm((f) => ({
                      ...f,
                      client_id: id,
                      agreed_rate_zar:
                        rate != null ? String(rate) : f.agreed_rate_zar,
                    }));
                  }}
                >
                  <option value="">Member / private client…</option>
                  {[...store.clients]
                    .sort((a, b) => {
                      const ai = a.active === false ? 1 : 0;
                      const bi = b.active === false ? 1 : 0;
                      if (ai !== bi) return ai - bi;
                      return String(a.name).localeCompare(String(b.name));
                    })
                    .map((c) => {
                      const rate =
                        c.private_rate_zar ?? c.agreed_rate_zar ?? null;
                      const tags = [
                        c.private_client ? 'PVT' : null,
                        c.membership_plan_id ? 'member' : null,
                        c.active === false ? 'inactive' : null,
                        rate != null ? formatAgreedRateZar(rate) : null,
                      ].filter(Boolean);
                      return (
                        <option key={c.id} value={c.id}>
                          {c.code} · {c.name}
                          {tags.length ? ` · ${tags.join(' · ')}` : ''}
                        </option>
                      );
                    })}
                </select>
                <input
                  className={fc()}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Agreed rate (ZAR)"
                  value={form.agreed_rate_zar}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      agreed_rate_zar: e.target.value,
                    }))
                  }
                />
              </>
            ) : null}
            {selectedSessionId &&
            store.sessions.find((s) => s.id === selectedSessionId)
              ?.series_id ? (
              <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 dark:border-amber-700 dark:bg-amber-950/40">
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  Edit series
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['one', 'This date only'],
                      ['future', 'This and future'],
                      ['all', 'Entire series'],
                    ] as Array<[SeriesEditScope, string]>
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSeriesScope(id)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-black ${
                        seriesScope === id
                          ? 'border-amber-500 bg-amber-400 text-slate-900'
                          : 'border-amber-200 bg-white text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-amber-900/80 dark:text-amber-100/80">
                  Time, room, coach
                  {form.session_kind === 'private_pt' ? ' and member' : ''} apply
                  to{' '}
                  {seriesScope === 'one'
                    ? 'this date only'
                    : seriesScope === 'future'
                      ? 'this date and later dates in the series'
                      : 'every date in the series'}
                  .
                </p>
              </div>
            ) : null}
            {!isGymDiaryBlockKind(form.session_kind) ? (
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
            {isGymDiaryBlockKind(form.session_kind) ? (
              <textarea
                className={fc() + ' min-h-[4rem] resize-y sm:col-span-2'}
                placeholder={
                  form.session_kind === 'away'
                    ? 'Optional note (leave, flight, cover coach…)'
                    : 'What this time is for (private — own training, admin, errands…)'
                }
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
            {!selectedSessionId && form.session_kind !== 'away' ? (
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
              {form.session_kind === 'away'
                ? 'this person is marked away. Do not assign them classes until they are back. Last day away is optional.'
                : form.session_kind === 'coach_personal'
                ? 'personal time is blocked on the coach diary. Members cannot book it.'
                : form.session_kind === 'private_pt'
                  ? 'pick the member and room here — a series books that member on every date.'
                  : 'the class opens automatically so you can assign a coach and add members. Coach can stay blank until later.'}
            </p>
            ) : null}
            {form.date && form.start_time ? (
              <a
                className="sm:col-span-2 text-xs font-bold text-yellow-700 underline"
                href={`/api/public/advisor/ics?module=fitgraph&date=${encodeURIComponent(form.date)}&start=${encodeURIComponent(form.start_time)}&title=${encodeURIComponent(
                  form.session_kind === 'away'
                    ? staffAwayTitle(form.personal_reason)
                    : form.session_kind === 'coach_personal'
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
                  ? 'Private PT stays off the public website. Pick the member and room on this form.'
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
                    programme={hydrateProgramme(
                      found,
                      listedFitMovements(store)
                    )}
                  />
                );
              })()
            : null}
          {selectedSessionId && store && !isGymDiaryBlockKind(form.session_kind) ? (
            <div className="mt-4 space-y-3">
              {(() => {
                const s = store.sessions.find((x) => x.id === selectedSessionId);
                if (!s) return null;
                const roster = rosterFor(s.id);
                return (
                  <>
                    <ClassBookedRoster
                      roster={roster}
                      emptyLabel={
                        form.session_kind === 'private_pt'
                          ? 'No private client on this session yet. Pick the member above or search here.'
                          : undefined
                      }
                      addQuery={memberQuery}
                      onAddQuery={setMemberQuery}
                      addChoices={memberChoices.map((c) => ({
                        id: c.id,
                        name: c.name,
                        already: roster.some((b) => b.client_id === c.id),
                      }))}
                      selectedIds={addMemberIds}
                      onToggleAdd={toggleAddMember}
                      onBook={() => void saveMembersOnSession(s.id)}
                      onMark={(id, status, clientId) => {
                        void markRoster(id, status, clientId);
                      }}
                      saving={saving}
                    />
                    <p className="text-[11px] text-slate-500">
                      Members saved to this class appear here — not the whole
                      gym.{' '}
                      <Link
                        href="/dashboard/fitgraph/accounts"
                        className="font-bold text-yellow-800 underline"
                      >
                        Send this month’s invoices
                      </Link>
                    </p>
                  </>
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
                const roster = rosterFor(s.id);
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
                        {kind === 'private_pt' &&
                        formatAgreedRateZar(
                          s.agreed_rate_zar ??
                            store.clients.find((c) =>
                              roster.some((r) => r.client_id === c.id)
                            )?.private_rate_zar
                        )
                          ? ` · ${formatAgreedRateZar(
                              s.agreed_rate_zar ??
                                store.clients.find((c) =>
                                  roster.some((r) => r.client_id === c.id)
                                )?.private_rate_zar
                            )}`
                          : ''}
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

                      {/* Step 3 — booked members only */}
                      {kind === 'coach_personal' ? (
                        <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                          Personal block — members cannot book this slot.
                        </p>
                      ) : managing ? (
                        <ClassBookedRoster
                          roster={rosterFor(s.id)}
                          addQuery={memberQuery}
                          onAddQuery={setMemberQuery}
                          addChoices={memberChoices.map((c) => ({
                            id: c.id,
                            name: c.name,
                            already: roster.some((b) => b.client_id === c.id),
                          }))}
                          selectedIds={addMemberIds}
                          onToggleAdd={toggleAddMember}
                          onBook={() => void saveMembersOnSession(s.id)}
                          onMark={(id, status, clientId) => {
                            void markRoster(id, status, clientId);
                          }}
                          saving={saving}
                        />
                      ) : (
                        <div className="rounded-xl border border-sky-100 dark:border-sky-900 bg-sky-50/40 dark:bg-sky-950/20 px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-wide text-sky-800 dark:text-sky-200">
                            Booked members · {booked}
                          </p>
                          {roster.length === 0 ? (
                            <p className="text-[11px] text-slate-500 mt-1">
                              Nobody booked yet.
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-700 dark:text-slate-200 mt-1">
                              {roster.map((b) => b.name).join(', ')}
                            </p>
                          )}
                          <button
                            type="button"
                            className="mt-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 underline"
                            onClick={() => {
                              openSession(s.id);
                              setAddMemberIds([]);
                            }}
                          >
                            Open roster
                          </button>
                        </div>
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
                    (() => {
                      const names = sessionRosterNames(store, s.id);
                      const n = sessionBookingCount(store, s.id);
                      if (!names.length) return `${n}`;
                      return names.length <= 2
                        ? `${n} · ${names.join(', ')}`
                        : `${n} · ${names.slice(0, 2).join(', ')} +${names.length - 2}`;
                    })(),
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
