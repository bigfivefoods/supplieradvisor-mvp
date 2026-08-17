'use client';

/**
 * DentalAdvisor® patient portal — registered patients book open diary slots.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CalendarDays,
  Check,
  Loader2,
  MapPin,
  Smile,
  User,
  X,
} from 'lucide-react';
import { ProfilePhotoField } from '@/components/chrome/ProfilePhotoField';
import { PortalIdentityVerify } from '@/components/identity/PortalIdentityVerify';
import { PortalFamilyMembers } from '@/components/identity/PortalFamilyMembers';
import { VerifiedBadge } from '@/components/services/VerifiedBadge';
import { PortalMessagesPanel } from '@/components/services/PortalMessagesPanel';
import { PortalWaitlistReschedule } from '@/components/services/PortalWaitlistReschedule';
import { PopiaConsentNotice } from '@/components/services/PopiaConsentNotice';
import { B2cAutoLinkBanner } from '@/components/b2c/B2cAutoLinkBanner';
import { MemberAnnouncementsFeed } from '@/components/services/MemberAnnouncementsFeed';
import { MemberPortalBrandLockup } from '@/components/brand/PortalBrandLogo';
import { MemberAdvisorShell } from '@/components/advisors/MemberAdvisorShell';
import { MemberMedicalShare } from '@/components/services/MemberMedicalShare';
import type {
  SharedAdviceNote,
  SharedTreatmentPlan,
} from '@/lib/clinic/medical-share';

type Slot = {
  id: string;
  date: string;
  start_time: string;
  service_name: string;
  clinician_name?: string;
  is_preferred_clinician?: boolean;
  location?: string;
  spots_left: number;
  full: boolean;
  my_status?: string | null;
  my_booking_id?: string | null;
  waitlist_position?: number | null;
};

type Portal = {
  brand: string;
  allow_booking: boolean;
  can_book_other_clinicians?: boolean;
  primary_color?: string;
  logo_url?: string | null;
  patient: {
    name: string;
    email?: string;
    phone?: string;
    id_number?: string;
    photo_url?: string;
    status?: string;
    preferred_clinician_id?: string | null;
    preferred_clinician_name?: string | null;
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
  shares?: { schedule?: boolean; feedback?: boolean; medical?: boolean };
  medical_share?: Record<string, unknown> | null;
  announcements?: import('@/lib/services/member-announcements').MemberAnnouncementPublic[];
  shared_advice?: SharedAdviceNote[];
  treatment_plans?: SharedTreatmentPlan[];
  open_slots: Slot[];
  waitlist_queue?: Array<{
    id: string;
    position: number;
    accept_any_clinician?: boolean;
    service_name?: string | null;
  }>;
  my_bookings: Array<{
    waitlist_offered_at?: string | null;
    waitlist_accepted_at?: string | null;
    booking_id: string;
    status: string;
    date: string;
    start_time: string;
    service_name: string;
    clinician_name?: string;
  }>;
  open_count: number;
  messages_unread?: number;
  threads?: import('@/components/services/PortalMessagesPanel').PortalThread[];
  care_packs?: Array<{
    id: string;
    label?: string;
    remaining: number;
    expires_at?: string | null;
  }>;
};

export default function MemberDentalgraphPortalPage() {
  const { token } = useParams() as { token: string };
  const [portal, setPortal] = useState<Portal | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'open' | 'mine' | 'messages' | 'care' | 'profile'>('open');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [bookForFamilyId, setBookForFamilyId] = useState('');
  /** all | preferred | other */
  const [slotFilter, setSlotFilter] = useState<'all' | 'preferred' | 'other'>(
    'all'
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/dentalgraph/patient?token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Portal not found');
      setPortal(data.portal);
      setCompanyId(data.companyId ?? null);
      const p = data.portal?.patient;
      if (p) {
        setName(p.name || '');
        setEmail(p.email || '');
        setPhone(p.phone || '');
        setIdNumber(p.id_number || '');
        setPhotoUrl(p.photo_url || '');
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
      raw === 'open' ||
      raw === 'mine' ||
      raw === 'care' ||
      raw === 'messages' ||
      raw === 'profile'
    ) {
      setTab(raw);
    }
  }, []);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/public/dentalgraph/patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    if (data.portal) setPortal(data.portal);
    return data;
  };

  const book = async (appointmentId: string, requestJoin = false) => {
    setBusyId(appointmentId);
    setMsg(null);
    setError(null);
    try {
      const data = await post({
        action: requestJoin ? 'request_join' : 'book',
        appointment_id: appointmentId,
        family_member_id: bookForFamilyId || null,
      });
      setMsg(data.booking?.message || data.message || 'Booked');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setBusyId(null);
    }
  };

  const joinQueue = async () => {
    setBusyId('queue');
    setMsg(null);
    setError(null);
    try {
      const data = await post({
        action: 'join_queue',
        accept_any_clinician: true,
      });
      setMsg(data.queue?.message || data.message || 'Joined waitlist');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not join queue');
    } finally {
      setBusyId(null);
    }
  };

  const leaveQueue = async (queueId?: string) => {
    setBusyId('queue');
    try {
      const data = await post({
        action: 'leave_queue',
        queue_id: queueId,
      });
      setMsg(data.message || 'Left waitlist');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not leave queue');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (bookingId: string) => {
    if (!confirm('Cancel this appointment?')) return;
    setBusyId(bookingId);
    try {
      const data = await post({ action: 'cancel', booking_id: bookingId });
      setMsg(data.message || 'Cancelled');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  };

  const saveProfile = async () => {
    setBusyId('profile');
    try {
      const data = await post({
        action: 'update_profile',
        name,
        email,
        phone,
        id_number: idNumber,
        photo_url: photoUrl,
      });
      setMsg(data.message || 'Saved');
      const p = data.portal?.patient;
      if (p) {
        setEmail(p.email || '');
        setIdNumber(p.id_number || '');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusyId(null);
    }
  };

  const color = portal?.primary_color || '#0284c7';
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
      </div>
    );
  }
  if (error && !portal) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center">
          <p className="font-black">Patient portal unavailable</p>
          <p className="text-sm text-slate-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }
  if (!portal) return null;

  return (
    <MemberAdvisorShell
      color={color}
      fromClass="from-sky-50"
      tab={tab}
      onTab={(id) => {
        setTab(id);
        setError(null);
        setMsg(null);
      }}
      tabs={[
        { id: 'open', label: 'Open diary' },
        { id: 'mine', label: 'My bookings' },
        { id: 'messages', label: 'Messages' },
        ...(portal.shares?.medical !== false
          ? [{ id: 'care', label: 'My care' }]
          : []),
        { id: 'profile', label: 'My profile' },
      ]}
      header={
        <div>
          <MemberPortalBrandLockup
            logoUrl={portal.logo_url}
            brand={portal.brand}
            eyebrow="Patient portal · DentalAdvisor®"
          />
          <div className="mt-4 flex items-center gap-3">
            {portal.patient.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={portal.patient.photo_url}
                alt=""
                className="h-12 w-12 rounded-full object-cover border-2 border-white/40"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
            )}
            <div>
              <p className="font-bold inline-flex flex-wrap items-center gap-2">{portal.patient.name}
                <VerifiedBadge
                  verified={portal.patient.identity?.is_verified}
                  provider={portal.patient.identity?.provider}
                  name={portal.patient.identity?.verified_name}
                  className="!bg-white/20 !text-white !border-white/30"
                /></p>
              <p className="text-xs text-white/85">
                {portal.patient.status || 'Patient'} · {portal.open_count} open
                slots
              </p>
            </div>
          </div>
        </div>
      }
    >
        <PopiaConsentNotice brand={portal.brand} />
        <B2cAutoLinkBanner token={token} tone="cyan" />
        <MemberAnnouncementsFeed
          items={portal.announcements}
          brand={portal.brand}
          tone="sky"
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


        {tab === 'care' && (
          <MemberMedicalShare
            share={portal.medical_share}
            plans={portal.treatment_plans}
            advice={portal.shared_advice}
            tone="sky"
          />
        )}

        {(portal.patient?.family || []).filter((m: { active?: boolean }) => m.active !== false).length >
          0 && tab === 'open' ? (
          <div className="rounded-2xl border border-sky-200 bg-white p-3">
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Book for
            </label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
              value={bookForFamilyId}
              onChange={(e) => setBookForFamilyId(e.target.value)}
            >
              <option value="">Myself (account holder)</option>
              {(portal.patient?.family || [])
                .filter((m: { active?: boolean }) => m.active !== false)
                .map((m: { id: string; name: string; relationship?: string; is_minor?: boolean }) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.relationship ? ` · ${m.relationship}` : ''}
                    {m.is_minor ? ' (child)' : ''}
                  </option>
                ))}
            </select>
          </div>
        ) : null}

        {tab === 'open' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Book your regular clinician when free — or any other open
              dentist at the practice. Full slots: join the waitlist (we notify
              the desk).
            </p>
            {portal.patient.preferred_clinician_name ? (
              <p className="text-xs text-slate-500 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
                Your regular clinician:{' '}
                <strong>{portal.patient.preferred_clinician_name}</strong>
                {portal.can_book_other_clinicians !== false
                  ? ' · You can also book other clinicians when they have open times.'
                  : ''}
              </p>
            ) : null}

            {portal.allow_booking ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 space-y-2">
                <p className="text-xs font-bold text-amber-950">
                  Need the next available slot?
                </p>
                {(portal.waitlist_queue || []).length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-amber-900">
                      You are #
                      {(portal.waitlist_queue || [])[0]?.position} in the
                      practice queue
                    </span>
                    <button
                      type="button"
                      disabled={busyId === 'queue'}
                      onClick={() =>
                        void leaveQueue((portal.waitlist_queue || [])[0]?.id)
                      }
                      className="text-xs font-bold text-rose-700 underline"
                    >
                      Leave queue
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === 'queue'}
                    onClick={() => void joinQueue()}
                    className="rounded-xl bg-amber-600 text-white px-3 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    {busyId === 'queue'
                      ? '…'
                      : 'Join next-available waitlist'}
                  </button>
                )}
                <p className="text-[11px] text-amber-900/80">
                  Notifies the practice that you&apos;re waiting — they can
                  offer any clinician or free time.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['all', 'All clinicians'],
                  ['preferred', 'My clinician'],
                  ['other', 'Other clinicians'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSlotFilter(id)}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold border ${
                    slotFilter === id
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'border-slate-200 text-slate-600 bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {(() => {
              const slots = portal.open_slots.filter((s) => {
                if (slotFilter === 'preferred') return s.is_preferred_clinician;
                if (slotFilter === 'other') return !s.is_preferred_clinician;
                return true;
              });
              if (slots.length === 0) {
                return (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                    {slotFilter === 'preferred'
                      ? 'No open times with your regular clinician — try Other clinicians or join the waitlist.'
                      : 'No public diary slots in the next 4 weeks. Ask the practice to publish open slots, or join the waitlist above.'}
                  </div>
                );
              }
              return (
                <div className="grid gap-3 md:grid-cols-2">
                {slots.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-black text-slate-900">{s.service_name}</p>
                    {s.is_preferred_clinician ? (
                      <span className="rounded-full bg-sky-100 text-sky-800 px-2 py-0.5 text-[10px] font-black uppercase">
                        Your clinician
                      </span>
                    ) : s.clinician_name ? (
                      <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-bold uppercase">
                        Other clinician
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {formatDay(s.date, s.start_time)}
                  </p>
                  {s.clinician_name ? (
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <Smile className="w-3.5 h-3.5" />
                      {s.clinician_name}
                    </p>
                  ) : null}
                  {s.location ? (
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {s.location}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                        s.my_status === 'waitlist'
                          ? 'bg-amber-100 text-amber-900'
                          : s.my_status
                            ? 'bg-sky-100 text-sky-800'
                            : s.full
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {s.my_status === 'waitlist' && s.waitlist_position
                        ? `Waitlist #${s.waitlist_position}`
                        : s.my_status || (s.full ? 'Full' : 'Open')}
                    </span>
                    {s.my_status ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-700">
                        <Check className="w-3.5 h-3.5" /> You&apos;re{' '}
                        {s.my_status}
                        {s.my_status === 'waitlist'
                          ? ' — practice notified'
                          : ''}
                      </span>
                    ) : portal.allow_booking ? (
                      <button
                        type="button"
                        disabled={busyId === s.id}
                        onClick={() => void book(s.id, s.full)}
                        className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {busyId === s.id
                          ? '…'
                          : s.full
                            ? 'Join waitlist (notify desk)'
                            : s.is_preferred_clinician
                              ? 'Book appointment'
                              : 'Book this clinician'}
                      </button>
                    ) : null}
                  </div>
                </div>
                ))}
                </div>
              );
            })()}
          </div>
        )}

        {tab === 'messages' && (
          <PortalMessagesPanel
            threads={portal.threads || []}
            messagesUnread={portal.messages_unread || 0}
            selfRole="patient"
            post={async (body) => {
              const data = await post(body);
              return data;
            }}
            onRefresh={() => void load()}
          />
        )}

        
        {tab === 'mine' && (
          <PortalWaitlistReschedule
            bookings={portal.my_bookings || []}
            openSlots={(portal.open_slots || []).map((s) => ({
              id: s.id,
              date: s.date,
              start_time: s.start_time,
              service_name: s.service_name,
              full: s.full,
              my_status: s.my_status,
            }))}
            accent={color}
            post={async (body) => {
              const res = await fetch('/api/public/dentalgraph/patient', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, ...body }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Failed');
              if (data.portal) setPortal(data.portal);
              return data;
            }}
            onDone={() => void load()}
          />
        )}

        {tab === 'mine' && (
          <div className="space-y-3">
            {portal.my_bookings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No upcoming bookings.
              </div>
            ) : (
              portal.my_bookings.map((b) => (
                <div
                  key={b.booking_id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 flex justify-between gap-3"
                >
                  <div>
                    <p className="font-black">{b.service_name}</p>
                    <p className="text-xs text-slate-500">
                      {formatDay(b.date, b.start_time)}
                    </p>
                    <a
                      className="text-[11px] font-bold text-sky-700 underline"
                      href={`/api/public/advisor/ics?module=dentalgraph&date=${encodeURIComponent(b.date)}&start=${encodeURIComponent(b.start_time)}&title=${encodeURIComponent(b.service_name || 'Appointment')}&duration=45`}
                    >
                      Add to calendar
                    </a>
                    <span className="text-[10px] font-black uppercase text-slate-600">
                      {b.status}
                    </span>
                  </div>
                  {(b.status === 'booked' || b.status === 'waitlist') && (
                    <button
                      type="button"
                      className="text-xs font-bold text-rose-600"
                      onClick={() => void cancel(b.booking_id)}
                    >
                      <X className="w-3.5 h-3.5 inline" /> Cancel
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'profile' && (
          <div className="space-y-4">
          <MemberMedicalShare
            share={portal.medical_share}
            plans={portal.treatment_plans}
            advice={portal.shared_advice}
            tone="sky"
            heading="Dental info, advice & scripts"
          />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-sm font-black text-slate-900">Your profile</p>
            <p className="text-xs text-slate-500">
              Changes sync to the practice chart. Email is used for invites and
              care messages.
            </p>
            {companyId != null ? (
              <ProfilePhotoField
                companyId={companyId}
                value={photoUrl}
                onChange={setPhotoUrl}
                kind="patient_photo"
                label="Your photo"
                disabled={busyId === 'profile'}
                accentClass="border-sky-300"
              />
            ) : null}
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Name
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Name"
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
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <span className="mt-1 block text-[10px] text-slate-400">
                Usually the parent/guardian contact for messages and invites.
              </span>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Phone
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Phone"
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
                Saved on your medical chart for the practice.
              </span>
            </label>

            <PortalFamilyMembers
              family={portal.patient.family || []}
              busy={busyId === 'family'}
              context="practice"
              accentClass="border-sky-200"
              buttonClass="bg-sky-600 hover:bg-sky-700"
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
              module="dentalgraph"
              role="patient"
              token={token}
              idNumber={idNumber}
              onIdNumberChange={setIdNumber}
              identity={portal.patient.identity}
              onIdentityChange={(id) =>
                setPortal((p) =>
                  p
                    ? {
                        ...p,
                        patient: { ...p.patient, identity: id },
                      }
                    : p
                )
              }
              accentClass="border-sky-200"
              buttonClass="bg-sky-600 hover:bg-sky-700"
            />
            <button
              type="button"
              disabled={busyId === 'profile'}
              onClick={() => void saveProfile()}
              className="w-full rounded-xl bg-sky-600 py-2.5 text-sm font-bold text-white"
            >
              Save profile
            </button>
          </div>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-400 pb-8">
          Powered by DentalAdvisor® · SupplierAdvisor
        </p>
    </MemberAdvisorShell>
  );
}
