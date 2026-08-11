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
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Repeat,
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
  RecurrenceFields,
  emptyRecurrenceForm,
  recurrenceApiPayload,
  validateRecurrenceForm,
  type RecurrenceFormValue,
} from '@/components/schedule/RecurrenceFields';


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
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const monOffset = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + monOffset);
    return d.toISOString().slice(0, 10);
  });
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

  const weekEnd = useMemo(() => addDaysIso(weekStart, 6), [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)),
    [weekStart]
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
          from: weekStart,
          to: weekEnd,
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
  }, [coachId, companyId, weekStart, weekEnd]);

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
      description="Each coach’s week: planned classes (who is booked), create bespoke or repeating classes, then update actuals — who came or no-showed — before or after the class."
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
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-2 rounded-xl border border-amber-200 dark:border-amber-600"
                onClick={() => setWeekStart(addDaysIso(weekStart, -7))}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 text-sm font-bold tabular-nums dark:text-amber-50">
                {weekStart} → {weekEnd}
              </div>
              <button
                type="button"
                className="p-2 rounded-xl border border-amber-200 dark:border-amber-600"
                onClick={() => setWeekStart(addDaysIso(weekStart, 7))}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
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

          {busy && !portal ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
              {days.map((d) => {
                const list = portal?.by_date?.[d] || [];
                const label = new Date(d + 'T12:00:00').toLocaleDateString(
                  undefined,
                  { weekday: 'short', day: 'numeric', month: 'short' }
                );
                return (
                  <div
                    key={d}
                    className="rounded-2xl border border-amber-200/80 bg-white dark:!border-amber-500/40 dark:!bg-amber-950/60 min-h-[8rem] p-2"
                  >
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-800/80 dark:text-amber-300 mb-2">
                      {label}
                    </div>
                    <div className="space-y-1.5">
                      {list.length === 0 ? (
                        <p className="text-[10px] text-slate-400 dark:text-amber-200/40 py-4 text-center">
                          —
                        </p>
                      ) : (
                        list.map((card) => (
                          <button
                            key={card.session.id}
                            type="button"
                            onClick={() => setOpenSession(card.session.id)}
                            className="w-full text-left rounded-xl border border-amber-200 bg-amber-50/80 px-2 py-1.5 hover:border-amber-500 dark:!border-amber-500/50 dark:!bg-amber-900/50"
                          >
                            <div className="text-[11px] font-black tabular-nums dark:text-amber-50">
                              {card.session.start_time}
                            </div>
                            <div className="text-[10px] font-semibold truncate dark:text-amber-100">
                              {card.class_name || 'Class'}
                            </div>
                            <div className="text-[9px] text-slate-500 dark:text-amber-200/70 flex gap-1 flex-wrap">
                              <span>
                                Plan {card.planned}/{card.capacity}
                              </span>
                              <span>· Act {card.attended}</span>
                              {card.session.series_id ? (
                                <Repeat className="w-2.5 h-2.5 inline" />
                              ) : null}
                            </div>
                            {card.session.class_plan ? (
                              <p className="text-[9px] text-amber-800/80 dark:text-amber-200/80 line-clamp-2 mt-0.5">
                                {card.session.class_plan}
                              </p>
                            ) : null}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
