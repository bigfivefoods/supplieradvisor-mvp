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
  MessageSquare,
  Plus,
  Repeat,
  Send,
  Share2,
  User,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { addDaysIso } from '@/lib/fitness/fitgraph';
import { FitClassFeedbackForm } from '@/components/fitness/FitClassFeedbackForm';
import type { PersonHealthProfile } from '@/lib/health/body-map';
import {
  InjuryProfileFields,
  formToHealthPayload,
  healthToForm,
  type InjuryFormState,
} from '@/components/health/InjuryProfileFields';

type RosterRow = {
  booking_id: string;
  client_id: string;
  status: string;
  plan: boolean;
  actual: 'pending' | 'attended' | 'no_show' | 'cancelled';
  name: string;
  email?: string;
  phone?: string;
  health?: PersonHealthProfile;
  injured?: boolean;
  health_label?: string;
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
  feedback_summary?: {
    member_count: number;
    coach_count: number;
    avg_feeling: number | null;
    avg_intensity: number | null;
    avg_enjoyment: number | null;
  };
  my_feedback?: {
    id: string;
    feeling: number;
    intensity: number;
    enjoyment?: number;
    would_return?: number;
    comment?: string;
    tags?: string[];
  } | null;
  member_feedback?: Array<{
    id: string;
    author_name?: string;
    feeling: number;
    intensity: number;
    enjoyment?: number;
    comment?: string;
  }>;
};

