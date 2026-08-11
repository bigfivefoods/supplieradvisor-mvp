'use client';

/**
 * Coach calendar (owner desk) — planned classes, roster (plan), actual attendance.
 * Create bespoke one-off or repeating (daily / weekly / monthly) classes per coach.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Check,
  Loader2,
  Plus,
  Share2,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { fc } from '@/components/fitness/FitForm';
import { addDaysIso } from '@/lib/fitness/fitgraph';
import {
  PracticeScheduleCalendar,
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


type RosterRow = {
  booking_id: string;
  client_id: string;
  status: string;
  plan: boolean;
  actual: 'pending' | 'attended' | 'no_show' | 'cancelled';
  name: string;
  email?: string;
  phone?: string;
};

type SessionCard = {
  session: {
    id: string;
    date: string;
    start_time: string;
    location?: string;
    capacity?: number | null;
    public?: boolean;
    status: string;
    series_id?: string | null;
    origin?: string;
    class_type_id: string;
    /** Planned activities — visible to members & coaches */
    class_plan?: string;
    public_notes?: string;
  };
  class_name?: string;
  capacity: number;
  planned: number;
  waitlist: number;
  attended: number;
  no_show: number;
  pending: number;
  roster: RosterRow[];
};

type Portal = {
  coach: { id: string; name: string; code: string };
  from: string;
  to: string;
  sessions: SessionCard[];
  by_date: Record<string, SessionCard[]>;
  members: Array<{
    id: string;
    code: string;
    name: string;
    membership_status?: string;
  }>;
  class_types: Array<{
    id: string;
    code: string;
    name: string;
    default_duration_min?: number;
    capacity?: number | null;
  }>;
};

