'use client';

/**
 * B2C class join page — book a Fitgraph class from an invite link
 * and add it to Google Calendar / download .ics.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CalendarPlus,
  Check,
  Download,
  Loader2,
  MapPin,
  User,
  Users,
} from 'lucide-react';
import { FitClassFeedbackForm } from '@/components/fitness/FitClassFeedbackForm';

type JoinSession = {
  id: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  duration_min?: number | null;
  location?: string;
  capacity: number;
  spots_left: number;
  full: boolean;
  class_name: string;
  class_plan?: string;
  public_notes?: string;
  coach_name?: string;
  share_code: string;
};

type JoinPayload = {
  session: JoinSession;
  brand: string;
  timezone: string;
  contact_email?: string;
  contact_phone?: string;
  allow_booking: boolean;
};

export default function JoinFitgraphClassPage() {
  const { token, shareCode } = useParams() as {
    token: string;
    shareCode: string;
  };
  const [join, setJoin] = useState<JoinPayload | null>(null);
  const [gcal, setGcal] = useState<string>('');
  const [ics, setIcs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [done, setDone] = useState<{
    status: string;
    message: string;
  } | null>(null);
  const [fbBusy, setFbBusy] = useState(false);
  const [fbDone, setFbDone] = useState(false);
  const [fbError, setFbError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !shareCode) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        token,
        shareCode,
      });
      const res = await fetch(`/api/public/fitgraph?${q}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Class not found');
      setJoin(data.join);
      setGcal(data.calendar_links?.google || '');
      setIcs(data.calendar_links?.ics || '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load class');
    } finally {
      setLoading(false);
    }
  }, [token, shareCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const whenLabel = useMemo(() => {
    if (!join) return '';
    const s = join.session;
    try {
      const d = new Date(`${s.date}T12:00:00`);
      return `${d.toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })} · ${s.start_time}`;
    } catch {
      return `${s.date} · ${s.start_time}`;
    }
  }, [join]);

  const book = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/public/fitgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'book_class',
          share_code: shareCode,
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      if (data.calendar_links?.google) setGcal(data.calendar_links.google);
      if (data.calendar_links?.ics) setIcs(data.calendar_links.ics);
      setDone({
        status: data.booking?.status || 'booked',
        message:
          data.booking?.message ||
          (data.booking?.status === 'waitlist'
            ? 'You are on the waitlist'
            : 'You are booked in'),
      });
      void load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setBusy(false);
    }
  };

  const downloadIcs = () => {
    if (!ics) return;
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${join?.session.class_name || 'class'}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitFeedback = async (v: {
    feeling: number;
    intensity: number;
    enjoyment: number;
    would_return: number;
    comment: string;
    tags: string[];
  }) => {
    setFbBusy(true);
    setFbError(null);
    try {
      const res = await fetch('/api/public/fitgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'member_feedback',
          share_code: shareCode,
          session_id: join?.session.id,
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          feeling: v.feeling,
          intensity: v.intensity,
          enjoyment: v.enjoyment,
          would_return: v.would_return,
          comment: v.comment || undefined,
          tags: v.tags,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save feedback');
      setFbDone(true);
    } catch (e: unknown) {
      setFbError(e instanceof Error ? e.message : 'Feedback failed');
    } finally {
      setFbBusy(false);
    }
  };

  const classIsPastOrToday = (() => {
    if (!join) return false;
    const today = new Date().toISOString().slice(0, 10);
    return join.session.date <= today;
  })();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (error && !join) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-6">
        <p className="text-rose-600 text-sm text-center max-w-sm">{error}</p>
      </div>
    );
  }

  if (!join) return null;
  const s = join.session;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-violet-50 via-white to-slate-50 text-slate-900">
      <header className="border-b border-violet-100 bg-white/90 backdrop-blur px-4 py-5">
        <div className="max-w-md mx-auto">
          <p className="text-[10px] font-black uppercase tracking-widest text-violet-600">
            {join.brand} · Fitgraph
          </p>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            {s.class_name}
          </h1>
          <p className="text-sm text-slate-600 mt-1">{whenLabel}</p>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        <div className="rounded-3xl border border-violet-100 bg-white p-5 space-y-3 shadow-sm">
          {s.coach_name && (
            <p className="text-sm flex items-center gap-2 text-slate-700">
              <User className="w-4 h-4 text-violet-600" />
              <span>
                Coach <strong>{s.coach_name}</strong>
              </span>
            </p>
          )}
          {s.location && (
            <p className="text-sm flex items-center gap-2 text-slate-700">
              <MapPin className="w-4 h-4 text-violet-600" />
              {s.location}
            </p>
          )}
          <p className="text-sm flex items-center gap-2 text-slate-700">
            <Users className="w-4 h-4 text-violet-600" />
            {s.full
              ? 'Class is full — you can still join the waitlist'
              : `${s.spots_left} spot${s.spots_left === 1 ? '' : 's'} left · cap ${s.capacity}`}
          </p>
          {s.class_plan && (
            <div className="rounded-2xl bg-violet-50 border border-violet-100 px-3 py-2.5">
              <p className="text-[9px] font-black uppercase tracking-wider text-violet-700 mb-1">
                Class plan
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {s.class_plan}
              </p>
            </div>
          )}
        </div>

        {done ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-bold">
              <Check className="w-5 h-5" />
              {done.message}
            </div>
            <p className="text-xs text-emerald-900/80">
              Status: <strong className="uppercase">{done.status}</strong>. Add
              this class to your phone calendar:
            </p>
            <div className="flex flex-wrap gap-2">
              {gcal && (
                <a
                  href={gcal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 text-white px-4 py-2.5 text-sm font-bold"
                >
                  <CalendarPlus className="w-4 h-4" /> Google Calendar
                </a>
              )}
              {ics && (
                <button
                  type="button"
                  onClick={downloadIcs}
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-4 py-2.5 text-sm font-bold text-violet-800"
                >
                  <Download className="w-4 h-4" /> Download .ics
                </button>
              )}
            </div>
          </div>
        ) : join.allow_booking ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
            <h2 className="text-sm font-black">Join this class</h2>
            {error && (
              <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="Your name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="email"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="Email (recommended)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void book()}
              className="w-full rounded-2xl bg-violet-600 text-white py-3 text-sm font-black disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {s.full ? 'Join waitlist' : 'Book my spot'}
            </button>
            <p className="text-[10px] text-slate-500 text-center">
              After booking you can add the class to Google or Apple Calendar.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-600 text-center py-6">
            Online booking is off. Contact the gym to join.
            {join.contact_email ? ` ${join.contact_email}` : ''}
          </p>
        )}

        {!done && (gcal || ics) && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap gap-2 justify-center">
            <span className="text-[10px] font-bold uppercase text-slate-400 w-full text-center">
              Or just save the date
            </span>
            {gcal && (
              <a
                href={gcal}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-violet-700 inline-flex items-center gap-1"
              >
                <CalendarPlus className="w-3.5 h-3.5" /> Google Calendar
              </a>
            )}
            {ics && (
              <button
                type="button"
                onClick={downloadIcs}
                className="text-xs font-bold text-violet-700 inline-flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> .ics file
              </button>
            )}
          </div>
        )}

        {/* Post-class member feedback — same join link, after the session */}
        {classIsPastOrToday && (
          <div className="space-y-2 pt-2">
            {fbDone ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 font-bold flex items-center gap-2">
                <Check className="w-4 h-4" /> Thanks — feedback saved for the gym.
              </div>
            ) : (
              <>
                {fbError && (
                  <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                    {fbError}
                  </p>
                )}
                <FitClassFeedbackForm
                  role="member"
                  requireIdentity
                  name={name}
                  email={email}
                  onNameChange={setName}
                  onEmailChange={setEmail}
                  busy={fbBusy}
                  onSubmit={submitFeedback}
                  description="After you trained — how you feel and how hard the class felt. Use the same name/email you booked with."
                />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
