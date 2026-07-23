'use client';

import { Loader2 } from 'lucide-react';
import AuthGate from '@/components/AuthGate';
import AppShell from '@/components/chrome/AppShell';
import SalesShell from '@/components/sales/SalesShell';
import SamMessenger from '@/components/sam/SamMessenger';
import { useCompanyRole } from '@/lib/business/useCompanyRole';

/**
 * Sales routes:
 * - sales_contractor → dedicated SalesShell only (no full ERP sidebar)
 * - all other roles → same dashboard AppShell so Sales stays open in main nav
 */
export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const { role, loading } = useCompanyRole();

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
