'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, Check, Loader2, Users } from 'lucide-react';

type PublicSession = {
  id: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  duration_min?: number;
  class_name: string;
  category?: string;
  coach_name?: string;
  location?: string;
  capacity: number;
  spots_left: number;
  full: boolean;
  public_notes?: string;
  /** Planned activities for the class */
  class_plan?: string;
};

type PublicCalendar = {
  brand: string;
  bio?: string;
  timezone?: string;
  allow_booking: boolean;
  contact_email?: string;
  contact_phone?: string;
  primary_color?: string;
  from: string;
  to: string;
  sessions: PublicSession[];
  coaches: Array<{ code: string; name: string; specialties?: string[]; bio?: string }>;
  plans: Array<{
    code: string;
    name: string;
    price_zar: number;
    billing: string;
    description?: string;
  }>;
  contracts?: Array<{
    id: string;
    title: string;
    file_name: string;
    url: string;
    kind?: string;
  }>;
};

export default function EmbedFitgraphPage() {
  const { token } = useParams() as { token: string };
  const [calendar, setCalendar] = useState<PublicCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/fitgraph?token=${encodeURIComponent(token)}`,
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
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const book = async () => {
    if (!bookingId || !name.trim()) return;
    setSaving(true);
    setDoneMsg(null);
    try {
      const res = await fetch('/api/public/fitgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'book',
          session_id: bookingId,
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      setDoneMsg(data.booking?.message || 'Booked');
      if (data.calendar) setCalendar(data.calendar);
      setBookingId(null);
      setName('');
      setEmail('');
      setPhone('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setSaving(false);
    }
  };

  const color = calendar?.primary_color || '#7c3aed';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (error && !calendar) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-rose-600 font-medium">{error}</p>
      </div>
    );
  }

  if (!calendar) return null;

  // Group by date
  const byDate = new Map<string, PublicSession[]>();
  for (const s of calendar.sessions) {
    const list = byDate.get(s.date) || [];
    list.push(s);
    byDate.set(s.date, list);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header
        className="border-b border-slate-200/80 px-4 py-6 sm:px-8"
        style={{ borderBottomColor: `${color}33` }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
            <CalendarDays className="w-3.5 h-3.5" style={{ color }} />
            Class schedule
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mt-1" style={{ color }}>
            {calendar.brand}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {calendar.timezone || 'Africa/Johannesburg'} · {calendar.from} →{' '}
            {calendar.to}
          </p>
          {(calendar.contact_email || calendar.contact_phone) && (
            <p className="text-xs text-slate-500 mt-2">
              {[calendar.contact_email, calendar.contact_phone]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {calendar.bio && (
            <p className="text-sm text-slate-600 mt-3 max-w-2xl leading-relaxed">
              {calendar.bio}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 sm:px-8 space-y-8">
        {doneMsg && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4" /> {doneMsg}
          </div>
        )}
        {error && calendar && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {byDate.size === 0 ? (
          <p className="text-center text-slate-500 py-12 text-sm">
            No public classes in this window. Check back soon.
          </p>
        ) : (
          [...byDate.entries()].map(([date, sessions]) => (
            <section key={date}>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                {date}
              </h2>
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-sm">
                        {s.start_time}
                        {s.end_time ? `–${s.end_time}` : ''} · {s.class_name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {s.coach_name || 'Coach TBC'}
                        {s.location ? ` · ${s.location}` : ''}
                        {' · '}
                        <span className="inline-flex items-center gap-0.5">
                          <Users className="w-3 h-3" />
                          {s.full
                            ? 'Full'
                            : `${s.spots_left} spot${s.spots_left === 1 ? '' : 's'} left`}
                        </span>
                      </div>
                      {(s.class_plan || s.public_notes) && (
                        <div className="mt-1.5 rounded-xl bg-violet-50 border border-violet-100 px-2.5 py-1.5">
                          <p className="text-[9px] font-black uppercase tracking-wider text-violet-700 mb-0.5">
                            Class plan
                          </p>
                          <p className="text-[11px] text-slate-700 whitespace-pre-wrap">
                            {s.class_plan || s.public_notes}
                          </p>
                        </div>
                      )}
                    </div>
                    {calendar.allow_booking && (
                      <button
                        type="button"
                        onClick={() => {
                          setBookingId(s.id);
                          setError(null);
                          setDoneMsg(null);
                        }}
                        className="text-xs font-bold px-3 py-2 rounded-xl text-white self-center"
                        style={{
                          backgroundColor: s.full ? '#94a3b8' : color,
                        }}
                      >
                        {s.full ? 'Join waitlist' : 'Book'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

        {calendar.coaches.length > 0 && (
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
              Coaches
            </h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {calendar.coaches.map((c) => (
                <div
                  key={c.code}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="font-bold text-sm">{c.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {(c.specialties || []).join(' · ') || c.code}
                  </div>
                  {c.bio && (
                    <p className="text-[12px] text-slate-600 mt-1">{c.bio}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {calendar.plans.length > 0 && (
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
              Memberships
            </h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {calendar.plans.map((p) => (
                <div
                  key={p.code}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="font-bold text-sm">{p.name}</div>
                  <div className="text-lg font-black tabular-nums" style={{ color }}>
                    R{p.price_zar}
                    <span className="text-[11px] font-bold text-slate-400 ml-1">
                      / {p.billing}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-[12px] text-slate-600 mt-1">
                      {p.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {(calendar.contracts || []).length > 0 && (
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
              Contracts & policies
            </h2>
            <ul className="space-y-2">
              {(calendar.contracts || []).map((doc) => (
                <li key={doc.id}>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold hover:border-slate-300 hover:bg-slate-50"
                  >
                    <span className="min-w-0 truncate">
                      {doc.title}
                      {doc.kind ? (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          {String(doc.kind).replace(/_/g, ' ')}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[11px] font-bold shrink-0" style={{ color }}>
                      Download PDF
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {bookingId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 space-y-3 shadow-xl">
            <h3 className="font-black text-lg">Book class</h3>
            <p className="text-xs text-slate-500">
              We&apos;ll reserve your spot (or waitlist if full).
            </p>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Your name *"
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
              placeholder="Phone / WhatsApp"
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
                className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white inline-flex justify-center items-center gap-1.5"
                style={{ backgroundColor: color }}
                onClick={() => void book()}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center text-[10px] text-slate-400 py-8">
        Powered by Fitgraph® · SupplierAdvisor
      </footer>
    </div>
  );
}
