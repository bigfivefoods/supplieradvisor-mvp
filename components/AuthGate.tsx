'use client';

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Client-side auth gate for all dashboard routes (including select-company).
 * Mobile browsers restore Privy sessions slowly — we wait for `ready` before deciding.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      const next = pathname && pathname.startsWith('/') ? pathname : '/dashboard/select-company';
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [ready, authenticated, router, pathname]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#00b4d8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-500">Checking session…</p>
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
