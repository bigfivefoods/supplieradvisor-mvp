'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Search, Share2 } from 'lucide-react';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
  type FitgraphPostResult,
} from '@/components/fitness/FitgraphWorkbench';
import { FormCard, StatRow, fc } from '@/components/fitness/FitForm';
import { GymBookingPlanBoard } from '@/components/fitness/GymBookingPlanBoard';
import { buildPublicFeedbackPath } from '@/lib/services/booking-feedback';
import { AdvisorWaitlistDesk } from '@/components/services/AdvisorWaitlistDesk';
import { AdvisorMemberJoinInbox } from '@/components/advisors/AdvisorMemberJoinInbox';
import { buildDeskSlotWaitlist } from '@/lib/services/advisor-waitlist-desk';
import { isoDateInZone } from '@/lib/fitness/gym-local-time';
import { addDaysIso } from '@/lib/schedule/recurrence';
import { openCloseOn } from '@/lib/schedule/working-hours';
import {
  gymPlanClassesOnDate,
  gymPlanDateLabel,
  gymPlanDayHeading,
  gymPlanMonday,
  gymPlanWeek,
  type GymPlanClass,
  type GymPlanFilter,
  type GymPlanMember,
} from '@/lib/fitness/gym-booking-plan';
import {
  SYS_COACH_AWAY_CODE,
  SYS_COACH_TIME_CODE,
  SYS_PT_CODE,
} from '@/lib/fitness/session-times';
import { sessionBookingCount } from '@/lib/fitness/fitgraph';

const HIDE_CLASS = new Set([
  SYS_PT_CODE,
  SYS_COACH_TIME_CODE,
  SYS_COACH_AWAY_CODE,
]);

type RangeId = 'today' | 'week' | 'custom';

