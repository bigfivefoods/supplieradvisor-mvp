'use client';

/**
 * Gym door QR landing — unique per gym (public_token).
 * Members identify via portal link (localStorage), phone, email, or member code.
 * Access/payment status is shown and logged for the gym owner.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  QrCode,
  ShieldAlert,
  Smartphone,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { gymBrandColor } from '@/lib/fitness/fitgraph';

const MEMBER_TOKEN_KEY = 'sa_fitgraph_member_token';

type GymInfo = {
  brand: string;
  bio?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  primary_color?: string;
  public_token?: string;
  allow_public_booking?: boolean;
};

type CheckinResult = {
  denied?: boolean;
  duplicate?: boolean;
  message?: string;
  owner_alert?: string | null;
  member?: { name: string; code: string; photo_url?: string | null };
  access?: {
    level: string;
    payment_ok: boolean;
    membership_status: string;
    subscription_status: string | null;
    plan_name: string | null;
    alert: string | null;
    member_message: string;
  };
  check_in?: {
    date: string;
    time?: string | null;
    access_level?: string | null;
  };
};

export default function GymCheckinPage() {
  const { token } = useParams() as { token: string };
  const search = useSearchParams();
  const [gym, setGym] = useState<GymInfo | null>(null);
  const [gymCompanyId, setGymCompanyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [memberToken, setMemberToken] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'portal' | 'lookup'>('portal');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MEMBER_TOKEN_KEY) || '';
      const fromQuery = search?.get('member') || search?.get('mt') || '';
      const t = fromQuery || saved;
      if (t) {
        setMemberToken(t);
        setMode('portal');
      }
    } catch {
      /* ignore */
    }
  }, [search]);

  const loadGym = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/fitgraph/checkin?token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gym not found');
      setGym(data.gym);
      setGymCompanyId(
        Number.isFinite(Number(data.companyId)) ? Number(data.companyId) : null
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load gym');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadGym();
  }, [loadGym]);

  const checkIn = async (opts?: { member_token?: string }) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const mt = (opts?.member_token || memberToken).trim();
      if (mt) {
        try {
          localStorage.setItem(MEMBER_TOKEN_KEY, mt);
        } catch {
          /* ignore */
        }
      }
      const res = await fetch('/api/public/fitgraph/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gym_token: token,
          member_token: mt || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          code: code.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-in failed');
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Check-in failed');
    } finally {
      setBusy(false);
    }
  };

  const color = gymBrandColor(gym?.primary_color);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-600" />
      </div>
    );
  }

  if (error && !gym) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center">
          <XCircle className="mx-auto h-10 w-10 text-rose-500" />
          <p className="mt-3 font-black text-slate-900">Invalid gym QR</p>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-slate-50">
      <header
        className="px-4 py-8 text-white"
        style={{
          background: `linear-gradient(135deg, ${color}, #4c1d95)`,
        }}
      >
        <div className="mx-auto max-w-md text-center">
          <QrCode className="mx-auto h-8 w-8 opacity-90" />
          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-white/80">
            GymAdvisor® · door check-in
          </p>
          <h1 className="mt-1 text-2xl font-black">{gym?.brand || 'Gym'}</h1>
          <p className="mt-2 text-sm text-white/90">
            Check in with your phone. Membership status is shared with the gym.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {result ? (
          <div
            className={`rounded-2xl border p-5 ${
              result.denied
                ? 'border-rose-300 bg-rose-50'
                : result.access?.payment_ok === false
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-emerald-300 bg-emerald-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.denied ? (
                <XCircle className="h-8 w-8 shrink-0 text-rose-600" />
              ) : result.access?.payment_ok === false ? (
                <AlertTriangle className="h-8 w-8 shrink-0 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600" />
              )}
              <div>
                <p className="text-lg font-black text-slate-900">
                  {result.denied
                    ? 'Access not approved'
                    : result.duplicate
                      ? 'Already checked in'
                      : 'Checked in'}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {result.message || result.access?.member_message}
                </p>
                {result.member ? (
                  <p className="mt-2 text-sm font-bold text-slate-900">
                    {result.member.name}
                    {result.member.code ? ` · ${result.member.code}` : ''}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                  {result.access?.plan_name ? (
                    <span className="rounded-full bg-white/80 px-2.5 py-1">
                      {result.access.plan_name}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-white/80 px-2.5 py-1">
                    Membership: {result.access?.membership_status || '—'}
                  </span>
                  {result.access?.subscription_status ? (
                    <span className="rounded-full bg-white/80 px-2.5 py-1">
                      Sub: {result.access.subscription_status}
                    </span>
                  ) : null}
                  {result.check_in?.time ? (
                    <span className="rounded-full bg-white/80 px-2.5 py-1">
                      {result.check_in.date} · {result.check_in.time}
                    </span>
                  ) : null}
                </div>
                {result.owner_alert || result.access?.alert ? (
                  <p className="mt-3 flex items-start gap-1.5 text-xs font-semibold text-amber-900">
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Desk notified: {result.owner_alert || result.access?.alert}
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700"
            >
              Check in someone else
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setMode('portal')}
                className={`flex-1 rounded-xl py-2 text-xs font-bold ${
                  mode === 'portal'
                    ? 'bg-[#E8E830] text-slate-900'
                    : 'text-slate-600'
                }`}
              >
                Member portal
              </button>
              <button
                type="button"
                onClick={() => setMode('lookup')}
                className={`flex-1 rounded-xl py-2 text-xs font-bold ${
                  mode === 'lookup'
                    ? 'bg-[#E8E830] text-slate-900'
                    : 'text-slate-600'
                }`}
              >
                Phone / code
              </button>
            </div>

            {mode === 'portal' ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-600">
                  If you use the member app / portal, paste your member link
                  token (or open this page from your portal Check-in button).
                </p>
                <label className="block text-xs font-bold text-slate-700">
                  Member portal token
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-mono"
                    value={memberToken}
                    onChange={(e) => setMemberToken(e.target.value)}
                    placeholder="member_…"
                    autoComplete="off"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !memberToken.trim()}
                  onClick={() => void checkIn()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-600 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Check in now
                </button>
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-600">
                  Enter any detail on your gym membership record.
                </p>
                <label className="block text-xs font-bold text-slate-700">
                  Phone
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0xx…"
                    inputMode="tel"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Email
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    type="email"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Member code / ID
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Your gym code"
                  />
                </label>
                <button
                  type="button"
                  disabled={
                    busy ||
                    (!phone.trim() && !email.trim() && !code.trim())
                  }
                  onClick={() => void checkIn()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-600 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Check in now
                </button>
              </div>
            )}
          </>
        )}

        <div className="rounded-2xl border border-dashed border-yellow-200 bg-white/80 p-4 text-center">
          <Smartphone className="mx-auto h-5 w-5 text-yellow-600" />
          <p className="mt-2 text-xs text-slate-600">
            Not a member yet? Link {gym?.brand || 'this gym'} to your SA Member
            wallet, then check in here.
          </p>
          {gymCompanyId ? (
            <Link
              href={`/me?join=1&kind=gym&company=${gymCompanyId}&brand=${encodeURIComponent(gym?.brand || 'Gym')}`}
              className="mt-3 inline-block rounded-xl bg-yellow-600 px-4 py-2 text-xs font-black text-white"
            >
              Accept & link {gym?.brand || 'gym'}
            </Link>
          ) : null}
          {gym?.allow_public_booking && gym?.public_token ? (
            <Link
              href={`/embed/fitgraph/${encodeURIComponent(gym.public_token)}`}
              className="mt-3 ml-2 inline-block text-xs font-bold text-yellow-700 underline"
            >
              View class schedule
            </Link>
          ) : null}
        </div>

        <p className="text-center text-[10px] text-slate-400">
          Powered by GymAdvisor® · SupplierAdvisor
        </p>
      </main>
    </div>
  );
}
