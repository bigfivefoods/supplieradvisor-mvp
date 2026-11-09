'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Providers } from '@/components/Providers';
import SalesShell from '@/components/sales/SalesShell';
import { useCompanyRole } from '@/lib/business/useCompanyRole';

const AppShell = dynamic(() => import('@/components/chrome/AppShell'), {
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
    </div>
  ),
});
const AuthGate = dynamic(() => import('@/components/AuthGate'), {
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
    </div>
  ),
});
const SamMessenger = dynamic(() => import('@/components/sam/SamMessenger'), {
  ssr: false,
});

/**
 * Sales routes:
 * - sales_contractor → dedicated SalesShell only (no full ERP sidebar)
 * - all other roles → same dashboard AppShell so Sales stays open in main nav
 *
 * /sales/agreement paints its heading in the first HTML. The ERP shell
 * (sidebar, command palette, server-only helpers) loads only if this user
 * is not a contractor.
 */
export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <SalesLayoutInner>{children}</SalesLayoutInner>
    </Providers>
  );
}

function SalesLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, loading } = useCompanyRole();
  const earlyAgreement = Boolean(pathname?.startsWith('/sales/agreement'));

  if (loading && earlyAgreement) {
    return (
      <SalesShell>
        {children}
        <SamMessenger />
      </SalesShell>
    );
  }

  // Wait for membership so we don't flash full ERP chrome for contractors
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  // Contractors: portal-only experience (no main ERP sidebar / modules)
  if (role === 'sales_contractor') {
    return (
      <SalesShell>
        {children}
        <SamMessenger />
      </SalesShell>
    );
  }

  // Full team (owner, sales, admin, …): same dashboard shell — Sales stays open in nav
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
