'use client';

/**
 * Public clinic Advisor diary embed — book open public slots by practice token.
 * /embed/advisor/physiograph/{public_token}
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, Check, Loader2, MapPin, Stethoscope } from 'lucide-react';

type Slot = {
  id: string;
  date: string;
  start_time: string;
  service_name: string;
  clinician_name?: string;
  location?: string;
  spots_left: number;
  full: boolean;
  public_notes?: string;
};

type Calendar = {
  brand: string;
  bio?: string;
  allow_booking: boolean;
  contact_email?: string;
  contact_phone?: string;
  primary_color?: string;
  city?: string;
  slots: Slot[];
  clinicians?: Array<{
    name: string;
    disciplines?: string[];
    bio?: string;
    qualifications?: Array<{
      title: string;
      issuer?: string;
      year?: string | null;
      certificates?: Array<{ file_name: string; url: string }>;
    }>;
  }>;
  services?: Array<{ name: string; price_zar?: number }>;
};

const MODULE_LABEL: Record<string, string> = {
  dentalgraph: 'DentalAdvisor®',
  physiograph: 'PhysioAdvisor®',
  medicalgraph: 'MedicalAdvisor®',
  psychiatrygraph: 'PsychiatryAdvisor®',
};

export default function EmbedClinicAdvisorPage() {
  const { module: mod, token } = useParams() as {
    module: string;
    token: string;
  };
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !mod) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/advisor/clinic?module=${encodeURIComponent(mod)}&token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setCalendar(data.calendar);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [mod, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const book = async () => {
    if (!bookingId || !name.trim()) return;
    setSaving(true);
    setDoneMsg(null);
    setError(null);
    try {
      const res = await fetch('/api/public/advisor/clinic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: mod,
          token,
          action: 'book',
          appointment_id: bookingId,
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Book failed');
      setDoneMsg(data.message || 'Booked');
      setBookingId(null);
      void load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Book failed');
    } finally {
      setSaving(false);
    }
  };

  const color = calendar?.primary_color || '#0d9488';
  const label = MODULE_LABEL[mod] || 'Advisor';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && !calendar) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-rose-600 font-semibold">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header
        className="border-b border-slate-200 px-4 py-6"
        style={{ borderTopColor: color, borderTopWidth: 4 }}
      >
        <div className="max-w-lg mx-auto">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {label}
          </p>
          <h1 className="text-2xl font-black mt-1">{calendar?.brand}</h1>
          {calendar?.city ? (
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5" /> {calendar.city}
            </p>
          ) : null}
          {calendar?.bio ? (
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              {calendar.bio}
            </p>
          ) : null}
          {(calendar?.contact_email || calendar?.contact_phone) && (
            <p className="text-xs text-slate-500 mt-2">
              {[calendar.contact_phone, calendar.contact_email]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {error ? (
          <p className="text-sm text-rose-600 font-medium">{error}</p>
        ) : null}
        {doneMsg ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 flex gap-2">
            <Check className="w-4 h-4 shrink-0 mt-0.5" /> {doneMsg}
          </div>
        ) : null}

        {!calendar?.allow_booking ? (
          <p className="text-sm text-slate-500">
            Online booking is paused. Contact the practice to book.
          </p>
        ) : null}

        <section className="space-y-2">
          <h2 className="text-sm font-black flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4" style={{ color }} /> Open diary
          </h2>
          {!calendar?.slots?.length ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No public slots in the next few weeks.
            </p>
          ) : (
            <ul className="space-y-2">
              {calendar.slots.map((s) => (
                <li
                  key={s.id}
                  className="rounded-2xl border border-slate-200 bg-white p-3 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      {s.date} · {s.start_time.slice(0, 5)}
                    </p>
                    <p className="text-[12px] text-slate-600">
                      {s.service_name}
                      {s.clinician_name ? ` · ${s.clinician_name}` : ''}
                    </p>
                    {s.location ? (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {s.location}
                      </p>
                    ) : null}
                  </div>
                  {calendar.allow_booking ? (
                    s.full ? (
                      <button
                        type="button"
                        onClick={() => setBookingId(s.id)}
                        className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-900"
                      >
                        Join waitlist
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setBookingId(s.id)}
                        className="rounded-xl px-3 py-1.5 text-[11px] font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        Book
                      </button>
                    )
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {calendar?.clinicians && calendar.clinicians.length > 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
            <h2 className="text-sm font-black flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4" style={{ color }} /> Team
            </h2>
            <ul className="text-sm space-y-1">
              {calendar.clinicians.slice(0, 12).map((c) => (
                <li key={c.name} className="py-1">
                  <span className="font-semibold">{c.name}</span>
                  {c.disciplines?.length ? (
                    <span className="text-slate-500 text-xs">
                      {' '}
                      · {c.disciplines.join(', ')}
                    </span>
                  ) : null}
                  {c.bio ? (
                    <p className="text-[12px] text-slate-600">{c.bio}</p>
                  ) : null}
                  {(c.qualifications || []).length > 0 ? (
                    <ul className="mt-0.5 text-[11px] text-slate-500">
                      {c.qualifications!.map((q) => (
                        <li key={q.title}>
                          {q.title}
                          {q.issuer || q.year
                            ? ` · ${[q.issuer, q.year].filter(Boolean).join(' · ')}`
                            : ''}
                          {(q.certificates || []).map((d) => (
                            <a
                              key={d.url}
                              href={d.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1 font-bold text-sky-800"
                            >
                              Certificate
                            </a>
                          ))}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {bookingId ? (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 space-y-3 shadow-xl">
              <h3 className="text-lg font-black">Your details</h3>
              <p className="text-xs text-slate-500">
                We&apos;ll reserve your spot (or waitlist if full). Platform
                emails come from SupplierAdvisor® on behalf of the practice.
              </p>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Full name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold"
                  onClick={() => setBookingId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !name.trim()}
                  onClick={() => void book()}
                  className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  style={{ backgroundColor: color }}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <p className="text-[10px] text-center text-slate-400 pt-4">
          Powered by SupplierAdvisor®
        </p>
      </main>
    </div>
  );
}
