'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { Copy, Share2, ChevronDown, Search } from 'lucide-react';
import { FormCard, StatRow, fc } from '@/components/fitness/FitForm';
import { sessionBookingCount, type FitBooking } from '@/lib/fitness/fitgraph';
import { buildPublicFeedbackPath } from '@/lib/services/booking-feedback';
import { AdvisorWaitlistDesk } from '@/components/services/AdvisorWaitlistDesk';
import { AdvisorMemberJoinInbox } from '@/components/advisors/AdvisorMemberJoinInbox';
import { buildDeskSlotWaitlist } from '@/lib/services/advisor-waitlist-desk';
import { isoDateInZone } from '@/lib/fitness/gym-local-time';
import { addDaysIso } from '@/lib/schedule/recurrence';
import {
  SYS_COACH_AWAY_CODE,
  SYS_COACH_TIME_CODE,
  SYS_PT_CODE,
} from '@/lib/fitness/session-times';

const HIDE_CLASS = new Set([
  SYS_PT_CODE,
  SYS_COACH_TIME_CODE,
  SYS_COACH_AWAY_CODE,
]);

type RangeId = 'today' | 'week' | 'upcoming' | 'all';

export default function BookingsPage() {
  const { companyId, store, loading, saving, post, summary, load } =
    useFitgraph();
  const [form, setForm] = useState({
    session_id: '',
    client_id: '',
    status: 'booked',
  });
  const [range, setRange] = useState<RangeId>('upcoming');
  const [q, setQ] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const today = isoDateInZone(store?.settings?.timezone);
  const weekEnd = addDaysIso(today, 6);

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

  const mark = async (id: string, next: string) => {
    const data = await post({
      action: 'mark_attendance',
      booking_id: id,
      status: next,
    });
    if (next === 'attended') {
      const tok = data?.feedback_prompt?.token as string | undefined;
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

  const classes = useMemo(() => {
    if (!store) return [];
    return (store.class_types || []).filter(
      (c) => c.active !== false && !HIDE_CLASS.has(String(c.code || ''))
    );
  }, [store]);

  const sessionCards = useMemo(() => {
    if (!store) return [];
    const needle = q.trim().toLowerCase();
    const sessions = [...(store.sessions || [])]
      .filter((s) => {
        if (s.status === 'cancelled') return false;
        const ct = store.class_types.find((c) => c.id === s.class_type_id);
        if (HIDE_CLASS.has(String(ct?.code || ''))) return false;
        if (classId && s.class_type_id !== classId) return false;
        if (range === 'today') return s.date === today;
        if (range === 'week') return s.date >= today && s.date <= weekEnd;
        if (range === 'upcoming') return s.date >= today;
        return true;
      })
      .sort((a, b) =>
        a.date === b.date
          ? String(a.start_time).localeCompare(String(b.start_time))
          : a.date.localeCompare(b.date)
      );

    return sessions
      .map((s) => {
        const ct = store.class_types.find((c) => c.id === s.class_type_id);
        const coach = store.coaches.find((c) => c.id === s.coach_id);
        const roster = (store.bookings || []).filter((b) => {
          if (b.session_id !== s.id) return false;
          if (b.status === 'cancelled') return false;
          if (status && b.status !== status) return false;
          if (!needle) return true;
          const client = store.clients.find((c) => c.id === b.client_id);
          const blob = `${client?.name || ''} ${client?.code || ''} ${b.guest_name || ''} ${b.family_member_name || ''} ${b.status}`;
          return blob.toLowerCase().includes(needle);
        });
        if ((needle || status) && roster.length === 0) return null;
        const cap = s.capacity ?? ct?.capacity ?? 0;
        const booked = sessionBookingCount(store, s.id);
        return {
          session: s,
          className: ct?.name || 'Class',
          coachName: coach?.name || '—',
          roster,
          cap,
          booked,
        };
      })
      .filter(Boolean) as Array<{
      session: (typeof store.sessions)[number];
      className: string;
      coachName: string;
      roster: FitBooking[];
      cap: number;
      booked: number;
    }>;
  }, [store, range, today, weekEnd, classId, status, q]);

  const addSessions = useMemo(() => {
    if (!store) return [];
    return [...(store.sessions || [])]
      .filter((s) => {
        if (s.status === 'cancelled') return false;
        const ct = store.class_types.find((c) => c.id === s.class_type_id);
        if (HIDE_CLASS.has(String(ct?.code || ''))) return false;
        if (openId && s.id === openId) return true;
        return s.date >= today;
      })
      .sort((a, b) =>
        a.date === b.date
          ? String(a.start_time).localeCompare(String(b.start_time))
          : a.date.localeCompare(b.date)
      )
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
  }, [store, today, openId]);

  const pendingFeedback = (store?.bookings || []).filter(
    (b) =>
      b.status === 'attended' && b.feedback_token && !b.feedback_submitted_at
  );

  return (
    <FitgraphWorkbench
      title="Bookings"
      titleAccent="class roster"
      description="Pick a class, see who is on it, add a member, mark attended or no-show. Waitlist and SA Member join requests sit at the top."
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
                label: 'Classes in view',
                value: sessionCards.length,
              },
              {
                label: 'Feedback pending',
                value: pendingFeedback.length,
              },
            ]}
          />
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

          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-yellow-200 bg-yellow-50/50 p-3 dark:border-yellow-600/40 dark:bg-yellow-950/30">
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['today', 'Today'],
                  ['week', 'This week'],
                  ['upcoming', 'Upcoming'],
                  ['all', 'All'],
                ] as Array<[RangeId, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRange(id)}
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
                    {coachName !== '—' ? ` · ${coachName}` : ''} ({booked}/
                    {cap || '—'})
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

          {sessionCards.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-yellow-200 px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:border-yellow-700/40">
              No classes in this slice. Try Upcoming or All, or schedule a class
              on Calendar.
            </p>
          ) : (
            <div className="space-y-3">
              {sessionCards.map((card) => {
                const s = card.session;
                const open = openId === s.id;
                return (
                  <div
                    key={s.id}
                    className="overflow-hidden rounded-2xl border border-yellow-200 bg-white shadow-sm dark:border-yellow-600/40 dark:bg-yellow-950/20"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenId(open ? null : s.id);
                        if (!open) {
                          setForm((f) => ({ ...f, session_id: s.id }));
                        }
                      }}
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                      aria-expanded={open}
                    >
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-yellow-700 transition-transform ${
                          open ? '' : '-rotate-90'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-900 dark:text-yellow-50">
                          {s.date} {String(s.start_time).slice(0, 5)} ·{' '}
                          {card.className}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-yellow-100/70">
                          {card.coachName}
                          {s.location ? ` · ${s.location}` : ''}
                          {card.roster.length !== card.booked
                            ? ` · ${card.roster.length} shown`
                            : ''}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          card.cap > 0 && card.booked >= card.cap
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-100'
                            : 'bg-yellow-100 text-yellow-900 dark:bg-yellow-500/20 dark:text-yellow-100'
                        }`}
                      >
                        {card.booked}
                        {card.cap ? `/${card.cap}` : ''}
                      </span>
                    </button>
                    {open ? (
                      <div className="space-y-2 border-t border-yellow-100 px-3.5 py-3 dark:border-yellow-700/30">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full border border-yellow-300 bg-white px-3 py-1 text-[11px] font-bold text-yellow-900"
                            onClick={() => {
                              setForm((f) => ({ ...f, session_id: s.id }));
                              void copyInvite(s.id);
                            }}
                          >
                            <Share2 className="h-3 w-3" /> Join link
                          </button>
                          <a
                            href="/dashboard/fitgraph/calendar"
                            className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-600"
                          >
                            Open on calendar
                          </a>
                        </div>
                        {card.roster.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            Nobody on this class yet. Add a member above.
                          </p>
                        ) : (
                          <ul className="divide-y divide-yellow-100 dark:divide-yellow-800/40">
                            {card.roster.map((b) => {
                              const client = store.clients.find(
                                (c) => c.id === b.client_id
                              );
                              return (
                                <li
                                  key={b.id}
                                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                                >
                                  <div>
                                    <p className="font-bold text-slate-900 dark:text-yellow-50">
                                      {client?.name ||
                                        b.guest_name ||
                                        b.family_member_name ||
                                        'Member'}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      {client?.code || ''} · {b.status}
                                      {b.family_member_name
                                        ? ` · ${b.family_member_name}`
                                        : ''}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {b.status === 'booked' ||
                                    b.status === 'waitlist' ? (
                                      <>
                                        <button
                                          type="button"
                                          className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-black text-white"
                                          onClick={() =>
                                            void mark(b.id, 'attended')
                                          }
                                        >
                                          Attended
                                        </button>
                                        <button
                                          type="button"
                                          className="rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-black text-white"
                                          onClick={() =>
                                            void mark(b.id, 'no_show')
                                          }
                                        >
                                          No-show
                                        </button>
                                      </>
                                    ) : null}
                                    {b.status === 'attended' &&
                                    b.feedback_token &&
                                    !b.feedback_submitted_at ? (
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1 rounded-full border border-yellow-300 px-2.5 py-1 text-[11px] font-bold text-yellow-800"
                                        onClick={() =>
                                          void copyFeedback(b.feedback_token!)
                                        }
                                      >
                                        <Copy className="h-3 w-3" /> Feedback
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-500"
                                      onClick={() =>
                                        void post({
                                          entity: 'bookings',
                                          action: 'delete',
                                          id: b.id,
                                        })
                                      }
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

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
                  const client = store.clients.find((c) => c.id === b.client_id);
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
                        <Copy className="w-3 h-3" /> Copy feedback link
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
