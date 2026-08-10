'use client';

/**
 * DentalAdvisor® patient portal — registered patients book open diary slots.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CalendarDays,
  Check,
  HeartPulse,
  Loader2,
  MapPin,
  Smile,
  User,
  X,
} from 'lucide-react';
import { ProfilePhotoField } from '@/components/chrome/ProfilePhotoField';

type Slot = {
  id: string;
  date: string;
  start_time: string;
  service_name: string;
  clinician_name?: string;
  location?: string;
  spots_left: number;
  full: boolean;
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
    photo_url?: string;
    status?: string;
  };
  shares?: { schedule?: boolean; feedback?: boolean; medical?: boolean };
  medical_share?: Record<string, unknown> | null;
  open_slots: Slot[];
  my_bookings: Array<{
    booking_id: string;
    status: string;
    date: string;
    start_time: string;
    service_name: string;
    clinician_name?: string;
  }>;
  open_count: number;
};

export default function MemberDentalgraphPortalPage() {
  const { token } = useParams() as { token: string };
  const [portal, setPortal] = useState<Portal | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'open' | 'mine' | 'care' | 'profile'>('open');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

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

  const book = async (appointmentId: string) => {
    setBusyId(appointmentId);
    setMsg(null);
    setError(null);
    try {
      const data = await post({ action: 'book', appointment_id: appointmentId });
      setMsg(data.booking?.message || 'Booked');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Booking failed');
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
        photo_url: photoUrl,
      });
      setMsg(data.message || 'Saved');
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
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-slate-50">
      <header
        className="px-4 py-6 text-white"
        style={{ background: `linear-gradient(135deg, ${color}, #0c4a6e)` }}
      >
        <div className="max-w-lg mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
            Patient portal · DentalAdvisor®
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
              <p className="font-bold">{portal.patient.name}</p>
              <p className="text-xs text-white/85">
                {portal.patient.status || 'Patient'} · {portal.open_count} open
                slots
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
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
              ['open', 'Open diary'],
              ['mine', 'My bookings'],
              ...(portal.shares?.medical !== false
                ? ([['care', 'My care']] as const)
                : []),
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
              className={`flex-1 min-w-[4.5rem] rounded-xl py-2 text-xs font-bold ${
                tab === id
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'care' && (
          <div className="rounded-2xl border border-sky-200 bg-white p-4 space-y-3">
            <div className="flex items-center gap-2 text-sky-800">
              <HeartPulse className="w-4 h-4" />
              <h2 className="text-sm font-black">Shared care information</h2>
            </div>
            {portal.medical_share &&
            Object.keys(portal.medical_share).length > 0 ? (
              <dl className="space-y-2 text-sm">
                {Object.entries(portal.medical_share).map(([k, v]) => {
                  if (v == null || v === '') return null;
                  const label = k.replace(/_/g, ' ');
                  const value =
                    typeof v === 'object'
                      ? Object.entries(v as Record<string, unknown>)
                          .filter(([, x]) => x != null && x !== '')
                          .map(([a, b]) => `${a.replace(/_/g, ' ')}: ${b}`)
                          .join(' · ')
                      : Array.isArray(v)
                        ? v.join(', ')
                        : String(v);
                  if (!value) return null;
                  return (
                    <div key={k}>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {label}
                      </dt>
                      <dd className="text-slate-800 mt-0.5">{value}</dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="text-sm text-slate-500">
                Your practice has not shared clinical details yet. Contact them
                if you expected something here.
              </p>
            )}
            <p className="text-[11px] text-slate-400">
              Only a summary is shown — full charts stay with your care team.
            </p>
          </div>
        )}

        {tab === 'open' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Open diary vacancies — book a slot, or join the waitlist if full.
            </p>
            {portal.open_slots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No public diary slots in the next 4 weeks. Ask the practice to
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
                        s.my_status
                          ? 'bg-sky-100 text-sky-800'
                          : s.full
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {s.my_status || (s.full ? 'Full' : 'Open')}
                    </span>
                    {s.my_status ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-700">
                        <Check className="w-3.5 h-3.5" /> You&apos;re{' '}
                        {s.my_status}
                      </span>
                    ) : portal.allow_booking ? (
                      <button
                        type="button"
                        disabled={busyId === s.id}
                        onClick={() => void book(s.id)}
                        className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {busyId === s.id
                          ? '…'
                          : s.full
                            ? 'Request join (waitlist)'
                            : 'Book appointment'}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
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
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
        )}

        <p className="text-center text-[10px] text-slate-400 pb-8">
          Powered by DentalAdvisor® · SupplierAdvisor
        </p>
      </main>
    </div>
  );
}
