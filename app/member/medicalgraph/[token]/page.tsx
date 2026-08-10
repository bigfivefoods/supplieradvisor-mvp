'use client';

/**
 * MedicalAdvisor® patient portal — registered patients book open diary slots.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CalendarDays,
  Check,
  Loader2,
  MapPin,
  Stethoscope,
  User,
  X,
} from 'lucide-react';
import { ProfilePhotoField } from '@/components/chrome/ProfilePhotoField';
import { PortalIdentityVerify } from '@/components/identity/PortalIdentityVerify';
import { PortalFamilyMembers } from '@/components/identity/PortalFamilyMembers';
import { VerifiedBadge } from '@/components/services/VerifiedBadge';
import { PortalMessagesPanel } from '@/components/services/PortalMessagesPanel';
import { PopiaConsentNotice } from '@/components/services/PopiaConsentNotice';

type Slot = {
  id: string;
  date: string;
  start_time: string;
  service_name: string;
  practitioner_name?: string;
  clinician_name?: string;
  is_preferred_clinician?: boolean;
  waitlist_position?: number | null;
  location?: string;
  spots_left: number;
  full: boolean;
  public_notes?: string;
  my_status?: string | null;
  my_booking_id?: string | null;
};

type Portal = {
  brand: string;
  allow_booking: boolean;
  primary_color?: string;
  patient: {
    name: string;
    email?: string;
    phone?: string;
    id_number?: string;
    photo_url?: string;
    status?: string;
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
  open_slots: Slot[];
  waitlist_queue?: Array<{ id: string; position: number }>;
  can_book_other_clinicians?: boolean;
  my_bookings: Array<{
    booking_id: string;
    status: string;
    date: string;
    start_time: string;
    service_name: string;
    practitioner_name?: string;
  }>;
  open_count: number;
};

export default function MemberMedicalgraphPortalPage() {
  const { token } = useParams() as { token: string };
  const [portal, setPortal] = useState<Portal | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'open' | 'mine' | 'messages' | 'profile'>('open');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [bookForFamilyId, setBookForFamilyId] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/medicalgraph/patient?token=${encodeURIComponent(token)}`,
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

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/public/medicalgraph/patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    if (data.portal) setPortal(data.portal);
    return data;
  };

  const book = async (appointmentId: string) => {
    setBusyId(appointmentId);
    setMsg(null);
    setError(null);
    try {
      const data = await post({
        action: 'book',
        appointment_id: appointmentId,
        family_member_id: bookForFamilyId || null,
      });
      setMsg(data.booking?.message || 'Booked');
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join queue');
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

  const color = portal?.primary_color || '#059669';
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
      <div className="min-h-screen flex items-center justify-center bg-emerald-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
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
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-slate-50">
      <header
        className="px-4 py-6 text-white"
        style={{ background: `linear-gradient(135deg, ${color}, #064e3b)` }}
      >
        <div className="max-w-lg mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
            Patient portal · MedicalAdvisor®
          </p>
          <h1 className="text-xl font-black mt-1">{portal.brand}</h1>
          <div className="mt-3 flex items-center gap-3">
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
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        <PopiaConsentNotice brand={portal.brand} />
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

        <div className="flex gap-1 rounded-2xl bg-white border border-slate-200 p-1">
          {(
            [
              ['open', 'Open diary'],
              ['mine', 'My bookings'],
              ['messages', 'Messages'],
              ['profile', 'My profile'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setError(null);
                setMsg(null);
              }}
              className={`flex-1 rounded-xl py-2 text-xs font-bold ${
                tab === id
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {(portal.patient?.family || []).filter((m: { active?: boolean }) => m.active !== false).length >
          0 && tab === 'open' ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-3">
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
              Book your regular clinician or another available practitioner. Full slots: join waitlist (practice is notified). </p>

            {portal.allow_booking ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
                {(portal.waitlist_queue || []).length > 0 ? (
                  <p className="text-sm font-black text-amber-900">
                    Next-available queue: #{(portal.waitlist_queue || [])[0]?.position}
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === 'queue'}
                    onClick={() => void joinQueue()}
                    className="rounded-xl bg-amber-600 text-white px-3 py-2 text-xs font-bold"
                  >
                    Join next-available waitlist
                  </button>
                )}
                <p className="text-[11px] text-amber-900/80 mt-1">
                  Notifies the practice you want the next free slot (any clinician if needed).
                </p>
              </div>
            ) : null}
            {portal.open_slots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No public diary slots in the next 4 weeks. Ask the clinic to
                publish open slots.
              </div>
            ) : (
              portal.open_slots.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="font-black text-slate-900">{s.service_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {formatDay(s.date, s.start_time)}
                  </p>
                  {s.practitioner_name || s.clinician_name ? (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.practitioner_name || s.clinician_name}
                      {s.is_preferred_clinician ? ' · your clinician' : ' · other clinician'}
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
                        s.my_status
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.full
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {s.my_status || (s.full ? 'Full' : 'Open')}
                    </span>
                    {s.my_status ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                        <Check className="w-3.5 h-3.5" /> You&apos;re{' '}
                        {s.my_status}
                      </span>
                    ) : portal.allow_booking ? (
                      <button
                        type="button"
                        disabled={busyId === s.id}
                        onClick={() => void book(s.id)}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
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
              ))
            )}
          </div>
        )}

        {tab === 'messages' && (
          <PortalMessagesPanel
            threads={(portal as any).threads || []}
            messagesUnread={(portal as any).messages_unread || 0}
            selfRole="patient"
            post={async (body) => post(body)}
            onRefresh={() => void load()}
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
                      className="text-[11px] font-bold text-emerald-700 underline"
                      href={`/api/public/advisor/ics?module=medicalgraph&date=${encodeURIComponent(b.date)}&start=${encodeURIComponent(b.start_time)}&title=${encodeURIComponent(b.service_name || 'Appointment')}&duration=45`}
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-sm font-black text-slate-900">Your profile</p>
            <p className="text-xs text-slate-500">
              Changes sync to the clinic chart. Email is used for invites and
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
                accentClass="border-emerald-300"
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
                Saved on your medical chart for the clinic.
              </span>
            </label>

            <PortalFamilyMembers
              family={portal.patient.family || []}
              busy={busyId === 'family'}
              context="clinic"
              accentClass="border-emerald-200"
              buttonClass="bg-emerald-600 hover:bg-emerald-700"
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
              module="medicalgraph"
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
              accentClass="border-emerald-200"
              buttonClass="bg-emerald-600 hover:bg-emerald-700"
            />
            <button
              type="button"
              disabled={busyId === 'profile'}
              onClick={() => void saveProfile()}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white"
            >
              Save profile
            </button>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-400 pb-8">
          Powered by MedicalAdvisor® · SupplierAdvisor
        </p>
      </main>
    </div>
  );
}
