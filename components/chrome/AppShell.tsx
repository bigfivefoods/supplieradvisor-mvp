'use client';

/**
 * Shared app chrome (sidebar + process rail) for /dashboard/* and full-team /sales/*.
 * sales_contractor uses SalesShell instead — not this chrome.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import ModuleAccessGate from '@/components/ModuleAccessGate';
import ModuleProcessBar from '@/components/chrome/ModuleProcessBar';
import { SidebarProvider } from '@/components/chrome/SidebarContext';
import { X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import SamMessenger from '@/components/sam/SamMessenger';
import SubscriptionAccessBanner from '@/components/billing/SubscriptionAccessBanner';
import CommandPalette from '@/components/chrome/CommandPalette';
import {
  AdvisorSkinApplier,
  AdvisorWordmark,
} from '@/components/brand/AdvisorSkinApplier';
import { useAdvisorSkin } from '@/lib/brand/useAdvisorSkin';
import { PortalBrandLogo } from '@/components/brand/PortalBrandLogo';
import { useCompanyRole } from '@/lib/business/useCompanyRole';

export default function AppShell({
  children,
  hideChrome = false,
}: {
  children: React.ReactNode;
  hideChrome?: boolean;
}) {
  return (
    <SidebarProvider>
      {!hideChrome && <AdvisorSkinApplier />}
      <AppShellInner hideChrome={hideChrome}>{children}</AppShellInner>
      {!hideChrome && <CommandPalette />}
      <SamMessenger />
    </SidebarProvider>
  );
}

function AppShellInner({
  children,
  hideChrome,
}: {
  children: React.ReactNode;
  hideChrome: boolean;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  // Page body waits until the subscription bar has decided to show or stay
  // hidden, so the bar cannot push content that already painted.
  const [mainReady, setMainReady] = useState(hideChrome);
  const [trackedHide, setTrackedHide] = useState(hideChrome);
  if (hideChrome !== trackedHide) {
    setTrackedHide(hideChrome);
    setMainReady(hideChrome);
  }
  const markMainReady = useCallback(() => setMainReady(true), []);
  useEffect(() => {
    if (mainReady || hideChrome) return;
    const timer = window.setTimeout(() => setMainReady(true), 8000);
    return () => window.clearTimeout(timer);
  }, [hideChrome, mainReady]);
  const skin = useAdvisorSkin();
  const { logoUrl, companyName, selectedCompanyId } = useCompanyRole();

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

  return (
    <div className="flex min-h-[100dvh] bg-sa-bg w-full max-w-[100vw] overflow-x-clip">
      {!hideChrome && (
        <aside className="sa-app-aside hidden md:flex flex-col flex-shrink-0 bg-sa-surface sticky top-0 h-[100dvh] overflow-hidden z-20">
          <Sidebar />
        </aside>
      )}

      <div className="relative z-10 flex-1 min-w-0 flex flex-col pointer-events-auto max-w-full">
        {!hideChrome && (
          <div className="sticky top-0 z-40 pt-safe">
            <ModuleProcessBar onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />
            <SubscriptionAccessBanner onReady={markMainReady} />
          </div>
        )}

        {mainReady ? <main
          className={
            hideChrome
              ? 'flex-1 relative z-10 pointer-events-auto min-w-0 w-full'
              : 'flex-1 relative z-10 pointer-events-auto min-w-0 w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 py-4 sm:py-5 md:py-8 max-w-screen-2xl 2xl:max-w-[90rem] mx-auto pb-safe'
          }
        >
          {hideChrome ? (
            <ModuleAccessGate>{children}</ModuleAccessGate>
          ) : (
            <div className="sa-page">
              <ModuleAccessGate>{children}</ModuleAccessGate>
            </div>
          )}
        </main> : null}
      </div>

      {isMobileMenuOpen && !hideChrome && (
        <div
          className="fixed inset-0 z-[200] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 cursor-pointer border-0 p-0"
            aria-label="Close menu"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-[min(18rem,88vw)] bg-sa-surface shadow-2xl flex flex-col z-10 pointer-events-auto pt-safe pb-safe">
            <div className="flex items-center justify-between gap-2 px-4 py-3 shrink-0">
              <Link
                href={skin.homeHref}
                onClick={() => setIsMobileMenuOpen(false)}
                className="sa-brand-lockup flex items-center gap-2.5 min-w-0"
                aria-label={`${skin.name} home`}
              >
                <PortalBrandLogo
                  key={`${selectedCompanyId || 'none'}:${logoUrl || 'sa'}`}
                  logoUrl={logoUrl}
                  name={companyName || skin.registered}
                  className="h-7 w-auto max-w-[5.5rem] object-contain shrink-0"
                  fallbackClassName="sa-logo h-7 w-auto object-contain shrink-0"
                  priority
                />
                <AdvisorWordmark className="sa-wordmark font-black text-base tracking-[-0.5px]" />
              </Link>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0 inline-flex items-center justify-center text-sa-text"
                aria-label="Close menu"
              >
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain scrollbar-none">
              <Sidebar forceExpanded />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
