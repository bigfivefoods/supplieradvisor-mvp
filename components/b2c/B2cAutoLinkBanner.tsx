'use client';

/**
 * Shows on Advisor patient/member portals — prompts login and auto-links
 * the current portal token into the SA Member app wallet.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';

export function B2cAutoLinkBanner({
  token,
  tone = 'cyan',
}: {
  token: string;
  tone?: 'cyan' | 'violet' | 'teal' | 'rose' | 'indigo' | 'amber';
}) {
  const { ready, authenticated, user, login } = usePrivy();
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    if (!ready || !authenticated || !token || linked) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/b2c/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            privyUserId: getCanonicalUserId(user?.id),
          }),
        });
        if (!cancelled && res.ok) setLinked(true);
      } catch {
        /* soft */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, token, user?.id, linked]);

  if (!ready) return null;

  const tones: Record<string, string> = {
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-950',
    violet: 'border-violet-200 bg-violet-50 text-violet-950',
    teal: 'border-teal-200 bg-teal-50 text-teal-950',
    rose: 'border-rose-200 bg-rose-50 text-rose-950',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-950',
    amber: 'border-amber-200 bg-amber-50 text-amber-950',
  };
  const btn: Record<string, string> = {
    cyan: 'bg-cyan-700',
    violet: 'bg-violet-700',
    teal: 'bg-teal-700',
    rose: 'bg-rose-700',
    indigo: 'bg-indigo-700',
    amber: 'bg-amber-700',
  };

  if (authenticated) {
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${tones[tone]}`}
      >
        <span className="font-bold">
          {linked
            ? 'Saved in SA Member app'
            : 'Signed in — adding to your app…'}
        </span>
        <Link href="/me" className="font-black underline">
          Open app
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-xs text-slate-700 ${tones[tone].split(' ')[0]}`}
    >
      <span>
        Open the SA Member app to keep this brand, book again, and manage all
        Advisors in one place.
      </span>
      <button
        type="button"
        onClick={() =>
          void login({ loginMethods: ['email', 'google', 'apple'] })
        }
        className={`shrink-0 rounded-full px-3 py-1.5 font-bold text-white ${btn[tone]}`}
      >
        Open app
      </button>
    </div>
  );
}
