'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { TrendingUp } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Financial Reports</h1>
        <div className="card p-12">
          <h2 className="text-4xl font-bold mb-8">P&L, Balance Sheet & Cash Flow Reports</h2>
          <p className="text-xl text-slate-600">Full reporting dashboard with export to PDF/Excel coming next sprint.</p>
        </div>
      </div>
    </div>
  );
}