export default function BookingsPage() {
  const { companyId, store, loading, saving, post, summary, load } =
    useFitgraph({ history: true });
  const [form, setForm] = useState({
    session_id: '',
    client_id: '',
    status: 'booked',
  });
  const [range, setRange] = useState<RangeId>('today');
  const [customDate, setCustomDate] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [q, setQ] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('');

  const today = isoDateInZone(store?.settings?.timezone);
  const viewDate = range === 'custom' ? customDate || today : today;
  const viewWeekStart = gymPlanMonday(weekStart || today);

  const filter: GymPlanFilter = {
    classId: classId || undefined,
    memberQ: q || undefined,
    status: status || undefined,
  };

  const planDays = useMemo(() => {
    if (!store) return [];
    if (range === 'week') {
      return gymPlanWeek(
        store,
        store.settings?.working_hours,
        viewWeekStart,
        filter
      );
    }
    const classes = gymPlanClassesOnDate(store, viewDate, filter);
    const heading = gymPlanDayHeading(viewDate);
    const oc = openCloseOn(store.settings?.working_hours, viewDate);
    return [
      {
        date: viewDate,
        weekday: heading.weekday,
        label: heading.label,
        short: heading.short,
        dateLabel: heading.dateLabel,
        hoursLabel: oc.closed ? 'Closed' : `${oc.open}–${oc.close}`,
        closed: oc.closed === true,
        classes,
      },
    ];
  }, [store, range, viewDate, viewWeekStart, classId, q, status]);

  const addSessions = useMemo(() => {
    if (!store) return [];
    const fromPlan: GymPlanClass[] =
      range === 'week'
        ? planDays.flatMap((d) => d.classes)
        : planDays[0]?.classes || [];
    const seen = new Set(fromPlan.map((c) => c.session.id));
    const extra = (store.sessions || [])
      .filter((s) => {
        if (seen.has(s.id) || s.status === 'cancelled') return false;
        const ct = store.class_types.find((c) => c.id === s.class_type_id);
        if (HIDE_CLASS.has(String(ct?.code || ''))) return false;
        return s.date >= today;
      })
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          String(a.start_time).localeCompare(String(b.start_time))
      )
      .slice(0, 40)
      .map((s) => {
        const ct = store.class_types.find((c) => c.id === s.class_type_id);
        const coach = store.coaches.find((c) => c.id === s.coach_id);
        return {
          session: s,
          className: ct?.name || 'Class',
          coachName: coach?.name || '—',
          booked: sessionBookingCount(store, s.id),
          cap: s.capacity ?? ct?.capacity ?? 0,
        };
      });
    return [
      ...fromPlan.map((c) => ({
        session: c.session,
        className: c.className,
        coachName: c.coachName,
        booked: c.booked,
        cap: c.cap,
      })),
      ...extra,
    ];
  }, [store, planDays, range, today]);

  const classes = useMemo(() => {
    if (!store) return [];
    return (store.class_types || []).filter(
      (c) => c.active !== false && !HIDE_CLASS.has(String(c.code || ''))
    );
  }, [store]);

  const pendingFeedback = (store?.bookings || []).filter(
    (b) =>
      b.status === 'attended' && b.feedback_token && !b.feedback_submitted_at
  );

  const add = async () => {
    if (!form.session_id || !form.client_id) {
      toast.error('Session and member required');
      return;
    }
    await post({
      entity: 'bookings',
      action: 'upsert',
      record: form,
    });
    toast.success('Member added to class (waitlist if full)');
    setForm((f) => ({ ...f, client_id: '' }));
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
    toast.success('B2C join link copied');
  };

  const mark = async (
    member: GymPlanMember,
    next: string,
    sessionId: string
  ) => {
    const data = await post({
      action: 'mark_attendance',
      booking_id: member.booking_id,
      status: next,
      session_id: sessionId,
      client_id: member.client_id,
    }) as FitgraphPostResult;
    if (next === 'attended') {
      const tok = data?.feedback_prompt?.token;
      const packLeft = data?.pack_remaining;
      if (tok) {
        const path = buildPublicFeedbackPath('fitgraph', companyId, tok);
        const url = `${window.location.origin}${path}`;
        try {
          await navigator.clipboard.writeText(url);
          toast.success(
            packLeft != null
              ? `Attended — pack left ${packLeft}; feedback link copied`
              : 'Attended — feedback link copied for the member'
          );
        } catch {
          toast.success(data?.message || 'Attended');
        }
        return;
      }
      if (packLeft != null) {
        toast.success(`Attended — pack sessions left: ${packLeft}`);
        return;
      }
    }
    toast.success(data?.message || `Marked ${next}`);
  };

  const copyFeedback = async (token: string) => {
    const path = buildPublicFeedbackPath('fitgraph', companyId, token);
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    toast.success('Feedback link copied');
  };

  const plannedCount = planDays.reduce((n, d) => n + d.classes.length, 0);

  return (
    <FitgraphWorkbench
      title="Bookings"
      titleAccent="call in the plan"
      description="Today, this week, or a date — class, then coach, then planned members. Working days follow gym hours."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <AdvisorMemberJoinInbox
            companyId={companyId}
            module="fitgraph"
            patientsHref="/dashboard/fitgraph/clients"
          />
          <StatRow
            tone="owner"
            items={[
              {
                label: 'Open bookings',
                value: Number(summary?.bookingsOpen) || 0,
              },
              {
                label: 'Waitlist',
                value: store.bookings.filter((b) => b.status === 'waitlist')
                  .length,
              },
              {
                label: 'Classes planned',
                value: plannedCount,
              },
              {
                label: 'Feedback pending',
                value: pendingFeedback.length,
              },
            ]}
          />

          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-yellow-200 bg-yellow-50/50 p-3 dark:border-yellow-600/40 dark:bg-yellow-950/30">
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Plan range">
              {(
                [
                  ['today', 'Today'],
                  ['week', 'This week'],
                  ['custom', 'Custom'],
                ] as Array<[RangeId, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={range === id}
                  onClick={() => {
                    setRange(id);
                    if (id === 'week') setWeekStart(gymPlanMonday(today));
                    if (id === 'custom' && !customDate) setCustomDate(today);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${
                    range === id
                      ? 'border-yellow-500 bg-[#E8E830] text-slate-900'
                      : 'border-yellow-200 bg-white text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {range === 'custom' ? (
              <label className="text-[11px] font-bold text-slate-600">
                Date
                <input
                  type="date"
                  className={fc() + ' mt-0.5'}
                  value={customDate || today}
                  onChange={(e) => setCustomDate(e.target.value)}
                />
              </label>
            ) : null}
            {range === 'week' ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-full border border-yellow-200 bg-white p-1.5 text-yellow-900"
                  onClick={() =>
                    setWeekStart(addDaysIso(viewWeekStart, -7))
                  }
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-1 text-[11px] font-black text-yellow-900 dark:text-yellow-100">
                  {gymPlanDateLabel(viewWeekStart)} –{' '}
                  {gymPlanDateLabel(addDaysIso(viewWeekStart, 6))}
                </span>
                <button
                  type="button"
                  className="rounded-full border border-yellow-200 bg-white p-1.5 text-yellow-900"
                  onClick={() =>
                    setWeekStart(addDaysIso(viewWeekStart, 7))
                  }
                  aria-label="Next week"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            <label className="relative min-w-[10rem] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className={fc() + ' pl-8'}
                placeholder="Search member"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <select
              className={fc() + ' min-w-[8rem]'}
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className={fc() + ' min-w-[8rem]'}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="booked">Booked</option>
              <option value="waitlist">Waitlist</option>
              <option value="attended">Attended</option>
              <option value="no_show">No-show</option>
            </select>
          </div>

          {range === 'week' ? (
            <p className="-mb-3 text-[11px] text-slate-500">
              Columns are this gym’s working days and hours. Closed days stay
              hidden unless a class is already planned.
            </p>
          ) : null}

          <GymBookingPlanBoard
            days={planDays}
            mode={range === 'week' ? 'week' : 'day'}
            today={today}
            onSelectSession={(sessionId) =>
              setForm((f) => ({ ...f, session_id: sessionId }))
            }
            onCopyInvite={(sessionId) => void copyInvite(sessionId)}
            onMark={(member, next, sessionId) =>
              void mark(member, next, sessionId)
            }
            onRemove={(member) =>
              void post({
                entity: 'bookings',
                action: 'delete',
                id: member.booking_id,
              })
            }
            onCopyFeedback={(token) => void copyFeedback(token)}
          />

          <FormCard
            tone="owner"
            title="Add member to a class"
            onSubmit={() => void add()}
            saving={saving}
            submitLabel="Add to class"
          >
            <select
              className={fc()}
              value={form.session_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, session_id: e.target.value }))
              }
            >
              <option value="">Class…</option>
              {addSessions.map(
                ({ session: s, className, coachName, booked, cap }) => (
                  <option key={s.id} value={s.id}>
                    {s.date} {s.start_time} · {className}
                    {coachName && coachName !== '—' && coachName !== 'Unassigned'
                      ? ` · ${coachName}`
                      : ''}{' '}
                    ({booked}/{cap || '—'})
                  </option>
                )
              )}
            </select>
            <select
              className={fc()}
              value={form.client_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, client_id: e.target.value }))
              }
            >
              <option value="">Member…</option>
              {store.clients
                .filter((c) => c.active !== false)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
            </select>
            {form.session_id ? (
              <button
                type="button"
                className="sm:col-span-2 inline-flex items-center gap-1.5 text-xs font-bold text-yellow-700"
                onClick={() => void copyInvite(form.session_id)}
              >
                <Share2 className="w-3.5 h-3.5" /> Copy B2C join link for this
                class
              </button>
            ) : null}
          </FormCard>

          <AdvisorWaitlistDesk
            queue={[]}
            slotWaitlist={buildDeskSlotWaitlist({
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
            })}
            accentClass="border-yellow-200"
            post={async (body) => {
              await post(body);
            }}
            onRefresh={() => {
              void load();
            }}
            calendarHref="/dashboard/fitgraph/calendar"
          />

          {pendingFeedback.length ? (
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50/60 p-4 dark:border-yellow-700/40 dark:bg-yellow-950/30">
              <h3 className="text-sm font-black text-yellow-950 dark:text-yellow-100">
                Feedback requested
              </h3>
              <p className="mb-3 mt-0.5 text-[11px] text-yellow-900/80 dark:text-yellow-200/80">
                Share these links with members after class (WhatsApp / SMS /
                email).
              </p>
              <ul className="space-y-1.5">
                {pendingFeedback.map((b) => {
                  const client = store.clients.find(
                    (c) => c.id === b.client_id
                  );
                  return (
                    <li
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-yellow-100 bg-white px-3 py-2 text-xs dark:border-yellow-800 dark:bg-yellow-950"
                    >
                      <span className="font-bold">
                        {client?.name || b.guest_name || 'Member'}
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-bold text-yellow-700 dark:text-yellow-300"
                        onClick={() => void copyFeedback(b.feedback_token!)}
                      >
                        Copy feedback link
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </FitgraphWorkbench>
  );
}
