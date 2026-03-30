'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { DollarSign, TrendingUp } from 'lucide-react';

export default function BudgetsPage() {
  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Budgets</h1>
        <div className="card p-12">
          <h2 className="text-4xl font-bold mb-8">Budget Overview & Forecasting</h2>
          {/* Full budget tables, charts, and controls go here in next iteration */}
          <p className="text-xl text-slate-600">Module ready for expansion.</p>
        </div>
      </div>
    </div>
  );
}