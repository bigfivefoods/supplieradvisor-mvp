'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGate from '@/components/AuthGate';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const hideChrome = pathname === '/dashboard/select-company';

  return (
    <AuthGate>
      <div className="flex min-h-screen bg-[#f8fafc]">
        {!hideChrome && (
          <>
            {/* DESKTOP SIDEBAR */}
            <div className="w-72 flex-shrink-0 border-r border-neutral-200 bg-white hidden md:block sticky top-0 h-screen overflow-y-auto">
              <Sidebar />
            </div>

            {/* MOBILE HEADER */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-neutral-200 px-4 py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-3 hover:bg-neutral-100 rounded-3xl transition-colors"
                  aria-label="Open menu"
                >
                  <Menu size={26} />
                </button>
                <div className="font-black text-2xl tracking-[-1px] text-[#00b4d8]">SupplierAdvisor®</div>
              </div>
            </div>

            {/* MOBILE DRAWER */}
            {isMobileMenuOpen && (
              <div className="fixed inset-0 z-[100] md:hidden">
                <div className="absolute inset-0 bg-black/60" onClick={() => setIsMobileMenuOpen(false)} />
                <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b">
                    <div className="font-black text-2xl tracking-[-1px] text-[#00b4d8]">SupplierAdvisor®</div>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="p-3" aria-label="Close menu">
                      <X size={26} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto" onClick={() => setIsMobileMenuOpen(false)}>
                    <Sidebar />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* MAIN CONTENT */}
        <div className="flex-1 overflow-auto min-w-0">
          {!hideChrome && <div className="md:hidden h-16" />}
          <div className={hideChrome ? '' : 'pl-0 pr-4 md:pr-8 py-6 md:py-10 max-w-screen-2xl mx-auto'}>
            {children}
          </div>
        </div>
      </div>
    </AuthGate>
  );
}