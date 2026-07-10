'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGate from '@/components/AuthGate';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

/**
 * Dashboard shell — structure is intentionally simple so no layer can sit on top
 * of the main content and swallow clicks / typing.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const hideChrome = pathname === '/dashboard/select-company';

  // Always close drawer on navigation so an open overlay never blocks the page
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Escape key closes mobile menu
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobileMenuOpen]);

  // Prevent body scroll only while mobile drawer is open
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileMenuOpen]);

  return (
    <AuthGate>
      <div className="flex min-h-screen bg-[#f8fafc]">
        {!hideChrome && (
          <aside className="hidden md:block w-72 flex-shrink-0 border-r border-neutral-200 bg-white sticky top-0 h-screen overflow-y-auto z-20">
            <Sidebar />
          </aside>
        )}

        {/* Main column — always above decorative layers, always receives events */}
        <div className="relative z-10 flex-1 min-w-0 flex flex-col pointer-events-auto">
          {!hideChrome && (
            <header className="md:hidden sticky top-0 z-30 bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-3 hover:bg-neutral-100 rounded-3xl transition-colors cursor-pointer"
                  aria-label="Open menu"
                >
                  <Menu size={26} />
                </button>
                <div className="font-black text-xl tracking-[-1px] text-[#00b4d8]">
                  SupplierAdvisor®
                </div>
              </div>
            </header>
          )}

          <main
            className={
              hideChrome
                ? 'flex-1 relative z-10 pointer-events-auto'
                : 'flex-1 relative z-10 pointer-events-auto pl-0 pr-4 md:pr-8 py-6 md:py-10 max-w-screen-2xl w-full mx-auto'
            }
          >
            {children}
          </main>
        </div>

        {/* Mobile drawer — only mounted when open; high z-index, exclusive to mobile */}
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
              <div
                className="flex-1 overflow-y-auto"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Sidebar />
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}
