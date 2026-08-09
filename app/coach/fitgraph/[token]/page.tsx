'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Share2,
  UserPlus,
} from 'lucide-react';

type RosterRow = {
  booking_id: string;
  status: string;
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
    share_code?: string | null;
    public_notes?: string;
    status: string;
    notes?: string;
  };
  class_name?: string;
  capacity: number;
  booked: number;
  waitlist: number;
  roster: RosterRow[];
};

type Portal = {
  coach: { id: string; code: string; name: string; can_manage_classes?: boolean };
  from: string;
  to: string;
  sessions: PortalSession[];
};

export default function CoachFitgraphPortalPage() {
  const { token } = useParams() as { token: string };
  const [portal, setPortal] = useState<Portal | null>(null);
  const [brand, setBrand] = useState('Gym');
  const [publicToken, setPublicToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [guestFor, setGuestFor] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/public/fitgraph/coach?token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPortal(data.portal);
      setBrand(data.brand || 'Gym');
      setPublicToken(data.public_token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

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

  const shareUrl =
    typeof window !== 'undefined' && publicToken
      ? `${window.location.origin}/embed/fitgraph/${encodeURIComponent(publicToken)}`
      : '';

  const copyShare = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-5 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-[10px] font-black uppercase tracking-widest text-violet-400">
            Coach portal · {brand}
          </div>
          <h1 className="text-xl font-black mt-1">{portal.coach.name}</h1>
          <p className="text-xs text-slate-400 mt-1">
            Your classes {portal.from} → {portal.to}. Share with members, manage
            roster, book walk-ins.
          </p>
          {shareUrl && (
            <button
              type="button"
              onClick={() => void copyShare()}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-violet-300 hover:text-white"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? 'Copied gym calendar link' : 'Copy gym public calendar link'}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 sm:px-6 space-y-4">
        {error && (
          <div className="rounded-2xl border border-rose-900/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {portal.sessions.length === 0 ? (
          <p className="text-center text-slate-500 py-16 text-sm">
            No sessions assigned to you in this window.
          </p>
        ) : (
          portal.sessions.map((row) => {
            const s = row.session;
            return (
              <article
                key={s.id}
                className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 space-y-3"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <div className="font-bold">
                      {s.date} · {s.start_time} · {row.class_name || 'Class'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {s.location || '—'} · {row.booked}/{row.capacity} booked
                      {row.waitlist > 0 ? ` · ${row.waitlist} waitlist` : ''}
                      {s.public ? ' · public' : ' · private'}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void post({
                          action: 'share_session',
                          session_id: s.id,
                          public: !s.public,
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-700 px-2.5 py-1.5 text-[11px] font-bold hover:bg-slate-800"
                    >
                      {s.public ? (
                        <>
                          <EyeOff className="w-3 h-3" /> Unshare
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3 h-3" /> Share publicly
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setGuestFor(s.id);
                        setGuestName('');
                        setGuestEmail('');
                      }}
                      className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-2.5 py-1.5 text-[11px] font-bold hover:bg-violet-500"
                    >
                      <UserPlus className="w-3 h-3" /> Book guest
                    </button>
                  </div>
                </div>

                {s.public && shareUrl && (
                  <div className="text-[10px] text-violet-300/90 flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Visible on public calendar
                  </div>
                )}

                {row.roster.length > 0 && (
                  <ul className="space-y-1.5 border-t border-slate-800 pt-3">
                    {row.roster.map((r) => (
                      <li
                        key={r.booking_id}
                        className="flex flex-wrap justify-between gap-2 text-sm"
                      >
                        <span>
                          <span className="font-medium">{r.name}</span>
                          <span className="text-[10px] uppercase text-slate-500 ml-2">
                            {r.status}
                          </span>
                        </span>
                        {r.status === 'booked' && (
                          <button
                            type="button"
                            disabled={busy}
                            className="text-[11px] font-bold text-emerald-400"
                            onClick={() =>
                              void post({
                                action: 'mark_attended',
                                booking_id: r.booking_id,
                              })
                            }
                          >
                            Mark attended
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })
        )}
      </main>

      {guestFor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-black">Book walk-in / guest</h3>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Name *"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
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
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-bold inline-flex justify-center items-center gap-1.5"
                onClick={() =>
                  void post({
                    action: 'book_guest',
                    session_id: guestFor,
                    name: guestName.trim(),
                    email: guestEmail.trim() || undefined,
                  }).then(() => setGuestFor(null))
                }
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
