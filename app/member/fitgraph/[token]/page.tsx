'use client';

/**
 * GymAdvisor® member portal — registered clients book open classes,
 * see vacancies, join waitlist when full, manage their bookings.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageSquare,
  MessageSquareHeart,
  QrCode,
  Send,
  User,
  Users,
  X,
} from 'lucide-react';
import { MemberRelationshipSection } from '@/components/services/MemberRelationshipSection';
import { ProfilePhotoField } from '@/components/chrome/ProfilePhotoField';
import { PortalIdentityVerify } from '@/components/identity/PortalIdentityVerify';
import { PortalFamilyMembers } from '@/components/identity/PortalFamilyMembers';
import { VerifiedBadge } from '@/components/services/VerifiedBadge';
import { PopiaConsentNotice } from '@/components/services/PopiaConsentNotice';
import { B2cAutoLinkBanner } from '@/components/b2c/B2cAutoLinkBanner';
import { MemberAnnouncementsFeed } from '@/components/services/MemberAnnouncementsFeed';
import { MemberPortalBrandLockup } from '@/components/brand/PortalBrandLogo';
import { gymBrandColor } from '@/lib/fitness/fitgraph';
import type { MemberAnnouncementPublic } from '@/lib/services/member-announcements';

const MEMBER_TOKEN_KEY = 'sa_fitgraph_member_token';

type OpenClass = {
  id: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  duration_min?: number;
  class_name: string;
  coach_name?: string;
  location?: string;
  capacity: number;
  spots_left: number;
  full: boolean;
  public_notes?: string;
  class_plan?: string;
  my_status?: string | null;
  my_booking_id?: string | null;
};

type MyBooking = {
  booking_id: string;
  status: string;
  session_id: string;
  date: string;
  start_time: string;
  class_name: string;
  coach_name?: string;
  location?: string;
  upcoming?: boolean;
  feedback_token?: string | null;
  feedback_submitted_at?: string | null;
};

type Portal = {
  brand: string;
  bio?: string;
  timezone?: string;
  allow_booking: boolean;
  contact_email?: string;
  contact_phone?: string;
  primary_color?: string;
  logo_url?: string | null;
  from: string;
  to: string;
  client: {
    id: string;
    code: string;
    name: string;
    email?: string;
    phone?: string;
    id_number?: string;
    photo_url?: string;
    membership_status?: string;
    plan_name?: string;
    coach_name?: string;
    identity?: {
      status?: string;
      provider?: string | null;
      verified_at?: string | null;
      verified_name?: string | null;
      status_text?: string | null;
      is_verified?: boolean;
    };
    family?: Array<{
      id: string;
      name: string;
      relationship: string;
      date_of_birth?: string | null;
      id_number?: string;
      phone?: string;
      notes?: string;
      is_minor?: boolean;
      active?: boolean;
    }>;
  };
  open_classes: OpenClass[];
  vacancies: OpenClass[];
  my_bookings: MyBooking[];
  upcoming_count?: number;
  open_count: number;
  full_count: number;
  progress?: {
    attended_count?: number;
    no_show_count?: number;
    attended_30d?: number;
    check_ins_30d?: number;
    last_attended?: string | null;
    health?: {
      summary?: string | null;
      injury_status?: string | null;
      injury_areas?: string[];
      training_modifications?: string | null;
      goals?: string | null;
      pain_score?: number | null;
    } | null;
    coach_notes?: Array<{
      id: string;
      at: string;
      title: string;
      body?: string | null;
    }>;
    my_feedback?: Array<{
      id: string;
      at: string;
      class_name: string;
      date: string;
      feeling: number;
      intensity: number;
      enjoyment?: number | null;
      comment?: string | null;
      tags?: string[];
    }>;
    pending_feedback?: Array<{
      booking_id: string;
      date: string;
      class_name: string;
      feedback_token: string;
    }>;
  };
  relationship?: import('@/components/services/MemberRelationshipSection').MemberRelationshipPayload | null;
  announcements?: MemberAnnouncementPublic[];
  messages_unread?: number;
  packs?: Array<{
    id: string;
    label?: string;
    remaining: number;
    sessions_total: number;
    expires_at?: string | null;
  }>;
  gym_checkin?: {
    public_token: string;
    path: string;
    brand: string;
  } | null;
  access?: {
    level: string;
    payment_ok: boolean;
    membership_status: string;
    subscription_status: string | null;
    plan_name: string | null;
    alert: string | null;
    member_message: string;
  };
  threads?: Array<{
    id: string;
    title?: string;
    subject?: string;
    preview?: string;
    updated_at?: string;
    unread?: number;
    participants?: Array<{ role: string; ref_id: string; name: string }>;
    messages?: Array<{
      id: string;
      body: string;
      author_role: string;
      author_name: string;
      created_at: string;
    }>;
  }>;
};

export default function MemberFitgraphPortalPage() {
  const { token } = useParams() as { token: string };
  const [portal, setPortal] = useState<Portal | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<
    'checkin' | 'open' | 'mine' | 'progress' | 'messages' | 'profile'
  >('open');
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinScan, setCheckinScan] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [bookForFamilyId, setBookForFamilyId] = useState('');
  const [msgThreadId, setMsgThreadId] = useState<string | null>(null);
  const [msgReply, setMsgReply] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/fitgraph/member?token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Portal not found');
      setPortal(data.portal);
      setCompanyId(data.companyId ?? null);
      const c = data.portal?.client;
      if (c) {
        setName(c.name || '');
        setEmail(c.email || '');
        setPhone(c.phone || '');
        setIdNumber(c.id_number || '');
        setPhotoUrl(c.photo_url || '');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('tab');
    if (
      raw === 'checkin' ||
      raw === 'open' ||
      raw === 'mine' ||
      raw === 'progress' ||
      raw === 'messages' ||
      raw === 'profile'
    ) {
      setTab(raw);
    }
  }, []);

  const selectTab = (
    id: 'checkin' | 'open' | 'mine' | 'progress' | 'messages' | 'profile'
  ) => {
    setTab(id);
    setError(null);
    setMsg(null);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('tab', id);
      window.history.replaceState({}, '', `${u.pathname}${u.search}`);
    } catch {
      /* ignore */
    }
  };

  // Remember portal token for gym QR check-in page + PWA
  useEffect(() => {
    if (!token) return;
    try {
      localStorage.setItem(MEMBER_TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  }, [token]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/public/fitgraph/member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    if (data.portal) setPortal(data.portal);
    return data;
  };

  const book = async (sessionId: string, requestJoin = false) => {
    setBusyId(sessionId);
    setMsg(null);
    setError(null);
    try {
      const data = await post({
        action: requestJoin ? 'request_join' : 'book',
        session_id: sessionId,
        family_member_id: bookForFamilyId || null,
      });
      setMsg(data.booking?.message || data.message || 'Done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (bookingId: string) => {
    if (!confirm('Cancel this booking?')) return;
    setBusyId(bookingId);
    setMsg(null);
    setError(null);
    try {
      const data = await post({
        action: 'cancel',
        booking_id: bookingId,
      });
      setMsg(data.message || 'Cancelled');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  };

  const saveProfile = async () => {
    setBusyId('profile');
    setMsg(null);
    setError(null);
    try {
      const data = await post({
        action: 'update_profile',
        name,
        email,
        phone,
        id_number: idNumber,
        photo_url: photoUrl,
      });
      setMsg(data.message || 'Profile saved');
      const c = data.portal?.client;
      if (c) {
        setEmail(c.email || '');
        setIdNumber(c.id_number || '');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusyId(null);
    }
  };

  /** Check in at the door — optional gym QR token for physical presence */
  const doCheckIn = async (withGymToken?: string) => {
    setCheckinBusy(true);
    setMsg(null);
    setError(null);
    try {
      let gymToken = (withGymToken || checkinScan || '').trim();
      // Accept full check-in URL pasted from camera / QR apps
      const m = gymToken.match(/checkin\/fitgraph\/([^/?#]+)/i);
      if (m) gymToken = decodeURIComponent(m[1]);
      const data = await post({
        action: 'checkin',
        gym_token: gymToken || undefined,
      });
      setMsg(data.message || 'Checked in');
      if (data.portal) setPortal(data.portal);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Check-in failed');
    } finally {
      setCheckinBusy(false);
    }
  };

  const color = gymBrandColor(portal?.primary_color);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-600" />
      </div>
    );
  }

  if (error && !portal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center">
          <p className="font-black text-slate-900">Member portal unavailable</p>
          <p className="text-sm text-slate-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!portal) return null;

  const formatDay = (date: string, time: string) => {
    try {
      const d = new Date(`${date}T12:00:00`);
      return `${d.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })} · ${time}`;
    } catch {
      return `${date} · ${time}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-slate-50">
      <header
        className="px-4 py-6 text-white"
        style={{
          background: `linear-gradient(135deg, ${color}, #4c1d95)`,
        }}
      >
        <div className="max-w-lg mx-auto">
          <MemberPortalBrandLockup
            logoUrl={portal.logo_url}
            brand={portal.brand}
            eyebrow="Member portal · GymAdvisor®"
          />
          <div className="mt-3 flex items-center gap-3">
            {portal.client.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={portal.client.photo_url}
                alt=""
                className="h-12 w-12 rounded-full object-cover border-2 border-white/40"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
            )}
            <div>
              <p className="font-bold inline-flex flex-wrap items-center gap-2">
                {portal.client.name}
                <VerifiedBadge
                  verified={portal.client.identity?.is_verified}
                  provider={portal.client.identity?.provider}
                  name={portal.client.identity?.verified_name}
                  className="!bg-white/20 !text-white !border-white/30"
                />
              </p>
              <p className="text-xs text-white/85">
                {[portal.client.plan_name, portal.client.membership_status]
                  .filter(Boolean)
                  .join(' · ') || 'Member'}
                {portal.client.coach_name
                  ? ` · Coach ${portal.client.coach_name}`
                  : ''}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-white/20 px-2.5 py-1">
              {portal.open_count} open spots
            </span>
            <span className="rounded-full bg-white/20 px-2.5 py-1">
              {portal.upcoming_count ??
                portal.my_bookings.filter((b) => b.upcoming !== false)
                  .length}{' '}
              upcoming classes
            </span>
            {(portal.messages_unread || 0) > 0 ? (
              <span className="rounded-full bg-amber-400 text-amber-950 px-2.5 py-1">
                {portal.messages_unread} new message
                {(portal.messages_unread || 0) === 1 ? '' : 's'}
              </span>
            ) : (portal.threads || []).length > 0 ? (
              <span className="rounded-full bg-white/20 px-2.5 py-1">
                {(portal.threads || []).length} message thread
                {(portal.threads || []).length === 1 ? '' : 's'}
              </span>
            ) : null}
            {portal.full_count > 0 ? (
              <span className="rounded-full bg-white/20 px-2.5 py-1">
                {portal.full_count} full (waitlist)
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        <PopiaConsentNotice brand={portal.brand} />
        <B2cAutoLinkBanner token={token} tone="yellow" />
        <MemberAnnouncementsFeed
          items={portal.announcements}
          brand={portal.brand}
          tone="yellow"
        />
        {(msg || error) && (
          <div
            className={`rounded-xl border px-3 py-2 text-sm ${
              error
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {error || msg}
          </div>
        )}

        <div className="flex gap-1 rounded-2xl bg-white border border-slate-200 p-1 flex-wrap">
          {(
            [
              ['checkin', 'Check in'],
              ['open', 'Book'],
              ['mine', 'My classes'],
              ['progress', 'Progress'],
              ['messages', 'Messages'],
              ['profile', 'Profile'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              className={`flex-1 min-w-[4rem] rounded-xl py-2 text-xs font-bold ${
                tab === id
                  ? 'bg-[#E8E830] text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
              {id === 'messages' && (portal.messages_unread || 0) > 0
                ? ` (${portal.messages_unread})`
                : ''}
            </button>
          ))}
        </div>

        {tab === 'checkin' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-yellow-200 bg-white p-4">
              <div className="flex items-center gap-2 text-yellow-800">
                <QrCode className="h-4 w-4" />
                <h2 className="text-sm font-black">Gym door check-in</h2>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                At reception, scan the gym&apos;s QR with your phone camera (or
                paste the code below). Your membership status is shared with the
                gym — paid / unpaid / frozen.
              </p>
              {portal.access ? (
                <div
                  className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                    portal.access.level === 'blocked'
                      ? 'border-rose-200 bg-rose-50 text-rose-900'
                      : portal.access.payment_ok
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-amber-200 bg-amber-50 text-amber-950'
                  }`}
                >
                  <p className="font-bold">
                    Membership: {portal.access.membership_status}
                    {portal.access.subscription_status
                      ? ` · sub ${portal.access.subscription_status}`
                      : ''}
                  </p>
                  {portal.access.alert ? (
                    <p className="mt-1 flex items-start gap-1">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      {portal.access.alert}
                    </p>
                  ) : (
                    <p className="mt-1">Dues look current — good to train.</p>
                  )}
                </div>
              ) : null}
              <label className="mt-3 block text-xs font-bold text-slate-700">
                Gym QR code or check-in URL (optional)
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-mono"
                  value={checkinScan}
                  onChange={(e) => setCheckinScan(e.target.value)}
                  placeholder="Paste fg_… token or full check-in link"
                />
              </label>
              <button
                type="button"
                disabled={checkinBusy}
                onClick={() => void doCheckIn()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-600 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {checkinBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                I&apos;m at the gym — check in
              </button>
              {portal.gym_checkin?.path ? (
                <a
                  href={`${portal.gym_checkin.path}?member=${encodeURIComponent(token)}`}
                  className="mt-2 block text-center text-xs font-bold text-yellow-700 underline"
                >
                  Open gym door page (scan-friendly)
                </a>
              ) : null}
              <p className="mt-3 text-[11px] text-slate-500">
                Tip: add this portal to your home screen (PWA) for one-tap class
                booking and check-in.
              </p>
            </div>
          </div>
        )}

        {tab === 'messages' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <MessageSquare className="w-4 h-4" />
              <h2 className="text-sm font-black">Messages with your coaches</h2>
            </div>
            {(portal.threads || []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No messages yet. When your coach writes to you, it will show
                here — and we email you if your profile has an address.
              </div>
            ) : (
              <>
                <ul className="space-y-2">
                  {(portal.threads || []).map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setMsgThreadId(t.id);
                          void post({
                            action: 'message_mark_read',
                            thread_id: t.id,
                          }).then(() => void load());
                        }}
                        className={`w-full text-left rounded-2xl border px-3 py-3 ${
                          msgThreadId === t.id
                            ? 'border-yellow-400 bg-yellow-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <p className="text-sm font-black text-slate-900 truncate">
                          {t.title || t.subject || 'Conversation'}
                          {(t.unread || 0) > 0 ? (
                            <span className="ml-2 text-[10px] font-black uppercase text-amber-700">
                              {t.unread} new
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {t.preview || '—'}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
                {(() => {
                  const thr =
                    (portal.threads || []).find((t) => t.id === msgThreadId) ||
                    (portal.threads || [])[0];
                  if (!thr) return null;
                  return (
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-3">
                      <p className="text-xs font-bold text-slate-500">
                        {thr.title || thr.subject || 'Conversation'}
                      </p>
                      <div className="max-h-72 overflow-y-auto space-y-2">
                        {(thr.messages || []).map((m) => {
                          const mine = m.author_role === 'member';
                          return (
                            <div
                              key={m.id}
                              className={`rounded-xl px-3 py-2 text-sm ${
                                mine
                                  ? 'bg-yellow-100 text-yellow-950 ml-6'
                                  : 'bg-slate-100 text-slate-900 mr-6'
                              }`}
                            >
                              <p className="text-[10px] font-bold opacity-70 mb-0.5">
                                {m.author_name}
                                {' · '}
                                {m.created_at?.slice(0, 16).replace('T', ' ')}
                              </p>
                              <p className="whitespace-pre-wrap">{m.body}</p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <input
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          placeholder="Reply…"
                          value={msgReply}
                          onChange={(e) => setMsgReply(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && msgReply.trim()) {
                              void post({
                                action: 'message_post',
                                thread_id: thr.id,
                                body: msgReply.trim(),
                              }).then(() => {
                                setMsgReply('');
                                void load();
                              });
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={busyId === thr.id || !msgReply.trim()}
                          onClick={() => {
                            setBusyId(thr.id);
                            void post({
                              action: 'message_post',
                              thread_id: thr.id,
                              body: msgReply.trim(),
                            })
                              .then(() => {
                                setMsgReply('');
                                void load();
                              })
                              .finally(() => setBusyId(null));
                          }}
                          className="rounded-xl bg-[#E8E830] text-slate-900 px-3 py-2 disabled:opacity-50"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {(portal.client?.family || []).filter((m) => m.active !== false).length > 0 &&
        (tab === 'open') ? (
          <div className="rounded-2xl border border-yellow-200 bg-white p-3">
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Book for
            </label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
              value={bookForFamilyId}
              onChange={(e) => setBookForFamilyId(e.target.value)}
            >
              <option value="">Myself (account holder)</option>
              {(portal.client?.family || [])
                .filter((m) => m.active !== false)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.relationship ? ` · ${m.relationship}` : ''}
                    {m.is_minor ? ' (child)' : ''}
                  </option>
                ))}
            </select>
          </div>
        ) : null}
        {!portal.allow_booking && tab === 'open' ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Online booking is currently paused by the gym. You can still view
            your bookings.
          </p>
        ) : null}

        {tab === 'open' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Classes with open vacancies — book a spot or request to join the
              waitlist when full.
            </p>
            {portal.open_classes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No public classes in the next 4 weeks yet.
              </div>
            ) : (
              portal.open_classes.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-slate-900">{c.class_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {formatDay(c.date, c.start_time)}
                      </p>
                      {c.coach_name ? (
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {c.coach_name}
                        </p>
                      ) : null}
                      {c.location ? (
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {c.location}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          c.my_status
                            ? 'bg-yellow-100 text-yellow-800'
                            : c.full
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        <Users className="w-3 h-3" />
                        {c.my_status
                          ? c.my_status
                          : c.full
                            ? 'Full'
                            : `${c.spots_left} left`}
                      </span>
                    </div>
                  </div>
                  {c.class_plan ? (
                    <p className="text-[11px] text-slate-600 mt-2 leading-snug">
                      {c.class_plan}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.my_status ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-700">
                          <Check className="w-3.5 h-3.5" />
                          You&apos;re {c.my_status}
                        </span>
                        {c.my_booking_id &&
                        c.my_status !== 'attended' &&
                        c.my_status !== 'waitlist' ? (
                          <button
                            type="button"
                            disabled={busyId === c.my_booking_id}
                            onClick={() => void cancel(c.my_booking_id!)}
                            className="text-xs font-bold text-rose-600 inline-flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                        ) : null}
                      </>
                    ) : portal.allow_booking ? (
                      c.full ? (
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => void book(c.id, true)}
                          className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          {busyId === c.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                          ) : (
                            'Request join (waitlist)'
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => void book(c.id, false)}
                          className="rounded-xl bg-yellow-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-yellow-700 disabled:opacity-50"
                        >
                          {busyId === c.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                          ) : (
                            'Book this class'
                          )}
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'mine' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Classes you have booked. Leave feedback after you attend — your
              coach sees it on your progress.
            </p>
            {portal.my_bookings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No booked classes yet.{' '}
                <button
                  type="button"
                  className="font-bold text-yellow-800 underline"
                  onClick={() => selectTab('open')}
                >
                  Book a class
                </button>
              </div>
            ) : (
              <>
                {(['upcoming', 'past'] as const).map((bucket) => {
                  const rows = portal.my_bookings.filter((b) =>
                    bucket === 'upcoming' ? b.upcoming !== false : b.upcoming === false
                  );
                  if (rows.length === 0) return null;
                  return (
                    <div key={bucket} className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        {bucket === 'upcoming' ? 'Upcoming' : 'Recent classes'}
                      </p>
                      {rows.map((b) => (
                        <div
                          key={b.booking_id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 flex items-start justify-between gap-3"
                        >
                          <div>
                            <p className="font-black text-slate-900">
                              {b.class_name}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {formatDay(b.date, b.start_time)}
                            </p>
                            {b.coach_name ? (
                              <p className="text-xs text-slate-500">
                                {b.coach_name}
                              </p>
                            ) : null}
                            <span className="inline-block mt-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-700">
                              {b.status}
                            </span>
                            {b.upcoming !== false ? (
                              <a
                                className="block mt-1 text-[10px] font-bold text-yellow-700 underline"
                                href={`/api/public/advisor/ics?module=fitgraph&date=${encodeURIComponent(b.date)}&start=${encodeURIComponent(b.start_time)}&title=${encodeURIComponent(b.class_name)}&duration=45`}
                              >
                                Add to calendar
                              </a>
                            ) : null}
                            {b.feedback_token &&
                            companyId != null &&
                            !b.feedback_submitted_at ? (
                              <a
                                className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-yellow-800 underline"
                                href={`/f/fitgraph/${companyId}/${encodeURIComponent(b.feedback_token)}`}
                              >
                                <MessageSquareHeart className="h-3.5 w-3.5" />
                                Leave feedback
                              </a>
                            ) : b.feedback_submitted_at ? (
                              <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                                Feedback sent
                              </p>
                            ) : null}
                          </div>
                          {b.status === 'booked' || b.status === 'waitlist' ? (
                            <button
                              type="button"
                              disabled={busyId === b.booking_id}
                              onClick={() => void cancel(b.booking_id)}
                              className="text-xs font-bold text-rose-600 shrink-0"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {tab === 'progress' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Your attendance, goals, coach notes, and class feedback at{' '}
              {portal.brand}.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-yellow-200 bg-white px-3 py-2.5 text-center">
                <p className="text-lg font-black text-slate-900">
                  {portal.progress?.attended_30d ?? 0}
                </p>
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  Classes · 30d
                </p>
              </div>
              <div className="rounded-2xl border border-yellow-200 bg-white px-3 py-2.5 text-center">
                <p className="text-lg font-black text-slate-900">
                  {portal.progress?.attended_count ?? 0}
                </p>
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  Attended
                </p>
              </div>
              <div className="rounded-2xl border border-yellow-200 bg-white px-3 py-2.5 text-center">
                <p className="text-lg font-black text-slate-900">
                  {portal.progress?.check_ins_30d ?? 0}
                </p>
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  Check-ins
                </p>
              </div>
            </div>

            <MemberRelationshipSection
              relationship={portal.relationship}
              primaryColor={color}
            />

            {(portal.packs || []).length > 0 ? (
              <div className="rounded-2xl border border-yellow-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase text-yellow-700 mb-1">
                  Session packs
                </p>
                <ul className="space-y-1">
                  {(portal.packs || []).map((p) => (
                    <li key={p.id} className="text-xs font-semibold text-slate-700">
                      {p.label || 'Pack'}: <strong>{p.remaining}</strong> left
                      {p.expires_at
                        ? ` · exp ${p.expires_at.slice(0, 10)}`
                        : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {portal.progress?.health &&
            (portal.progress.health.goals ||
              portal.progress.health.training_modifications ||
              portal.progress.health.summary) ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                <div className="flex items-center gap-2 text-yellow-800">
                  <Activity className="h-4 w-4" />
                  <h2 className="text-sm font-black">Training notes</h2>
                </div>
                {portal.progress.health.summary ? (
                  <p className="text-xs text-slate-600">
                    {portal.progress.health.summary}
                  </p>
                ) : null}
                {portal.progress.health.goals ? (
                  <p className="text-sm text-slate-800">
                    <span className="font-bold">Goals: </span>
                    {portal.progress.health.goals}
                  </p>
                ) : null}
                {portal.progress.health.training_modifications ? (
                  <p className="text-sm text-slate-800">
                    <span className="font-bold">Modifications: </span>
                    {portal.progress.health.training_modifications}
                  </p>
                ) : null}
              </div>
            ) : null}

            {(portal.progress?.coach_notes || []).length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                <h2 className="text-sm font-black text-slate-900">
                  Coach notes
                </h2>
                <ul className="space-y-2">
                  {(portal.progress?.coach_notes || []).map((n) => (
                    <li key={n.id} className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-bold text-slate-400">
                        {n.at.slice(0, 10)}
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {n.title}
                      </p>
                      {n.body ? (
                        <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600">
                          {n.body}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {(portal.progress?.pending_feedback || []).length > 0 &&
            companyId != null ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-950">
                  <MessageSquareHeart className="h-4 w-4" />
                  <h2 className="text-sm font-black">Feedback waiting</h2>
                </div>
                <ul className="space-y-1.5">
                  {(portal.progress?.pending_feedback || []).map((f) => (
                    <li key={f.booking_id}>
                      <a
                        href={`/f/fitgraph/${companyId}/${encodeURIComponent(f.feedback_token)}`}
                        className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                      >
                        <span>
                          {f.class_name}
                          {f.date ? ` · ${f.date}` : ''}
                        </span>
                        <span className="text-[11px] font-black text-yellow-800">
                          Leave feedback
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {(portal.progress?.my_feedback || []).length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                <h2 className="text-sm font-black text-slate-900">
                  Your class feedback
                </h2>
                <ul className="space-y-2">
                  {(portal.progress?.my_feedback || []).map((f) => (
                    <li
                      key={f.id}
                      className="rounded-xl border border-slate-100 px-3 py-2"
                    >
                      <p className="text-sm font-black text-slate-900">
                        {f.class_name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {f.date} · feel {f.feeling}/5 · RPE {f.intensity}/10
                        {f.enjoyment != null ? ` · enjoy ${f.enjoyment}/5` : ''}
                      </p>
                      {f.comment ? (
                        <p className="mt-1 text-xs text-slate-700">{f.comment}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                After you attend a class, you can leave feedback from My
                classes. Coaches use it to adjust your training.
              </p>
            )}
          </div>
        )}

        {tab === 'profile' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <button
              type="button"
              onClick={() => selectTab('progress')}
              className="w-full rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-left"
            >
              <p className="text-xs font-black text-yellow-950">
                Attendance, goals & feedback
              </p>
              <p className="text-[11px] text-slate-600">
                Open Progress for classes attended, coach notes, and your
                feedback.
              </p>
            </button>
            {(portal.packs || []).length > 0 ? (
              <div className="rounded-xl border border-yellow-100 bg-yellow-50/50 px-3 py-2 mb-3">
                <p className="text-[10px] font-black uppercase text-yellow-700 mb-1">Session packs</p>
                <ul className="space-y-1">
                  {(portal.packs || []).map((p) => (
                    <li key={p.id} className="text-xs font-semibold text-slate-700">
                      {p.label || 'Pack'}: <strong>{p.remaining}</strong> left
                      {p.expires_at ? ` · exp ${p.expires_at.slice(0, 10)}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="text-sm font-black text-slate-900">Your profile</p>
            <p className="text-xs text-slate-500">
              Changes sync to the gym desk. Email is usually the parent/guardian
              contact for invites and care messages — add kids under Family
              members.
            </p>
            {companyId != null ? (
              <ProfilePhotoField
                companyId={companyId}
                value={photoUrl}
                onChange={setPhotoUrl}
                kind="client_photo"
                label="Your photo"
                description="Update your member photo (JPG/PNG/WebP · under 8MB)."
                disabled={busyId === 'profile'}
                accentClass="border-yellow-300"
              />
            ) : null}
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Name
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Email
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <span className="mt-1 block text-[10px] text-slate-400">
                Care messages and invites follow this address.
              </span>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Phone
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                ID number
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                inputMode="numeric"
                autoComplete="off"
                placeholder="SA ID / passport"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
              />
              <span className="mt-1 block text-[10px] text-slate-400">
                Saved on your gym member record for desk staff.
              </span>
            </label>
            <PortalFamilyMembers
              family={portal.client.family || []}
              busy={busyId === 'family'}
              context="gym"
              accentClass="border-yellow-200"
              buttonClass="bg-yellow-600 hover:bg-yellow-700"
              onSave={async (member) => {
                setBusyId('family');
                try {
                  const data = await post({
                    action: 'family_upsert',
                    member,
                  });
                  if (data.portal) setPortal(data.portal);
                  setMsg(data.message || 'Family member saved');
                } finally {
                  setBusyId(null);
                }
              }}
              onRemove={async (id) => {
                setBusyId('family');
                try {
                  const data = await post({
                    action: 'family_remove',
                    member_id: id,
                  });
                  if (data.portal) setPortal(data.portal);
                  setMsg(data.message || 'Removed');
                } finally {
                  setBusyId(null);
                }
              }}
            />
            <PortalIdentityVerify
              module="fitgraph"
              role="member"
              token={token}
              idNumber={idNumber}
              onIdNumberChange={setIdNumber}
              identity={portal.client.identity}
              onIdentityChange={(id) =>
                setPortal((p) =>
                  p
                    ? {
                        ...p,
                        client: { ...p.client, identity: id },
                      }
                    : p
                )
              }
              accentClass="border-yellow-200"
              buttonClass="bg-yellow-600 hover:bg-yellow-700"
            />
            <button
              type="button"
              disabled={busyId === 'profile'}
              onClick={() => void saveProfile()}
              className="w-full rounded-xl bg-yellow-600 py-2.5 text-sm font-bold text-white hover:bg-yellow-700 disabled:opacity-50"
            >
              {busyId === 'profile' ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-400 pb-8">
          Powered by GymAdvisor® · SupplierAdvisor
        </p>
      </main>
    </div>
  );
}
