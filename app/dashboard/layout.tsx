'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Menu, X } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] overflow-hidden">
      {/* DESKTOP SIDEBAR – fixed width, always visible on large screens */}
      <div className="w-72 flex-shrink-0 border-r border-neutral-200 bg-white hidden lg:block">
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

      {/* MOBILE SLIDE-IN SIDEBAR (full height drawer) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={closeMenu}
          />
          {/* Drawer */}
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="font-black text-3xl tracking-[-1px] text-[#00b4d8]">SupplierAdvisor®</div>
              <button
                onClick={closeMenu}
                className="p-3 hover:bg-neutral-100 rounded-3xl transition-colors"
              >
                <X size={26} />
              </button>
            </div>
            <Sidebar />
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA – fully responsive padding */}
      <div className="flex-1 overflow-auto">
        {/* Extra top padding only on mobile to make space for fixed header */}
        <div className="lg:hidden h-16" />
        
        <div className="pl-0 pr-4 md:pr-12 py-6 md:py-12 max-w-screen-2xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}