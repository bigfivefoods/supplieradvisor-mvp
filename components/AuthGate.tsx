'use client';

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { usePathname, useRouter } from 'next/navigation';

const PUBLIC_DASHBOARD_PATHS = ['/dashboard/select-company'];

/**
 * Client-side auth gate for dashboard routes.
 * Privy sessions live primarily in the browser; this avoids a brittle cookie middleware check.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = PUBLIC_DASHBOARD_PATHS.some(
    (path) => pathname === path || pathname?.startsWith(`${path}/`)
  );

  useEffect(() => {
    if (!ready || isPublic) return;
    if (!authenticated) {
      router.replace('/login');
    }
  }, [ready, authenticated, isPublic, router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#00b4d8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-500">Checking session…</p>
        </div>
      </div>
    );
  }

  if (!authenticated && !isPublic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#00b4d8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-500">Redirecting to login…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
