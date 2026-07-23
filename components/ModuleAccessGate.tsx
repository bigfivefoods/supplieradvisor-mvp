'use client';

import { useEffect, useRef, useState } from 'react';
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
import {
  isModuleEnabled,
  moduleIdForPath,
  normalizeEnabledModules,
} from '@/lib/business/company-modules';

/**
 * Soft route guard for limited roles (e.g. sales_contractor).
 *
 * IMPORTANT: Never unmount page children while checking — that freezes nav/tabs.
 * Only redirect after we know the role and the path is denied.
 */
export default function ModuleAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [denied, setDenied] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Always allow company picker
      if (!pathname || pathname.startsWith('/dashboard/select-company')) {
        if (!cancelled) setDenied(null);
        return;
      }

      const companyId = getSelectedCompanyId();
      if (!companyId || !privyUserId) {
        if (!cancelled) setDenied(null);
        return;
      }

      if (inFlight.current) return;
      inFlight.current = true;

      try {
        const params = new URLSearchParams({
          companyId: String(companyId),
          privyUserId,
        });
        const res = await fetch(`/api/business/membership?${params}`);
        const data = await res.json();
        if (cancelled) return;

        // Fail open — never lock the UI if membership cannot be loaded
        if (!res.ok) {
          setDenied(null);
          return;
        }

        const role = normalizeTeamRole(data.membership?.role) as TeamRole;
        if (!canAccessPath(role, pathname, 'view')) {
          const resource = resourceForPath(pathname);
          const home = defaultHomePathForRole(role);
          // Don't redirect to the same path (loop)
          if (home && home !== pathname) {
            setDenied(
              resource
                ? `Your role (${data.membership?.roleLabel || role}) cannot access ${resourceLabel(resource)}.`
                : 'You do not have access to this area.'
            );
            router.replace(home);
          } else {
            setDenied(null);
          }
          return;
        }

        // Company disabled this module in profile (default all enabled)
        const enabled = normalizeEnabledModules(data.enabledModules);
        const modId = moduleIdForPath(pathname);
        if (modId && !isModuleEnabled(enabled, modId)) {
          const home = defaultHomePathForRole(role) || '/dashboard';
          if (home !== pathname) {
            setDenied(
              `This company has turned off the “${modId}” module. Enable it under Company → Profile → Modules.`
            );
            router.replace(home);
          } else {
            setDenied(null);
          }
          return;
        }

        setDenied(null);
      } catch {
        if (!cancelled) setDenied(null);
      } finally {
        inFlight.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, privyUserId, router]);

  // Soft banner only — always keep children mounted so clicks/nav keep working
  return (
    <>
      {denied && (
        <div className="mb-4 mx-2 sm:mx-0 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 relative z-20 pointer-events-none">
          <strong className="font-semibold">Access restricted.</strong> {denied} Redirecting…
        </div>
      )}
      <div className="relative z-10 pointer-events-auto">{children}</div>
    </>
  );
}
