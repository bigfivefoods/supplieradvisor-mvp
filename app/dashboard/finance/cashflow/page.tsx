'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { CreditCard } from 'lucide-react';

export default function CashflowPage() {
  return (
    <div className="pl-[25px] min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Cash Flow Management</h1>
        <div className="card p-12">
          <h2 className="text-4xl font-bold mb-8">Cash Flow Dashboard & Projections</h2>
          <p className="text-xl text-slate-600">Real-time cash position, inflows/outflows, and 90-day projections.</p>
        </div>
      </div>
    </div>
  );
}