'use client';

/**
 * Mobile staff PWA — today's board with one-tap attendance.
 * Share coach/clinician portal token: /staff/advisor/fitgraph/{token}
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, RefreshCw, Smartphone } from 'lucide-react';

type Row = {
  booking_id: string | null;
  time: string;
  title: string;
  attendee: string | null;
  status: string;
  location?: string;
  session_id?: string;
};

export default function StaffAdvisorTodayPage() {
  const { module: mod, token } = useParams() as {
    module: string;
    token: string;
  };
  const [brand, setBrand] = useState('');
  const [staffName, setStaffName] = useState('');
  const [date, setDate] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/advisor/staff-today?module=${encodeURIComponent(mod)}&token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setBrand(data.brand || 'Advisor');
      setStaffName(data.staff?.name || 'Staff');
      setDate(data.date || '');
      setRows(data.rows || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [mod, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const mark = async (
    bookingId: string,
    status: 'attended' | 'no_show' | 'cancelled'
  ) => {
    setBusyId(bookingId);
    setMsg(null);
    try {
      const res = await fetch('/api/public/advisor/staff-today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: mod,
          token,
          booking_id: bookingId,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setMsg(
        data.pack_remaining != null
          ? `Marked ${status.replace('_', ' ')} · pack left ${data.pack_remaining}`
          : `Marked ${status.replace('_', ' ')}`
      );
      void load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 backdrop-blur px-4 py-3">
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-violet-300 flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> Staff today
            </p>
            <p className="font-black text-lg leading-tight">{brand}</p>
            <p className="text-xs text-white/60">
              {staffName}
              {date ? ` · ${date}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-white/20 p-2"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-3 py-4 space-y-3 pb-24">
        {msg ? (
          <p className="rounded-xl bg-emerald-500/20 border border-emerald-400/30 px-3 py-2 text-sm text-emerald-100">
            {msg}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-rose-500/20 border border-rose-400/30 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-white/50 py-16 text-sm">
            Nothing on your board for today.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li
                key={r.booking_id || `open-${r.session_id}-${i}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-3"
              >
                <p className="font-black">
                  <span className="text-violet-300 tabular-nums mr-2">
                    {(r.time || '').slice(0, 5)}
                  </span>
                  {r.title}
                </p>
                <p className="text-xs text-white/60 mt-0.5">
                  {[r.attendee || 'Open slot', r.location, r.status]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {r.booking_id &&
                (r.status === 'booked' || r.status === 'waitlist') ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.booking_id}
                      onClick={() => void mark(r.booking_id!, 'attended')}
                      className="flex-1 min-w-[5rem] rounded-xl bg-emerald-600 py-2.5 text-xs font-black disabled:opacity-50"
                    >
                      Attended
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.booking_id}
                      onClick={() => void mark(r.booking_id!, 'no_show')}
                      className="flex-1 min-w-[5rem] rounded-xl bg-amber-600 py-2.5 text-xs font-black disabled:opacity-50"
                    >
                      No-show
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.booking_id}
                      onClick={() => void mark(r.booking_id!, 'cancelled')}
                      className="rounded-xl border border-white/20 px-3 py-2.5 text-xs font-bold disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
