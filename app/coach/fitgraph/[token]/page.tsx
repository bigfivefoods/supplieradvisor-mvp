'use client';

/**
 * Coach portal — week calendar of planned classes, create bespoke/repeat
 * sessions, plan roster (who is coming) + actual (who came / no-show).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Plus,
  Repeat,
  Share2,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { addDaysIso } from '@/lib/fitness/fitgraph';

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

type PortalSession = {
  session: {
    id: string;
    date: string;
    start_time: string;
    location?: string;
    capacity?: number | null;
    public?: boolean;
    status: string;
    series_id?: string | null;
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
  coach: { id: string; code: string; name: string; can_manage_classes?: boolean };
  from: string;
  to: string;
  sessions: PortalSession[];
  by_date: Record<string, PortalSession[]>;
  members: Array<{ id: string; code: string; name: string }>;
  class_types: Array<{
    id: string;
    code: string;
    name: string;
    capacity?: number | null;
  }>;
};

const WEEKDAYS = [
  { v: 1, l: 'M' },
  { v: 2, l: 'T' },
  { v: 3, l: 'W' },
  { v: 4, l: 'T' },
  { v: 5, l: 'F' },
  { v: 6, l: 'S' },
  { v: 0, l: 'S' },
];

function mondayOf(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const day = d.getDay();
  const monOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + monOffset);
  return d.toISOString().slice(0, 10);
}

export default function CoachFitgraphPortalPage() {
  const { token } = useParams() as { token: string };
  const [portal, setPortal] = useState<Portal | null>(null);
  const [brand, setBrand] = useState('Gym');
  const [publicToken, setPublicToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [weekStart, setWeekStart] = useState(() =>
    mondayOf(new Date().toISOString().slice(0, 10))
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [guestFor, setGuestFor] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [memberFor, setMemberFor] = useState('');
  const [create, setCreate] = useState({
    class_type_id: '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '06:00',
    location: '',
    capacity: '',
    class_plan: '',
    repeat: 'none' as 'none' | 'weekly',
    count: '8',
    weekdays: [] as number[],
    public: false,
  });
  const [classPlanDraft, setClassPlanDraft] = useState('');

  const weekEnd = useMemo(() => addDaysIso(weekStart, 6), [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)),
    [weekStart]
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({
        token,
        from: weekStart,
        to: weekEnd,
      });
      const res = await fetch(`/api/public/fitgraph/coach?${q}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPortal(data.portal);
      setBrand(data.brand || 'Gym');
      setPublicToken(data.public_token);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token, weekStart, weekEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/public/fitgraph/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      if (data.portal) setPortal(data.portal);
      if (data.public_token) setPublicToken(data.public_token);
      return data;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const openCard = portal?.sessions.find((s) => s.session.id === openId);

  useEffect(() => {
    if (openCard) {
      setClassPlanDraft(openCard.session.class_plan || '');
    }
  }, [openCard?.session.id, openCard?.session.class_plan]);

  if (loading && !portal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (error && !portal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <p className="text-rose-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!portal) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <header className="border-b border-slate-800 px-4 py-4 sm:px-6 sticky top-0 z-20 bg-slate-950/95 backdrop-blur">
        <div className="max-w-3xl mx-auto">
          <div className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            Coach calendar · {brand}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
            <h1 className="text-xl font-black">{portal.coach.name}</h1>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1 rounded-full bg-amber-500 text-amber-950 px-3 py-1.5 text-xs font-black"
            >
              <Plus className="w-3.5 h-3.5" /> New class
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Plan who is coming · update actuals after (or before) class ·
            bespoke or weekly series
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              className="p-2 rounded-xl border border-slate-700"
              onClick={() => setWeekStart(addDaysIso(weekStart, -7))}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold tabular-nums flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
              {weekStart} → {weekEnd}
            </span>
            <button
              type="button"
              className="p-2 rounded-xl border border-slate-700"
              onClick={() => setWeekStart(addDaysIso(weekStart, 7))}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {publicToken && (
              <button
                type="button"
                className="ml-auto text-[10px] font-bold text-violet-300 inline-flex items-center gap-1"
                onClick={() => {
                  const url = `${window.location.origin}/embed/fitgraph/${encodeURIComponent(publicToken)}`;
                  void navigator.clipboard.writeText(url);
                }}
              >
                <Copy className="w-3 h-3" /> Gym calendar link
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 py-4 sm:px-6 space-y-3">
        {error && (
          <div className="rounded-2xl border border-rose-900/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {days.map((d) => {
            const list = portal.by_date?.[d] || [];
            const label = new Date(d + 'T12:00:00').toLocaleDateString(
              undefined,
              { weekday: 'short', day: 'numeric' }
            );
            return (
              <div
                key={d}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2 min-h-[6.5rem]"
              >
                <div className="text-[10px] font-black uppercase text-amber-400/90 mb-1.5">
                  {label}
                </div>
                <div className="space-y-1">
                  {list.length === 0 ? (
                    <p className="text-[10px] text-slate-600 text-center py-3">—</p>
                  ) : (
                    list.map((card) => (
                      <button
                        key={card.session.id}
                        type="button"
                        onClick={() => setOpenId(card.session.id)}
                        className="w-full text-left rounded-xl border border-slate-700 bg-slate-950/60 px-2 py-1.5 hover:border-amber-500/60"
                      >
                        <div className="text-[11px] font-black tabular-nums text-amber-200">
                          {card.session.start_time}
                        </div>
                        <div className="text-[10px] font-semibold truncate">
                          {card.class_name || 'Class'}
                        </div>
                        <div className="text-[9px] text-slate-500 flex gap-1 items-center">
                          <span>
                            P{card.planned}/{card.capacity}
                          </span>
                          <span>A{card.attended}</span>
                          {card.session.series_id ? (
                            <Repeat className="w-2.5 h-2.5 text-amber-500" />
                          ) : null}
                        </div>
                        {card.session.class_plan ? (
                          <p className="text-[9px] text-amber-200/80 line-clamp-2 mt-0.5">
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

        {portal.sessions.length === 0 && (
          <p className="text-center text-slate-500 py-10 text-sm">
            No classes this week. Tap <strong>New class</strong> for a bespoke
            session or weekly series.
          </p>
        )}
      </main>

      {/* Session detail */}
      {openCard && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 space-y-4">
            <div className="flex justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  {openCard.session.date} · {openCard.session.start_time}
                  {openCard.session.series_id ? ' · series' : ' · bespoke'}
                </p>
                <h3 className="text-lg font-black">
                  {openCard.class_name || 'Class'}
                </h3>
                <p className="text-xs text-slate-400">
                  {openCard.session.location || '—'} · Plan {openCard.planned}/
                  {openCard.capacity} · Actual attended {openCard.attended} ·
                  no-show {openCard.no_show}
                </p>
              </div>
              <button type="button" onClick={() => setOpenId(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-600 px-2.5 py-1.5 text-[11px] font-bold"
                onClick={() =>
                  void post({
                    action: 'share_session',
                    session_id: openCard.session.id,
                    public: !openCard.session.public,
                  })
                }
              >
                <Share2 className="w-3 h-3" />
                {openCard.session.public ? 'Unshare' : 'Share publicly'}
              </button>
              <button
                type="button"
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-2.5 py-1.5 text-[11px] font-bold"
                onClick={() => {
                  setGuestFor(openCard.session.id);
                  setGuestName('');
                }}
              >
                <UserPlus className="w-3 h-3" /> Walk-in guest
              </button>
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-400 mb-1">
                Class plan · activities
              </h4>
              <p className="text-[10px] text-slate-500 mb-1.5">
                What you will do — members and other coaches can see this.
              </p>
              <textarea
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[5rem] resize-y"
                placeholder={
                  'e.g.\n• Warm-up 5 min\n• Strength circuit\n• HIIT finisher\n• Stretch'
                }
                value={classPlanDraft}
                onChange={(e) => setClassPlanDraft(e.target.value)}
              />
              <button
                type="button"
                disabled={busy}
                className="mt-2 rounded-xl bg-amber-500 text-amber-950 px-3 py-1.5 text-xs font-black"
                onClick={() =>
                  void post({
                    action: 'update_session',
                    session_id: openCard.session.id,
                    class_plan: classPlanDraft,
                  }).then(() => void load())
                }
              >
                {busy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                ) : null}{' '}
                Save class plan
              </button>
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Who is coming · update actual
              </h4>
              {openCard.roster.length === 0 ? (
                <p className="text-sm text-slate-500">Nobody on the plan yet.</p>
              ) : (
                <ul className="space-y-2">
                  {openCard.roster.map((r) => (
                    <li
                      key={r.booking_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-bold">{r.name}</div>
                        <div className="text-[10px] uppercase text-slate-500">
                          Plan {r.status} · Actual{' '}
                          {r.actual === 'pending' ? '—' : r.actual}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          className={`p-1.5 rounded-lg border text-xs ${
                            r.actual === 'attended'
                              ? 'bg-emerald-600 border-emerald-600'
                              : 'border-slate-600'
                          }`}
                          title="Attended"
                          onClick={() =>
                            void post({
                              action: 'mark_attendance',
                              booking_id: r.booking_id,
                              status: 'attended',
                            })
                          }
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className={`p-1.5 rounded-lg border text-xs ${
                            r.actual === 'no_show'
                              ? 'bg-rose-600 border-rose-600'
                              : 'border-slate-600'
                          }`}
                          title="No-show"
                          onClick={() =>
                            void post({
                              action: 'mark_attendance',
                              booking_id: r.booking_id,
                              status: 'no_show',
                            })
                          }
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="px-2 py-1 rounded-lg border border-slate-600 text-[10px] font-bold"
                          onClick={() =>
                            void post({
                              action: 'mark_attendance',
                              booking_id: r.booking_id,
                              status: 'booked',
                            })
                          }
                        >
                          Plan
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2 items-end border-t border-slate-800 pt-3">
              <select
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={memberFor}
                onChange={(e) => setMemberFor(e.target.value)}
              >
                <option value="">Add member to plan…</option>
                {portal.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} · {m.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !memberFor}
                className="rounded-xl bg-amber-500 text-amber-950 px-3 py-2 text-xs font-black"
                onClick={() =>
                  void post({
                    action: 'book_member',
                    session_id: openCard.session.id,
                    client_id: memberFor,
                  }).then(() => setMemberFor(''))
                }
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create class */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex justify-between">
              <h3 className="font-black">New class</h3>
              <button type="button" onClick={() => setShowCreate(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={create.class_type_id}
              onChange={(e) =>
                setCreate((f) => ({ ...f, class_type_id: e.target.value }))
              }
            >
              <option value="">Class type…</option>
              {portal.class_types.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={create.date}
                onChange={(e) =>
                  setCreate((f) => ({ ...f, date: e.target.value }))
                }
              />
              <input
                type="time"
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={create.start_time}
                onChange={(e) =>
                  setCreate((f) => ({ ...f, start_time: e.target.value }))
                }
              />
            </div>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Room"
              value={create.location}
              onChange={(e) =>
                setCreate((f) => ({ ...f, location: e.target.value }))
              }
            />
            <textarea
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[4rem] resize-y"
              placeholder="Class plan / activities (members & coaches see this)"
              value={create.class_plan}
              onChange={(e) =>
                setCreate((f) => ({ ...f, class_plan: e.target.value }))
              }
            />
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 rounded-xl py-2 text-xs font-bold border ${
                  create.repeat === 'none'
                    ? 'bg-amber-500 text-amber-950 border-amber-500'
                    : 'border-slate-600'
                }`}
                onClick={() => setCreate((f) => ({ ...f, repeat: 'none' }))}
              >
                Bespoke
              </button>
              <button
                type="button"
                className={`flex-1 rounded-xl py-2 text-xs font-bold border inline-flex items-center justify-center gap-1 ${
                  create.repeat === 'weekly'
                    ? 'bg-amber-500 text-amber-950 border-amber-500'
                    : 'border-slate-600'
                }`}
                onClick={() => setCreate((f) => ({ ...f, repeat: 'weekly' }))}
              >
                <Repeat className="w-3 h-3" /> Weekly
              </button>
            </div>
            {create.repeat === 'weekly' && (
              <>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map((w) => {
                    const on = create.weekdays.includes(w.v);
                    return (
                      <button
                        key={w.v}
                        type="button"
                        className={`w-8 h-8 rounded-lg text-[10px] font-bold border ${
                          on
                            ? 'bg-amber-500 text-amber-950 border-amber-500'
                            : 'border-slate-600'
                        }`}
                        onClick={() =>
                          setCreate((f) => ({
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
                  type="number"
                  min={1}
                  max={52}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Weeks"
                  value={create.count}
                  onChange={(e) =>
                    setCreate((f) => ({ ...f, count: e.target.value }))
                  }
                />
              </>
            )}
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={create.public}
                onChange={(e) =>
                  setCreate((f) => ({ ...f, public: e.target.checked }))
                }
              />
              Publish on public calendar
            </label>
            <button
              type="button"
              disabled={busy || !create.class_type_id}
              className="w-full rounded-xl bg-amber-500 text-amber-950 py-2.5 text-sm font-black"
              onClick={() =>
                void post({
                  action:
                    create.repeat === 'weekly'
                      ? 'create_series'
                      : 'create_session',
                  class_type_id: create.class_type_id,
                  date: create.date,
                  start_time: create.start_time,
                  location: create.location || undefined,
                  capacity: create.capacity
                    ? Number(create.capacity)
                    : undefined,
                  class_plan: create.class_plan.trim() || undefined,
                  public: create.public,
                  count: Number(create.count) || 8,
                  weekdays:
                    create.weekdays.length > 0
                      ? create.weekdays
                      : [new Date(create.date + 'T12:00:00').getDay()],
                }).then(() => {
                  setShowCreate(false);
                  setCreate((f) => ({ ...f, class_plan: '' }));
                  void load();
                })
              }
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin inline" />
              ) : null}{' '}
              Create
            </button>
          </div>
        </div>
      )}

      {guestFor && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-black">Walk-in / guest on plan</h3>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Name *"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm font-bold"
                onClick={() => setGuestFor(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !guestName.trim()}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-bold"
                onClick={() =>
                  void post({
                    action: 'book_guest',
                    session_id: guestFor,
                    name: guestName.trim(),
                  }).then(() => setGuestFor(null))
                }
              >
                Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
