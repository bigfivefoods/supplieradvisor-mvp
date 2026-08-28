'use client';

import { useEffect } from 'react';
import { Providers } from '@/components/Providers';
import AuthGate from '@/components/AuthGate';
import AppShell from '@/components/chrome/AppShell';
import { usePathname, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { normalizeTeamRole } from '@/lib/business/permissions';
import { fetchCompanyMembership } from '@/lib/client/company-membership';

/**
 * Dashboard shell — collapsible sidebar + process rail.
 * sales_contractor is redirected to /sales (contractor-only portal).
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AuthGate>
        <SalesContractorGuard>
          <DashboardChrome>{children}</DashboardChrome>
        </SalesContractorGuard>
      </AuthGate>
    </Providers>
  );
}

function SalesContractorGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const hideChrome = pathname === '/dashboard/select-company';

  useEffect(() => {
    if (!pathname || hideChrome || !privyUserId) return;
    const companyId = getSelectedCompanyId();
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCompanyMembership(companyId, privyUserId);
        if (cancelled) return;
        if (normalizeTeamRole(data.membership?.role) === 'sales_contractor') {
          router.replace('/sales');
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, hideChrome, privyUserId, router]);

  return <>{children}</>;
}

function DashboardChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = pathname === '/dashboard/select-company';
  return <AppShell hideChrome={hideChrome}>{children}</AppShell>;
}
