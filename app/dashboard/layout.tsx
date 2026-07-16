'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGate from '@/components/AuthGate';
import ModuleAccessGate from '@/components/ModuleAccessGate';
import ModuleProcessBar from '@/components/chrome/ModuleProcessBar';
import { SidebarProvider, useSidebarChrome } from '@/components/chrome/SidebarContext';
import { X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { normalizeTeamRole } from '@/lib/business/permissions';
import SamMessenger from '@/components/sam/SamMessenger';
import SubscriptionAccessBanner from '@/components/billing/SubscriptionAccessBanner';
/**
 * Dashboard shell — collapsible icon sidebar + single sticky process / Action centre rail.
 * SAM (Supplier Advisor Messenger) is available on every authenticated dashboard screen.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <SidebarProvider>
        <DashboardChrome>{children}</DashboardChrome>
        <SamMessenger />
      </SidebarProvider>
    </AuthGate>
  );
}

function DashboardChrome({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const hideChrome = pathname === '/dashboard/select-company';
  const { collapsed } = useSidebarChrome();

  useEffect(() => {
    if (!pathname || hideChrome || !privyUserId) return;
    const companyId = getSelectedCompanyId();
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          companyId: String(companyId),
          privyUserId,
        });
        const res = await fetch(`/api/business/membership?${params}`);
        const data = await res.json();
        if (cancelled || !res.ok) return;
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

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileMenuOpen]);

  const asideWidth = collapsed ? 'md:w-[72px]' : 'md:w-72';

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      {!hideChrome && (
        <aside
          className={`hidden md:flex flex-col flex-shrink-0 border-r border-neutral-200 bg-white sticky top-0 h-screen overflow-hidden z-20 transition-[width] duration-200 ease-out ${asideWidth}`}
        >
          <Sidebar />
        </aside>
      )}

      <div className="relative z-10 flex-1 min-w-0 flex flex-col pointer-events-auto">
        {!hideChrome && (
          <div className="sticky top-0 z-40">
            {/* One rail only: mobile menu · process steps · Action centre */}
            <ModuleProcessBar onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />
            <SubscriptionAccessBanner />
          </div>
        )}

        <main
          className={
            hideChrome
              ? 'flex-1 relative z-10 pointer-events-auto'
              : 'flex-1 relative z-10 pointer-events-auto px-3 sm:px-4 md:px-6 lg:px-8 py-5 md:py-8 max-w-screen-2xl w-full mx-auto'
          }
        >
          <ModuleAccessGate>{children}</ModuleAccessGate>
        </main>
      </div>

      {isMobileMenuOpen && !hideChrome && (
        <div className="fixed inset-0 z-[200] md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 cursor-pointer border-0 p-0"
            aria-label="Close menu"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col z-10 pointer-events-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="font-black text-xl tracking-[-1px] text-[#00b4d8]">
                SupplierAdvisor®
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-3 cursor-pointer"
                aria-label="Close menu"
              >
                <X size={26} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto" onClick={() => setIsMobileMenuOpen(false)}>
              <Sidebar forceExpanded />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
