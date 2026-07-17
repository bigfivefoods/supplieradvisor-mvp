'use client';

/**
 * Live founding free-for-life seat counter for homepage hero.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { FOUNDING_FREE_COMPANY_LIMIT } from '@/lib/billing/lifetime';

export default function FoundingCounterStrip() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [used, setUsed] = useState<number | null>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/public/founding-waitlist', {
          cache: 'no-store',
        });
        const data = await res.json();
        if (cancelled || !res.ok) return;
        setRemaining(typeof data.remaining === 'number' ? data.remaining : null);
        setUsed(typeof data.used === 'number' ? data.used : null);
        setFull(Boolean(data.full));
      } catch {
        /* soft */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (remaining == null) return null;

  const limit = FOUNDING_FREE_COMPANY_LIMIT;
  const filled = used != null ? used : Math.max(0, limit - remaining);
  const pct = Math.min(100, Math.round((filled / limit) * 100));

  return (
    <div className="mt-6 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-sky-50 px-4 py-3.5 text-left shadow-sm sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-800">
          <Sparkles className="h-3.5 w-3.5" />
          Founding free-for-life
        </div>
        <Link
          href="/onboarding?type=business"
          className="text-[11px] font-bold text-[#0077b6] hover:underline"
        >
          {full || remaining <= 0 ? 'Join waitlist →' : 'Claim a seat →'}
        </Link>
      </div>
      <p className="mt-1.5 text-sm font-semibold text-slate-900">
        {full || remaining <= 0 ? (
          <>All {limit} founding seats taken</>
        ) : (
          <>
            <span className="tabular-nums text-violet-700">{remaining}</span> of{' '}
            <span className="tabular-nums">{limit}</span> free-for-life seats left
          </>
        )}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-[#00b4d8] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500">
        {filled} companies already in the founding cohort · first {limit} free for life
      </p>
    </div>
  );
}
