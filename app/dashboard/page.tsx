'use client';

import { useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { TrendingUp, Users, Truck, DollarSign, Package, ShieldCheck } from 'lucide-react';

export default function DashboardHome() {
  const [expanded, setExpanded] = useState({
    kpis: true,
    customers: true,
    suppliers: true,
    supplyChain: true,
  });

  return (
    <div className="pl-0 pr-4 md:pr-12 py-6 md:py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="font-black text-4xl md:text-5xl tracking-[-2px] text-[#00b4d8]">Supply Chain Pulse</h1>
          <p className="text-lg md:text-xl text-neutral-600">Real-time overview • Updated just now</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-3xl font-medium">All systems operational</div>
          <div className="text-neutral-500">Cape Town, ZA • 14:10 SAST</div>
        </div>
      </div>

      {/* KPI CARDS — FULLY RESPONSIVE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-neutral-100 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-500 text-sm">Total Revenue</p>
              <p className="font-black text-3xl md:text-4xl tracking-tighter mt-2">R 1.2M</p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-500" />
          </div>
          <div className="text-emerald-500 text-xs font-medium mt-4">+12% this month</div>
        </div>

        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-neutral-100 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-500 text-sm">OTIFEF</p>
              <p className="font-black text-3xl md:text-4xl tracking-tighter mt-2">98.4%</p>
            </div>
            <Truck className="w-8 h-8 text-blue-500" />
          </div>
          <div className="text-emerald-500 text-xs font-medium mt-4">+3.2% this month</div>
        </div>

        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-neutral-100 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-500 text-sm">Active Suppliers</p>
              <p className="font-black text-3xl md:text-4xl tracking-tighter mt-2">247</p>
            </div>
            <Users className="w-8 h-8 text-amber-500" />
          </div>
          <div className="text-emerald-500 text-xs font-medium mt-4">+18 this week</div>
        </div>

        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-neutral-100 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-500 text-sm">Gross Profit</p>
              <p className="font-black text-3xl md:text-4xl tracking-tighter mt-2">R 428k</p>
            </div>
            <DollarSign className="w-8 h-8 text-emerald-500" />
          </div>
          <div className="text-emerald-500 text-xs font-medium mt-4">+9% this month</div>
        </div>
      </div>

      {/* CUSTOMER RELATIONSHIP SECTION — RESPONSIVE */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="text-3xl">🤝</div>
          <h2 className="font-black text-2xl md:text-3xl tracking-tight">Customer Relationship</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-neutral-100">
            <p className="text-neutral-500">Active Customers</p>
            <p className="font-black text-5xl md:text-6xl tracking-tighter mt-3">184</p>
          </div>
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-neutral-100">
            <p className="text-neutral-500">Avg Order Value</p>
            <p className="font-black text-5xl md:text-6xl tracking-tighter mt-3">R 6,840</p>
          </div>
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-neutral-100">
            <p className="text-neutral-500">Retention Rate</p>
            <p className="font-black text-5xl md:text-6xl tracking-tighter mt-3">94%</p>
          </div>
        </div>
      </div>

      {/* SUPPLY CHAIN PULSE SECTION — RESPONSIVE */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="text-3xl">📦</div>
          <h2 className="font-black text-2xl md:text-3xl tracking-tight">Supply Chain Pulse</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-neutral-100">
            <div className="flex justify-between items-center">
              <div className="font-medium">On-Time In-Full Delivery</div>
              <div className="text-emerald-600 font-semibold">98.4%</div>
            </div>
            <div className="h-2 bg-neutral-100 rounded-full mt-4 overflow-hidden">
              <div className="h-2 bg-[#00b4d8] w-[98%]" />
            </div>
          </div>
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-neutral-100">
            <div className="flex justify-between items-center">
              <div className="font-medium">Live Shipments</div>
              <div className="text-emerald-600 font-semibold">42 in transit</div>
            </div>
            <div className="mt-6 flex gap-3">
              <div className="flex-1 bg-emerald-50 rounded-2xl p-4 text-center text-sm">12 on sea</div>
              <div className="flex-1 bg-amber-50 rounded-2xl p-4 text-center text-sm">18 by road</div>
              <div className="flex-1 bg-blue-50 rounded-2xl p-4 text-center text-sm">12 by air</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}