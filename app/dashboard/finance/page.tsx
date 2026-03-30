'use client';

import Link from 'next/link';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { DollarSign, FileText, TrendingUp, PieChart, CreditCard } from 'lucide-react';

export default function FinanceHub() {
  const nodes = [
    { name: 'Budgets', href: '/dashboard/finance/budgets', icon: DollarSign },
    { name: 'Invoices & Payments', href: '/dashboard/finance/invoices', icon: FileText },
    { name: 'Financial Reports', href: '/dashboard/finance/reports', icon: TrendingUp },
    { name: 'Forecasting', href: '/dashboard/finance/forecasting', icon: PieChart },
    { name: 'Cash Flow', href: '/dashboard/finance/cashflow', icon: CreditCard },
  ];

  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Finance</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nodes.map((node, i) => (
            <Link key={i} href={node.href} className="card group hover:border-[#00b4d8] transition-all">
              <div className="flex items-center gap-6 p-8">
                <node.icon size={48} className="text-[#00b4d8]" />
                <div>
                  <h3 className="text-3xl font-bold">{node.name}</h3>
                  <p className="text-slate-600 mt-2">Click to open module →</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}