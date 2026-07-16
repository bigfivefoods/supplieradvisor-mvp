'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { FOUNDING_FREE_COMPANY_LIMIT } from '@/lib/billing/lifetime';

export default function FoundingWaitlist() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/public/founding-waitlist', {
          cache: 'no-store',
        });
        const data = await res.json();
        if (cancelled || !res.ok) return;
        setRemaining(
          typeof data.remaining === 'number' ? data.remaining : null
        );
        setFull(Boolean(data.full));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/public/founding-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, companyName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setMsg(data.message || 'Saved.');
      setRemaining(
        typeof data.remaining === 'number' ? data.remaining : remaining
      );
      setFull(Boolean(data.full));
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  if (remaining == null) return null;

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-violet-200 bg-violet-50/80 px-4 py-5 text-center shadow-sm">
      <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-800">
        <Sparkles className="w-3.5 h-3.5" />
        Founding free-for-life
      </div>

      {full || remaining <= 0 ? (
        <>
          <p className="mt-2 text-sm font-semibold text-violet-950">
            All {FOUNDING_FREE_COMPANY_LIMIT} founding slots are taken.
          </p>
          <p className="mt-1 text-xs text-violet-900/80">
            Join the waitlist — we email a confirmation and contact you when
            access options open.
          </p>
          <form
            onSubmit={(e) => void submit(e)}
            className="mt-3 flex flex-col sm:flex-row gap-2"
          >
            <input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="flex-1 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-violet-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                'Join waitlist'
              )}
            </button>
          </form>
          {msg && (
            <p className="mt-2 text-xs font-semibold text-violet-900">{msg}</p>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-base font-black text-violet-950 tracking-tight">
            {remaining} of {FOUNDING_FREE_COMPANY_LIMIT} free-for-life slots
            left
          </p>
          <p className="mt-1.5 text-xs text-violet-900/85 leading-relaxed max-w-md mx-auto">
            Register your company now to claim a founding seat — no subscription
            fee for life while founding capacity remains.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-full bg-violet-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-900 shadow-md shadow-violet-300/40"
            >
              Claim founding seat
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-900 hover:bg-violet-50"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-3 text-[11px] text-violet-800/70">
            Already full elsewhere?{' '}
            <button
              type="button"
              className="font-bold underline underline-offset-2"
              onClick={() => {
                setFull(true);
              }}
            >
              Join waitlist anyway
            </button>
          </p>
        </>
      )}
    </div>
  );
}
