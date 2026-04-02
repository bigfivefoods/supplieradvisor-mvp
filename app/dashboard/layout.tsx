'use client';

import { ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      {/* Sidebar now expands vertically when many modules are open */}
      <div className="w-80 flex-shrink-0 border-r border-neutral-200 bg-white hidden md:block">
        <Sidebar />
      </div>

      {/* Main content - scrolls normally */}
      <div className="flex-1 overflow-auto">
        <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}