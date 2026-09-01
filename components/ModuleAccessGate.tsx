'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  canAccessPath,
  defaultHomePathForRole,
  normalizeTeamRole,
  resourceForPath,
  resourceLabel,
  type TeamRole,
} from '@/lib/business/permissions';

/**
 * Redirects limited roles (e.g. sales_contractor) away from modules they cannot access.
 * Sits inside dashboard layout after AuthGate.
 */
export default function ModuleAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Always allow company picker
      if (!pathname || pathname.startsWith('/dashboard/select-company')) {
        if (!cancelled) {
          setChecking(false);
          setDenied(null);
        }
        return;
      }

      const companyId = getSelectedCompanyId();
      if (!companyId || !privyUserId) {
        if (!cancelled) {
          setChecking(false);
          setDenied(null);
        }
        return;
      }

      try {
        const params = new URLSearchParams({
          companyId: String(companyId),
          privyUserId,
        });
        const res = await fetch(`/api/business/membership?${params}`);
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setChecking(false);
          setDenied(null);
          return;
        }

        const role = normalizeTeamRole(data.membership?.role) as TeamRole;
        if (!canAccessPath(role, pathname, 'view')) {
          const resource = resourceForPath(pathname);
          const home = defaultHomePathForRole(role);
          setDenied(
            resource
              ? `Your role (${data.membership?.roleLabel || role}) cannot access ${resourceLabel(resource)}.`
              : 'You do not have access to this area.'
          );
          router.replace(home);
          return;
        }
        setDenied(null);
      } catch {
        if (!cancelled) setDenied(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, privyUserId, router]);

  if (checking && pathname && !pathname.startsWith('/dashboard/select-company')) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#00b4d8] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-neutral-500">Checking access…</p>
        </div>
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex items-center justify-center py-24 px-6">
        <div className="max-w-md text-center rounded-3xl border border-amber-200 bg-amber-50 p-8">
          <p className="font-semibold text-amber-900 mb-2">Access restricted</p>
          <p className="text-sm text-amber-800">{denied}</p>
          <p className="text-xs text-amber-700 mt-3">Redirecting to your allowed workspace…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
