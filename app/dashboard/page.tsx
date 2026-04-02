'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { TrendingUp, Users, Truck, DollarSign } from 'lucide-react';

export default function DashboardHome() {
  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Home' },
  ];

  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb items={breadcrumbItems} />

      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-black text-5xl tracking-tight text-[#00b4d8]">Supply Chain Pulse</h1>
          <p className="text-xl text-neutral-600">Real-time overview • Updated just now</p>
        </div>
      </div>

      {/* Top KPI Cards - 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-500 text-sm">Total Revenue</p>
              <p className="font-black text-4xl tracking-tighter mt-2">R 1.2M</p>
            </div>
            <div className="text-emerald-500 text-xs font-medium">+12% this month</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-500 text-sm">OTIFEF</p>
              <p className="font-black text-4xl tracking-tighter mt-2">96.8%</p>
            </div>
            <div className="text-emerald-500 text-xs font-medium">+2.1% this month</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-500 text-sm">Active Suppliers</p>
              <p className="font-black text-4xl tracking-tighter mt-2">42</p>
            </div>
            <div className="text-emerald-500 text-xs font-medium">+3 this month</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-500 text-sm">Inventory Value</p>
              <p className="font-black text-4xl tracking-tighter mt-2">R 1.8M</p>
            </div>
            <div className="text-rose-500 text-xs font-medium">-4% this month</div>
          </div>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="text-3xl">💰</div>
          <h2 className="font-black text-3xl tracking-tight">Financial Overview</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
            <p className="text-neutral-500">Total Revenue</p>
            <p className="font-black text-4xl tracking-tighter mt-3">R 1.2M</p>
          </div>
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
            <p className="text-neutral-500">Gross Profit</p>
            <p className="font-black text-4xl tracking-tighter mt-3">R 428k</p>
          </div>
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
            <p className="text-neutral-500">Cash on Hand</p>
            <p className="font-black text-4xl tracking-tighter mt-3">R 892k</p>
          </div>
        </div>
      </div>

      {/* Customer Relationship */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="text-3xl">🤝</div>
          <h2 className="font-black text-3xl tracking-tight">Customer Relationship</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
            <p className="text-neutral-500">Active Customers</p>
            <p className="font-black text-5xl tracking-tighter mt-3">184</p>
          </div>
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
            <p className="text-neutral-500">Avg Order Value</p>
            <p className="font-black text-5xl tracking-tighter mt-3">R 6,840</p>
          </div>
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
            <p className="text-neutral-500">Retention Rate</p>
            <p className="font-black text-5xl tracking-tighter mt-3">94%</p>
          </div>
        </div>
      </div>
    </div>
  );
}