export default function CoachCalendarPage() {
  const { store, loading, saving, post, companyId } = useFitgraph();
  const [coachId, setCoachId] = useState('');
  /** Visible calendar window — expanded for day/week/month navigation */
  const [rangeFrom, setRangeFrom] = useState(() =>
    addDaysIso(new Date().toISOString().slice(0, 10), -14)
  );
  const [rangeTo, setRangeTo] = useState(() =>
    addDaysIso(new Date().toISOString().slice(0, 10), 45)
  );
  const [calendarDate, setCalendarDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [portal, setPortal] = useState<Portal | null>(null);
  const [busy, setBusy] = useState(false);
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [create, setCreate] = useState({
    class_type_id: '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '06:00',
    location: '',
    capacity: '',
    class_plan: '',
    public: false,
    client_ids: [] as string[],
    member_query: '',
  });
  const [recurrence, setRecurrence] = useState<RecurrenceFormValue>(
    emptyRecurrenceForm
  );
  const [bookClientIds, setBookClientIds] = useState<string[]>([]);
  const [classPlanDraft, setClassPlanDraft] = useState('');

  const workingHours = useMemo(
    () => normalizeWorkingHours(store?.settings?.working_hours),
    [store?.settings?.working_hours]
  );

  const loadPortal = useCallback(async () => {
    if (!coachId || !companyId) {
      setPortal(null);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/fitness/fitgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'coach_calendar',
          coachId,
          from: rangeFrom,
          to: rangeTo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setPortal(data.portal as Portal);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setBusy(false);
    }
  }, [coachId, companyId, rangeFrom, rangeTo]);

  const onVisibleRangeChange = useCallback(
    (range: { from: string; to: string }) => {
      // Pad so day/week/month navigation always has data
      const from = addDaysIso(range.from, -7);
      const to = addDaysIso(range.to, 7);
      setRangeFrom((prev) => (prev === from ? prev : from));
      setRangeTo((prev) => (prev === to ? prev : to));
    },
    []
  );

  const scheduleEvents: ScheduleEvent[] = useMemo(() => {
    if (!portal?.sessions?.length) return [];
    return portal.sessions.map((card) => ({
      id: card.session.id,
      date: card.session.date,
      start_time: String(card.session.start_time || '06:00').slice(0, 5),
      duration_min: 45,
      title: card.class_name || 'Class',
      subtitle: card.session.location || undefined,
      person_id: coachId,
      person_name: portal.coach?.name,
      status: card.session.status,
      public: card.session.public === true,
      meta: `Plan ${card.planned}/${card.capacity} · Act ${card.attended}${
        card.session.series_id ? ' · series' : ''
      }`,
      tone: 'amber' as const,
    }));
  }, [portal, coachId]);

  const saveHours = async (hours: typeof workingHours) => {
    await post({
      action: 'update_settings',
      settings: {
        ...(store?.settings || {}),
        working_hours: hours,
      },
    });
    toast.success('Gym operating hours saved');
  };

  useEffect(() => {
    if (store?.coaches?.length && !coachId) {
      setCoachId(store.coaches[0].id);
    }
  }, [store, coachId]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  const mark = async (
    bookingId: string,
    status: 'attended' | 'no_show' | 'booked'
  ) => {
    await post({ action: 'mark_attendance', booking_id: bookingId, status });
    toast.success(
      status === 'attended'
        ? 'Marked attended (actual)'
        : status === 'no_show'
          ? 'Marked no-show (actual)'
          : 'Back to planned'
    );
    await loadPortal();
  };

  const createClass = async () => {
    if (!create.class_type_id || !coachId) {
      toast.error('Pick class type and coach');
      return;
    }
    if (recurrence.frequency !== 'none') {
      const recErr = validateRecurrenceForm(recurrence);
      if (recErr) {
        toast.error(recErr);
        return;
      }
    }
    const payload = recurrenceApiPayload(recurrence, create.date);
    const data = await post({
      action:
        recurrence.frequency !== 'none'
          ? 'create_session_series'
          : 'create_session',
      coach_id: coachId,
      class_type_id: create.class_type_id,
      date: create.date,
      start_time: create.start_time,
      location: create.location || undefined,
      capacity: create.capacity ? Number(create.capacity) : undefined,
      class_plan: create.class_plan.trim() || undefined,
      public: create.public,
      ...(payload || { frequency: 'none', repeat: 'none' }),
    });
    const sessions = (data.sessions || []) as Array<{ id: string }>;
    let sessionIds = sessions.map((s) => s.id).filter(Boolean);
    // Single create_session may not return sessions array — find newest match
    if (!sessionIds.length && data.store?.sessions) {
      const storeSessions = data.store.sessions as Array<{
        id: string;
        date: string;
        start_time: string;
        coach_id?: string | null;
        class_type_id: string;
      }>;
      const hit = storeSessions.find(
        (s) =>
          s.date === create.date &&
          s.start_time.slice(0, 5) === create.start_time.slice(0, 5) &&
          s.class_type_id === create.class_type_id &&
          (s.coach_id === coachId || !s.coach_id)
      );
      if (hit) sessionIds = [hit.id];
    }
    if (create.client_ids.length && sessionIds.length) {
      for (const sessionId of sessionIds) {
        for (const clientId of create.client_ids) {
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
        }
      }
      toast.success(
        `${data.message || 'Class created'} · ${create.client_ids.length} member(s) booked`
      );
    } else {
      toast.success(data.message || 'Class created');
    }
    setShowCreate(false);
    setCreate((f) => ({
      ...f,
      class_plan: '',
      client_ids: [],
      member_query: '',
    }));
    await loadPortal();
  };

  const saveClassPlan = async (sessionId: string) => {
    await post({
      action: 'update_class_plan',
      session_id: sessionId,
      class_plan: classPlanDraft,
    });
    toast.success('Class plan saved — members & coaches can see it');
    await loadPortal();
  };

  const copyInvite = async (sessionId: string) => {
    const data = await post({
      action: 'issue_class_invite',
      session_id: sessionId,
    });
    const inv = data.invite as { path?: string; text?: string } | undefined;
    if (!inv?.path || typeof window === 'undefined') {
      toast.error('Could not create join link');
      return;
    }
    const url = `${window.location.origin}${inv.path}`;
    await navigator.clipboard.writeText(`${inv.text || 'Join class'}\n${url}`);
    toast.success('B2C join link copied — send to members');
  };

  const deleteOpenSession = async () => {
    if (!openCard) return;
    const s = openCard.session;
    const seriesCount =
      s.series_id && store?.sessions
        ? store.sessions.filter((x) => x.series_id === s.series_id).length
        : 0;
    if (
      !confirm(
        `Delete this class on ${s.date} at ${String(s.start_time).slice(0, 5)}? Bookings on it will be removed.`
      )
    ) {
      return;
    }
    let deleteSeries = false;
    if (seriesCount > 1) {
      deleteSeries = confirm(
        `This class is part of a series (${seriesCount}). OK = delete the entire series, Cancel = delete only this date.`
      );
    }
    try {
      const data = await post({
        entity: 'sessions',
        action: 'delete',
        id: s.id,
        delete_series: deleteSeries,
      });
      toast.success(
        (data?.message as string) ||
          (deleteSeries ? 'Series deleted' : 'Class deleted')
      );
      setOpenSession(null);
      await loadPortal();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete class');
    }
  };

  const bookMember = async (sessionId: string) => {
    if (!bookClientIds.length) {
      toast.error('Select at least one member');
      return;
    }
    for (const clientId of bookClientIds) {
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
    }
    toast.success(
      bookClientIds.length === 1
        ? 'Member added to plan'
        : `${bookClientIds.length} members added to plan`
    );
    setBookClientIds([]);
    await loadPortal();
  };

  const openCard = portal?.sessions.find((s) => s.session.id === openSession);

  // Sync plan draft when opening a session
  useEffect(() => {
    if (openCard) {
      setClassPlanDraft(openCard.session.class_plan || '');
    }
  }, [openCard?.session.id, openCard?.session.class_plan]);

  return (
    <FitgraphWorkbench
      title="Coach calendar"
      titleAccent="plan · actual"
      description="Day, week and month views with gym operating hours. Open a class for plan/actuals, create bespoke or repeating classes, and download A4 landscape or portrait."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-3xl border border-amber-300 bg-amber-50 p-4 dark:!border-amber-400 dark:!bg-amber-950 dark:ring-1 dark:ring-amber-500/40">
            <label className="text-sm min-w-[10rem]">
              <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300">
                Coach
              </span>
              <select
                className={fc() + ' mt-1'}
                value={coachId}
                onChange={(e) => setCoachId(e.target.value)}
              >
                {store.coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="btn-primary !py-2 !px-3 text-sm inline-flex items-center gap-1.5 ml-auto"
            >
              <Plus className="w-4 h-4" /> New class
            </button>
            <Link
              href="/dashboard/fitgraph/calendar"
              className="text-xs font-bold text-amber-800 dark:text-amber-300 inline-flex items-center gap-1"
            >
              <CalendarDays className="w-3.5 h-3.5" /> Owner schedule
            </Link>
          </div>

          <WorkingHoursEditor
            value={workingHours}
            defaultCollapsed
            onSave={saveHours}
            saving={saving}
            title="Gym operating hours"
            description="Open days and times for this gym. Closed days are dimmed; day and week views use this window."
            accentClass="border-amber-200 dark:border-amber-800"
          />

          {busy && !portal ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
          ) : (
            <PracticeScheduleCalendar
              title={`Coach diary · ${portal?.coach?.name || 'Coach'}`}
              printBrand={
                store.settings?.brand_name || 'VUKA Fitness · FitAdvisor'
              }
              accent="amber"
              events={scheduleEvents}
              people={store.coaches
                .filter((c) => c.active !== false)
                .map((c) => ({
                  id: c.id,
                  name: c.name,
                  role: (c.specialties || []).slice(0, 2).join(', ') || undefined,
                }))}
              peopleLabel="Coach"
              personFilter={coachId}
              onPersonFilterChange={(id) => {
                if (id) setCoachId(id);
              }}
              diaryScope="person"
              hideScopeToggle
              showDiaryScopeToggle={false}
              workingHours={workingHours}
              initialDate={calendarDate}
              emptyLabel="No classes in this view"
              slotHint="Click empty time to create a class for this coach"
              selectedEventId={openSession}
              onVisibleRangeChange={onVisibleRangeChange}
              onSelectDate={(date) => {
                setCalendarDate(date);
                setCreate((f) => ({ ...f, date }));
              }}
              onSelectSlot={(slot) => {
                setCalendarDate(slot.date);
                setCreate((f) => ({
                  ...f,
                  date: slot.date,
                  start_time: slot.start_time.slice(0, 5),
                }));
                setShowCreate(true);
              }}
              onSelectEvent={(ev) => {
                setOpenSession(ev.id);
                setCalendarDate(ev.date);
              }}
            />
          )}

          {/* Session detail: plan + actual */}
          {openCard && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3">
              <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl border border-amber-300 bg-white dark:!border-amber-400 dark:!bg-amber-950 p-5 space-y-4 shadow-xl">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      {openCard.session.date} · {openCard.session.start_time}
                      {openCard.session.series_id ? ' · series' : ' · bespoke'}
                    </p>
                    <h3 className="text-lg font-black dark:text-amber-50">
                      {openCard.class_name || 'Class'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-amber-200/80">
                      {openCard.session.location || 'No room'} · capacity{' '}
                      {openCard.capacity}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="p-2 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900"
                    onClick={() => setOpenSession(null)}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-amber-200 dark:border-amber-600 p-2">
                    <div className="text-[9px] font-black uppercase text-amber-700 dark:text-amber-300">
                      Booked
                    </div>
                    <div className="text-lg font-black tabular-nums dark:text-amber-50">
                      {openCard.planned}
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-600 p-2">
                    <div className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300">
                      Attended
                    </div>
                    <div className="text-lg font-black tabular-nums dark:text-emerald-50">
                      {openCard.attended}
                    </div>
                  </div>
                  <div className="rounded-xl border border-rose-200 dark:border-rose-600 p-2">
                    <div className="text-[9px] font-black uppercase text-rose-700 dark:text-rose-300">
                      No-show
                    </div>
                    <div className="text-lg font-black tabular-nums dark:text-rose-50">
                      {openCard.no_show}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1.5">
                    Class plan · activities
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-amber-200/70 mb-1.5">
                    What you will do in this class — members and other coaches
                    can see this.
                  </p>
                  <textarea
                    className={fc() + ' min-h-[5.5rem] resize-y'}
                    placeholder={
                      'e.g.\n• Warm-up 5 min\n• Strength circuit 20 min\n• HIIT finisher 10 min\n• Cool-down & stretch'
                    }
                    value={classPlanDraft}
                    onChange={(e) => setClassPlanDraft(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      disabled={saving}
                      className="btn-primary !py-1.5 !px-3 text-xs"
                      onClick={() => void saveClassPlan(openCard.session.id)}
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                      ) : null}{' '}
                      Save class plan
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                      onClick={() => void copyInvite(openCard.session.id)}
                    >
                      <Share2 className="w-3.5 h-3.5" /> Copy join link
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
                      onClick={() => void deleteOpenSession()}
                    >
                      Delete class
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-amber-300 mb-2 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Who is coming · update actual
                  </h4>
                  {openCard.roster.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-amber-200/60">
                      No one booked yet. Add a member below.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {openCard.roster.map((r) => (
                        <li
                          key={r.booking_id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-100 dark:border-amber-700/50 px-3 py-2"
                        >
                          <div>
                            <div className="text-sm font-bold dark:text-amber-50">
                              {r.name}
                            </div>
                            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-amber-300/70">
                              Plan: {r.status === 'waitlist' ? 'waitlist' : 'booked'}{' '}
                              · Actual:{' '}
                              {r.actual === 'pending' ? '—' : r.actual}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={saving}
                              title="Attended"
                              className={`p-1.5 rounded-lg border text-xs font-bold ${
                                r.actual === 'attended'
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'border-slate-200 dark:border-amber-600 dark:text-amber-100'
                              }`}
                              onClick={() => void mark(r.booking_id, 'attended')}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              title="No-show"
                              className={`p-1.5 rounded-lg border text-xs font-bold ${
                                r.actual === 'no_show'
                                  ? 'bg-rose-600 text-white border-rose-600'
                                  : 'border-slate-200 dark:border-amber-600 dark:text-amber-100'
                              }`}
                              onClick={() => void mark(r.booking_id, 'no_show')}
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              title="Reset to planned"
                              className="p-1.5 rounded-lg border border-slate-200 text-[10px] font-bold dark:border-amber-600 dark:text-amber-100"
                              onClick={() => void mark(r.booking_id, 'booked')}
                            >
                              Plan
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-2 border-t border-amber-100 dark:border-amber-800 pt-3">
                  <p className="text-[10px] font-black uppercase text-slate-500 dark:text-amber-300">
                    Add members to plan
                    {bookClientIds.length
                      ? ` · ${bookClientIds.length} selected`
                      : ''}
                  </p>
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-amber-200 dark:border-amber-800 divide-y divide-amber-100 dark:divide-amber-900">
                    {(portal?.members || []).map((m) => {
                      const on = bookClientIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className="flex items-center gap-2 px-2.5 py-1.5 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() =>
                              setBookClientIds((ids) =>
                                on
                                  ? ids.filter((x) => x !== m.id)
                                  : [...ids, m.id]
                              )
                            }
                          />
                          <span>
                            {m.code} · {m.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={saving || !bookClientIds.length}
                    className="btn-primary !py-2 !px-3 text-sm w-full sm:w-auto"
                    onClick={() => void bookMember(openCard.session.id)}
                  >
                    {bookClientIds.length
                      ? `Add ${bookClientIds.length} to plan`
                      : 'Add to plan'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create class modal */}
          {showCreate && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3">
              <div className="w-full max-w-md rounded-3xl border border-amber-300 bg-white dark:!border-amber-400 dark:!bg-amber-950 p-5 space-y-3 shadow-xl">
                <div className="flex justify-between">
                  <h3 className="font-black dark:text-amber-50">
                    New class for {portal?.coach.name || 'coach'}
                  </h3>
                  <button type="button" onClick={() => setShowCreate(false)}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <select
                  className={fc()}
                  value={create.class_type_id}
                  onChange={(e) =>
                    setCreate((f) => ({ ...f, class_type_id: e.target.value }))
                  }
                >
                  <option value="">Class type…</option>
                  {store.class_types.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className={fc()}
                    value={create.date}
                    onChange={(e) =>
                      setCreate((f) => ({ ...f, date: e.target.value }))
                    }
                  />
                  <input
                    type="time"
                    className={fc()}
                    value={create.start_time}
                    onChange={(e) =>
                      setCreate((f) => ({ ...f, start_time: e.target.value }))
                    }
                  />
                </div>
                <input
                  className={fc()}
                  placeholder="Room / location"
                  value={create.location}
                  onChange={(e) =>
                    setCreate((f) => ({ ...f, location: e.target.value }))
                  }
                />
                <input
                  className={fc()}
                  type="number"
                  placeholder="Capacity (optional)"
                  value={create.capacity}
                  onChange={(e) =>
                    setCreate((f) => ({ ...f, capacity: e.target.value }))
                  }
                />
                <textarea
                  className={fc() + ' min-h-[4.5rem] resize-y sm:col-span-2'}
                  placeholder="Class plan / activities (members & coaches see this)"
                  value={create.class_plan}
                  onChange={(e) =>
                    setCreate((f) => ({ ...f, class_plan: e.target.value }))
                  }
                />
                <RecurrenceFields
                  value={recurrence}
                  onChange={setRecurrence}
                  startDate={create.date}
                  inputClass={fc()}
                  accent="amber"
                  unitLabel="classes"
                />
                <label className="flex items-center gap-2 text-xs font-medium dark:text-amber-100">
                  <input
                    type="checkbox"
                    checked={create.public}
                    onChange={(e) =>
                      setCreate((f) => ({ ...f, public: e.target.checked }))
                    }
                  />
                  Publish on website calendar
                </label>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase text-slate-500 dark:text-amber-300">
                    Add members
                    {create.client_ids.length
                      ? ` · ${create.client_ids.length} selected`
                      : ''}
                  </p>
                  <input
                    className={fc()}
                    placeholder="Search members…"
                    value={create.member_query}
                    onChange={(e) =>
                      setCreate((f) => ({
                        ...f,
                        member_query: e.target.value,
                      }))
                    }
                  />
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-amber-200 dark:border-amber-800 divide-y divide-amber-100 dark:divide-amber-900">
                    {(portal?.members || [])
                      .filter((m) => {
                        const q = create.member_query.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          m.name.toLowerCase().includes(q) ||
                          String(m.code || '')
                            .toLowerCase()
                            .includes(q)
                        );
                      })
                      .map((m) => {
                        const on = create.client_ids.includes(m.id);
                        return (
                          <label
                            key={m.id}
                            className="flex items-center gap-2 px-2.5 py-1.5 text-sm cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() =>
                                setCreate((f) => ({
                                  ...f,
                                  client_ids: on
                                    ? f.client_ids.filter((x) => x !== m.id)
                                    : [...f.client_ids, m.id],
                                }))
                              }
                            />
                            <span>
                              {m.code} · {m.name}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  className="btn-primary w-full !py-2.5 text-sm"
                  onClick={() => void createClass()}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin inline" />
                  ) : null}{' '}
                  {create.client_ids.length
                    ? `Create${recurrence.frequency !== 'none' ? ' series' : ' class'} + ${create.client_ids.length} member(s)`
                    : `Create class${recurrence.frequency !== 'none' ? ' series' : ''}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </FitgraphWorkbench>
  );
}