type Portal = {
  coach: {
    id: string;
    code: string;
    name: string;
    email?: string;
    phone?: string;
    specialties?: string[];
    bio?: string;
    public_bio?: string;
    photo_url?: string;
    color?: string;
    can_manage_classes?: boolean;
    start_date?: string;
    end_date?: string;
    rate_zar?: number | null;
    rate_basis?: string;
    rate_note?: string;
    active?: boolean;
    history?: Array<{
      id: string;
      start_date: string;
      end_date: string;
      note?: string;
      ended_reason?: string;
      rate_zar?: number | null;
      rate_basis?: string;
    }>;
  };
  specialty_options?: string[];
  from: string;
  to: string;
  sessions: PortalSession[];
  by_date: Record<string, PortalSession[]>;
  members: Array<{
    id: string;
    code: string;
    name: string;
    email?: string;
    phone?: string;
    emergency_contact?: string;
    notes?: string;
    membership_status?: string;
    coach_id?: string | null;
    health?: PersonHealthProfile;
  }>;
  class_types: Array<{
    id: string;
    code: string;
    name: string;
    capacity?: number | null;
  }>;
  threads?: Array<{
    id: string;
    channel: string;
    subject: string;
    updated_at: string;
    preview: string;
    unread: number;
    participants: Array<{ role: string; ref_id: string; name: string }>;
    messages: Array<{
      id: string;
      body: string;
      author_role: string;
      author_ref_id: string;
      author_name: string;
      created_at: string;
    }>;
  }>;
  messages_unread?: number;
  peer_coaches?: Array<{ id: string; code: string; name: string }>;
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
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
    public_bio: '',
    photo_url: '',
    specialties: [] as string[],
  });
  const [memberEdit, setMemberEdit] = useState<{
    id: string;
    code: string;
    name: string;
    email: string;
    phone: string;
    emergency_contact: string;
    notes: string;
    health: InjuryFormState;
  } | null>(null);
  const [showMessages, setShowMessages] = useState(false);
  const [msgThreadId, setMsgThreadId] = useState<string | null>(null);
  const [msgReply, setMsgReply] = useState('');
  const [msgCompose, setMsgCompose] = useState(false);
  const [msgTo, setMsgTo] = useState<'member' | 'desk' | 'coach'>('member');
  const [msgTargetId, setMsgTargetId] = useState('');
  const [msgBody, setMsgBody] = useState('');

  const openMemberEdit = (m: {
    id: string;
    code?: string;
    name: string;
    email?: string;
    phone?: string;
    emergency_contact?: string;
    notes?: string;
    health?: PersonHealthProfile;
  }) => {
    if (!m.id || m.id.startsWith('guest')) return;
    setMemberEdit({
      id: m.id,
      code: m.code || '',
      name: m.name || '',
      email: m.email || '',
      phone: m.phone || '',
      emergency_contact: m.emergency_contact || '',
      notes: m.notes || '',
      health: healthToForm(m.health),
    });
  };

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
      const c = data.portal?.coach;
      if (c) {
        setProfile({
          name: c.name || '',
          email: c.email || '',
          phone: c.phone || '',
          bio: c.bio || '',
          public_bio: c.public_bio || '',
          photo_url: c.photo_url || '',
          specialties: Array.isArray(c.specialties)
            ? [...c.specialties]
            : [],
        });
      }
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
            <div className="flex items-center gap-2 min-w-0">
              {portal.coach.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={portal.coach.photo_url}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover border border-amber-500/40 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-amber-400" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-xl font-black truncate">
                  {portal.coach.name}
                </h1>
                {(portal.coach.specialties || []).length > 0 && (
                  <p className="text-[10px] text-amber-200/80 truncate">
                    {(portal.coach.specialties || []).join(' · ')}
                  </p>
                )}
                {(portal.coach.start_date || portal.coach.end_date) && (
                  <p className="text-[10px] text-slate-400 truncate">
                    Tenure:{' '}
                    {portal.coach.start_date || '—'}
                    {portal.coach.end_date
                      ? ` → ${portal.coach.end_date}`
                      : ' → present'}
                    {portal.coach.active === false || portal.coach.end_date
                      ? ' · ended'
                      : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setShowProfile(true)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-600 px-3 py-1.5 text-xs font-bold"
              >
                <User className="w-3.5 h-3.5" /> My profile
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMessages(true);
                  setMsgCompose(false);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-sky-700/50 bg-sky-950/40 px-3 py-1.5 text-xs font-bold text-sky-100"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Messages
                {(portal.messages_unread || 0) > 0 ? (
                  <span className="rounded-full bg-rose-500 text-white text-[9px] font-black px-1.5">
                    {portal.messages_unread}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!portal.members.length) {
                    setError(
                      'No members yet — book a guest or ask the desk to add clients.'
                    );
                    return;
                  }
                  // Prefer injured members first so coaches act on them
                  const injured = portal.members.find(
                    (m) =>
                      m.health?.injured ||
                      (m.health?.injury_areas || []).length > 0
                  );
                  openMemberEdit(injured || portal.members[0]);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-rose-700/60 bg-rose-950/40 px-3 py-1.5 text-xs font-bold text-rose-100"
              >
                <UserPlus className="w-3.5 h-3.5" /> Member health
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500 text-amber-950 px-3 py-1.5 text-xs font-black"
              >
                <Plus className="w-3.5 h-3.5" /> New class
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Bio · messages · member injury notes · plan classes · mark who came
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
              <button
                type="button"
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-xl border border-amber-500/50 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-200"
                onClick={() =>
                  void post({
                    action: 'issue_class_invite',
                    session_id: openCard.session.id,
                  }).then(async (data) => {
                    const inv = data.invite as
                      | { path?: string; text?: string }
                      | undefined;
                    if (!inv?.path) return;
                    const url = `${window.location.origin}${inv.path}`;
                    await navigator.clipboard.writeText(
                      `${inv.text || 'Join class'}\n${url}`
                    );
                  })
                }
              >
                <Share2 className="w-3 h-3" /> Copy join link
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
                  {openCard.roster.map((r) => {
                    const member = portal.members.find(
                      (m) => m.id === r.client_id
                    );
                    return (
                    <li
                      key={r.booking_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="text-sm font-bold text-left hover:text-amber-300"
                          title="Edit member profile & injury notes"
                          onClick={() =>
                            openMemberEdit({
                              id: r.client_id,
                              code: member?.code,
                              name: r.name,
                              email: r.email || member?.email,
                              phone: r.phone || member?.phone,
                              emergency_contact: member?.emergency_contact,
                              notes: member?.notes,
                              health: r.health || member?.health,
                            })
                          }
                        >
                          {r.name}
                        </button>
                        <div className="text-[10px] uppercase text-slate-500">
                          Plan {r.status} · Actual{' '}
                          {r.actual === 'pending' ? '—' : r.actual}
                        </div>
                        {(r.injured || r.health_label) && (
                          <div
                            className="mt-0.5 text-[10px] font-bold text-rose-300/90"
                            title={
                              r.health?.training_modifications ||
                              r.health?.injury_notes ||
                              ''
                            }
                          >
                            ⚠ {r.health_label || 'Injured — tap name to update'}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          className="p-1.5 rounded-lg border border-slate-600 text-xs"
                          title="Health profile"
                          onClick={() =>
                            openMemberEdit({
                              id: r.client_id,
                              code: member?.code,
                              name: r.name,
                              email: r.email || member?.email,
                              phone: r.phone || member?.phone,
                              emergency_contact: member?.emergency_contact,
                              notes: member?.notes,
                              health: r.health || member?.health,
                            })
                          }
                        >
                          <User className="w-3.5 h-3.5" />
                        </button>
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
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Coach post-class feedback + member pulse */}
            <div className="border-t border-slate-800 pt-3 space-y-3">
              {openCard.feedback_summary &&
                openCard.feedback_summary.member_count > 0 && (
                  <div className="rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-300">
                    <span className="font-bold text-amber-300">
                      Member feedback
                    </span>
                    : {openCard.feedback_summary.member_count} · avg feel{' '}
                    {openCard.feedback_summary.avg_feeling ?? '—'} · intensity{' '}
                    {openCard.feedback_summary.avg_intensity ?? '—'}
                    {(openCard.member_feedback || []).length > 0 && (
                      <ul className="mt-1.5 space-y-1 text-slate-400">
                        {(openCard.member_feedback || []).slice(0, 5).map((f) => (
                          <li key={f.id}>
                            {f.author_name || 'Member'}: feel {f.feeling}/5 · RPE{' '}
                            {f.intensity}
                            {f.comment ? ` — ${f.comment}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              <FitClassFeedbackForm
                key={openCard.session.id + (openCard.my_feedback?.id || 'new')}
                role="coach"
                dark
                initial={openCard.my_feedback}
                busy={busy}
                title={
                  openCard.my_feedback
                    ? 'Update your coach check-in'
                    : 'After you trained this class'
                }
                description="How you feel after teaching, and how intense the session was. Owner sees this with member scores."
                onSubmit={async (v) => {
                  await post({
                    action: 'coach_feedback',
                    session_id: openCard.session.id,
                    feeling: v.feeling,
                    intensity: v.intensity,
                    enjoyment: v.enjoyment,
                    would_return: v.would_return,
                    comment: v.comment || undefined,
                    tags: v.tags,
                  });
                }}
              />
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

      {/* Coach profile self-edit */}
      {showProfile && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-black">My coach profile</h3>
              <button type="button" onClick={() => setShowProfile(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Members see your public bio and specialties on the gym calendar.
              Keep contact details up to date. Engagement dates are set by the
              gym owner.
            </p>
            {(portal.coach.start_date ||
              portal.coach.end_date ||
              portal.coach.rate_zar != null ||
              (portal.coach.history || []).length > 0) && (
              <div className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-300 space-y-1">
                <div className="font-bold text-amber-300/90 text-[10px] uppercase tracking-wider">
                  Engagement & rate (read-only)
                </div>
                <div>
                  Current:{' '}
                  {portal.coach.start_date || '—'}
                  {portal.coach.end_date
                    ? ` → ${portal.coach.end_date}`
                    : ' → present'}
                </div>
                {portal.coach.rate_zar != null && (
                  <div>
                    Rate: R{Number(portal.coach.rate_zar).toLocaleString('en-ZA')}
                    {portal.coach.rate_basis
                      ? ` / ${String(portal.coach.rate_basis).replace(/_/g, ' ')}`
                      : ''}
                    {portal.coach.rate_note
                      ? ` · ${portal.coach.rate_note}`
                      : ''}
                  </div>
                )}
                {(portal.coach.history || []).length > 0 && (
                  <ul className="space-y-0.5 text-slate-400">
                    {(portal.coach.history || []).map((h) => (
                      <li key={h.id}>
                        Prior: {h.start_date} → {h.end_date}
                        {h.rate_zar != null
                          ? ` · R${Number(h.rate_zar).toLocaleString('en-ZA')}${
                              h.rate_basis
                                ? ` / ${String(h.rate_basis).replace(/_/g, ' ')}`
                                : ''
                            }`
                          : ''}
                        {h.note ? ` — ${h.note}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Display name"
              value={profile.name}
              onChange={(e) =>
                setProfile((p) => ({ ...p, name: e.target.value }))
              }
            />
            <input
              type="email"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Email"
              value={profile.email}
              onChange={(e) =>
                setProfile((p) => ({ ...p, email: e.target.value }))
              }
            />
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Phone"
              value={profile.phone}
              onChange={(e) =>
                setProfile((p) => ({ ...p, phone: e.target.value }))
              }
            />
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Photo URL (https://…)"
              value={profile.photo_url}
              onChange={(e) =>
                setProfile((p) => ({ ...p, photo_url: e.target.value }))
              }
            />
            <div>
              <p className="text-[10px] font-black uppercase text-amber-400 mb-1.5">
                Specialties
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(portal.specialty_options || []).map((s) => {
                  const on = profile.specialties.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        on
                          ? 'bg-amber-500 text-amber-950 border-amber-500'
                          : 'border-slate-600 text-slate-300'
                      }`}
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          specialties: on
                            ? p.specialties.filter((x) => x !== s)
                            : [...p.specialties, s],
                        }))
                      }
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-amber-400 mb-1">
                Public bio (website & members)
              </p>
              <textarea
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[4.5rem] resize-y"
                placeholder="Short bio members see on the public calendar…"
                value={profile.public_bio}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, public_bio: e.target.value }))
                }
              />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-amber-400 mb-1">
                Full bio / notes (for gym office)
              </p>
              <textarea
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[3.5rem] resize-y"
                placeholder="Certifications, experience, availability notes…"
                value={profile.bio}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, bio: e.target.value }))
                }
              />
            </div>
            <button
              type="button"
              disabled={busy || !profile.name.trim()}
              className="w-full rounded-xl bg-amber-500 text-amber-950 py-2.5 text-sm font-black disabled:opacity-50"
              onClick={() =>
                void post({
                  action: 'update_profile',
                  name: profile.name.trim(),
                  email: profile.email.trim() || null,
                  phone: profile.phone.trim() || null,
                  bio: profile.bio,
                  public_bio: profile.public_bio,
                  photo_url: profile.photo_url.trim() || null,
                  specialties: profile.specialties.length
                    ? profile.specialties
                    : ['General'],
                }).then(() => {
                  setShowProfile(false);
                  void load();
                })
              }
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin inline" />
              ) : null}{' '}
              Save profile
            </button>
          </div>
        </div>
      )}

      {/* Coach messages — members, desk, peer coaches */}
      {showMessages && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-lg max-h-[92dvh] overflow-hidden flex flex-col rounded-3xl border border-slate-700 bg-slate-900">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-700">
              <div>
                <h3 className="font-black flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-sky-400" /> Messages
                </h3>
                <p className="text-[10px] text-slate-400">
                  Members · desk · fellow coaches
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="rounded-full bg-sky-500 text-sky-950 px-2.5 py-1 text-[11px] font-black"
                  onClick={() => setMsgCompose((v) => !v)}
                >
                  <Plus className="w-3 h-3 inline" /> New
                </button>
                <button type="button" onClick={() => setShowMessages(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {msgCompose ? (
              <div className="p-4 space-y-2 border-b border-slate-800 overflow-y-auto">
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ['member', 'Member'],
                      ['desk', 'Front desk'],
                      ['coach', 'Coach colleague'],
                    ] as const
                  ).map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setMsgTo(k);
                        setMsgTargetId('');
                      }}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                        msgTo === k
                          ? 'bg-sky-500 text-sky-950 border-sky-500'
                          : 'border-slate-600 text-slate-300'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                {msgTo === 'member' && (
                  <select
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={msgTargetId}
                    onChange={(e) => setMsgTargetId(e.target.value)}
                  >
                    <option value="">Member…</option>
                    {portal.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} · {m.name}
                      </option>
                    ))}
                  </select>
                )}
                {msgTo === 'coach' && (
                  <select
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={msgTargetId}
                    onChange={(e) => setMsgTargetId(e.target.value)}
                  >
                    <option value="">Coach…</option>
                    {(portal.peer_coaches || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                <textarea
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[4rem]"
                  placeholder="Message…"
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                />
                <button
                  type="button"
                  disabled={
                    busy ||
                    !msgBody.trim() ||
                    (msgTo !== 'desk' && !msgTargetId)
                  }
                  className="w-full rounded-xl bg-sky-500 text-sky-950 py-2 text-sm font-black disabled:opacity-50"
                  onClick={() => {
                    const payload: Record<string, unknown> = {
                      action: 'message_create_thread',
                      body: msgBody.trim(),
                      from: weekStart,
                      to: weekEnd,
                    };
                    if (msgTo === 'member') {
                      payload.client_id = msgTargetId;
                      payload.channel = 'coach_member';
                    } else if (msgTo === 'desk') {
                      payload.to_desk = true;
                      payload.channel = 'desk_coach';
                    } else {
                      payload.coach_id = msgTargetId;
                      payload.channel = 'colleague';
                    }
                    void post(payload).then((data) => {
                      setMsgCompose(false);
                      setMsgBody('');
                      setMsgTargetId('');
                      if (data?.thread?.id) setMsgThreadId(String(data.thread.id));
                      void load();
                    });
                  }}
                >
                  <Send className="w-3.5 h-3.5 inline" /> Send
                </button>
              </div>
            ) : null}

            <div className="flex-1 grid sm:grid-cols-[200px_1fr] min-h-0 overflow-hidden">
              <div className="border-b sm:border-b-0 sm:border-r border-slate-800 max-h-40 sm:max-h-none overflow-y-auto">
                {(portal.threads || []).length === 0 ? (
                  <p className="p-3 text-[11px] text-slate-500">
                    No threads yet. Message a member or the desk.
                  </p>
                ) : (
                  (portal.threads || []).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setMsgThreadId(t.id);
                        void post({
                          action: 'message_mark_read',
                          thread_id: t.id,
                          from: weekStart,
                          to: weekEnd,
                        }).then(() => void load());
                      }}
                      className={`w-full text-left px-3 py-2.5 border-b border-slate-800/80 ${
                        msgThreadId === t.id ? 'bg-slate-800' : ''
                      }`}
                    >
                      <div className="text-[12px] font-bold truncate">
                        {t.subject}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {t.preview}
                      </div>
                      {t.unread > 0 ? (
                        <span className="text-[9px] font-black text-rose-400">
                          {t.unread} new
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
              <div className="flex flex-col min-h-[220px] max-h-[50vh]">
                {(() => {
                  const thr =
                    (portal.threads || []).find((t) => t.id === msgThreadId) ||
                    (portal.threads || [])[0];
                  if (!thr) {
                    return (
                      <p className="p-4 text-sm text-slate-500">
                        Select a conversation
                      </p>
                    );
                  }
                  return (
                    <>
                      <div className="px-3 py-2 border-b border-slate-800 text-xs font-bold">
                        {thr.subject}
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {thr.messages.map((m) => {
                          const mine = m.author_ref_id === portal.coach.id;
                          return (
                            <div
                              key={m.id}
                              className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[90%] rounded-2xl px-2.5 py-1.5 text-[12px] ${
                                  mine
                                    ? 'bg-sky-600 text-white'
                                    : 'bg-slate-800 text-slate-100'
                                }`}
                              >
                                <div className="text-[9px] opacity-70 mb-0.5">
                                  {m.author_name}
                                </div>
                                <div className="whitespace-pre-wrap">
                                  {m.body}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="p-2 border-t border-slate-800 flex gap-2">
                        <input
                          className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                          placeholder="Reply…"
                          value={msgReply}
                          onChange={(e) => setMsgReply(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && msgReply.trim()) {
                              void post({
                                action: 'message_post',
                                thread_id: thr.id,
                                body: msgReply.trim(),
                                from: weekStart,
                                to: weekEnd,
                              }).then(() => {
                                setMsgReply('');
                                void load();
                              });
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={busy || !msgReply.trim()}
                          className="rounded-xl bg-sky-500 text-sky-950 px-3 py-2 disabled:opacity-50"
                          onClick={() =>
                            void post({
                              action: 'message_post',
                              thread_id: thr.id,
                              body: msgReply.trim(),
                              from: weekStart,
                              to: weekEnd,
                            }).then(() => {
                              setMsgReply('');
                              void load();
                            })
                          }
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Member profile + injury awareness (coach can update) */}
      {memberEdit && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-black">Member profile</h3>
              <button type="button" onClick={() => setMemberEdit(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Update contact details and injury / recovery notes so you and other
              coaches know where they are injured and how to help them improve
              safely.
            </p>
            <div>
              <p className="text-[10px] font-black uppercase text-amber-400 mb-1">
                Pick member
              </p>
              <select
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={memberEdit.id}
                onChange={(e) => {
                  const m = portal.members.find((x) => x.id === e.target.value);
                  if (m) openMemberEdit(m);
                }}
              >
                {portal.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} · {m.name}
                    {m.health?.injured ||
                    (m.health?.injury_areas || []).length
                      ? ' ⚠'
                      : ''}
                  </option>
                ))}
              </select>
            </div>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Name"
              value={memberEdit.name}
              onChange={(e) =>
                setMemberEdit((f) =>
                  f ? { ...f, name: e.target.value } : f
                )
              }
            />
            <input
              type="email"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Email"
              value={memberEdit.email}
              onChange={(e) =>
                setMemberEdit((f) =>
                  f ? { ...f, email: e.target.value } : f
                )
              }
            />
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Phone"
              value={memberEdit.phone}
              onChange={(e) =>
                setMemberEdit((f) =>
                  f ? { ...f, phone: e.target.value } : f
                )
              }
            />
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Emergency contact"
              value={memberEdit.emergency_contact}
              onChange={(e) =>
                setMemberEdit((f) =>
                  f ? { ...f, emergency_contact: e.target.value } : f
                )
              }
            />
            <textarea
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[2.5rem] resize-y"
              placeholder="Coach / desk notes"
              value={memberEdit.notes}
              onChange={(e) =>
                setMemberEdit((f) =>
                  f ? { ...f, notes: e.target.value } : f
                )
              }
            />
            <InjuryProfileFields
              dark
              variant="coach"
              value={memberEdit.health}
              onChange={(health) =>
                setMemberEdit((f) => (f ? { ...f, health } : f))
              }
            />
            <button
              type="button"
              disabled={busy || !memberEdit.name.trim()}
              className="w-full rounded-xl bg-rose-500 text-white py-2.5 text-sm font-black disabled:opacity-50"
              onClick={() => {
                const health = formToHealthPayload(memberEdit.health);
                void post({
                  action: 'update_client',
                  client_id: memberEdit.id,
                  name: memberEdit.name.trim(),
                  email: memberEdit.email.trim() || null,
                  phone: memberEdit.phone.trim() || null,
                  emergency_contact:
                    memberEdit.emergency_contact.trim() || null,
                  notes: memberEdit.notes || null,
                  health,
                  from: weekStart,
                  to: weekEnd,
                }).then(() => {
                  setMemberEdit(null);
                  void load();
                });
              }}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin inline" />
              ) : null}{' '}
              Save member profile
            </button>
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
