'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Menu, X } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] overflow-hidden">
      {/* DESKTOP SIDEBAR – STICKY + SCROLLABLE */}
      <div className="w-72 flex-shrink-0 border-r border-neutral-200 bg-white hidden lg:block sticky top-0 h-screen overflow-y-auto">
        <Sidebar />
      </div>

      {/* MOBILE / TABLET HEADER + HAMBURGER */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-neutral-200 px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-3 hover:bg-neutral-100 rounded-3xl transition-colors"
          >
            <Menu size={26} />
          </button>
          <div className="font-black text-3xl tracking-[-1px] text-[#00b4d8]">SupplierAdvisor®</div>
        </div>
      </div>

      {/* MOBILE/TABLET SLIDE-IN DRAWER – NOW FULLY SCROLLABLE */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsMobileMenuOpen(false)} />

          {/* Drawer – scrollable content */}
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="font-black text-3xl tracking-[-1px] text-[#00b4d8]">SupplierAdvisor®</div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-3 hover:bg-neutral-100 rounded-3xl transition-colors"
              >
                <X size={26} />
              </button>
            </div>

            {/* Scrollable sidebar content */}
            <div className="flex-1 overflow-y-auto">
              <Sidebar />
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA – FULLY RESPONSIVE SCROLL */}
      <div className="flex-1 overflow-auto">
        {/* Extra top padding for mobile fixed header */}
        <div className="lg:hidden h-16" />

        <div className="pl-0 pr-4 md:pr-12 py-6 md:py-12 max-w-screen-2xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}