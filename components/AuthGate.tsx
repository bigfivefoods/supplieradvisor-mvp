'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { usePathname, useRouter } from 'next/navigation';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';

/**
 * Client-side auth gate for all dashboard routes (including select-company).
 * Mobile browsers restore Privy sessions slowly — we wait for `ready` before deciding.
 * Pure independent contractors are redirected to /contractor (no business shell).
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const router = useRouter();
  const pathname = usePathname();
  const [roleChecked, setRoleChecked] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setRoleChecked(false);
      const next = pathname && pathname.startsWith('/') ? pathname : '/dashboard/select-company';
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    // Already checked this session — do not re-block the whole dashboard on route changes
    // (pathname was in deps before and re-ran the gate constantly).
    if (roleChecked) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/contractor/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privyUserId: getCanonicalUserId(user?.id),
            email: extractEmailFromPrivyUser(user),
          }),
        });
        const data = await res.json();
        if (cancelled) return;

        // Pure operators must not access business dashboard
        if (data.isContractor && !data.isBusinessUser) {
          setBlocked(true);
          router.replace('/contractor');
          return;
        }
      } catch {
        // Fail open for business users if session check fails
      } finally {
        if (!cancelled) setRoleChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally omit pathname — navigating inside dashboard must not re-lock UI
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, user?.id, router, roleChecked]);

  if (!ready || (authenticated && !roleChecked) || blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#00b4d8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-500">
            {blocked ? 'Opening your operator portal…' : 'Checking session…'}
          </p>
          <p className="text-xs text-neutral-400 mt-2">This can take a moment on mobile</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="text-center max-w-sm">
          <div className="w-8 h-8 border-4 border-[#00b4d8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-600 font-medium">Redirecting to sign in…</p>
          <p className="text-sm text-neutral-400 mt-2">You need to log in to access your companies</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
