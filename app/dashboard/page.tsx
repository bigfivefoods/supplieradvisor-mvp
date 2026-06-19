'use client';

import Link from 'next/link';
import { 
  TrendingUp, Users, Truck, DollarSign, Package, ShieldCheck,
  ArrowUpRight, Clock, Plus, UserPlus, BarChart3
} from 'lucide-react';

export default function DashboardHome() {
  return (
    <div className="px-4 md:px-8 lg:pr-12 py-8 lg:py-12 max-w-screen-2xl mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
          <h1 className="font-black text-4xl md:text-5xl lg:text-6xl tracking-[-2.5px] text-[#00b4d8]">
            Supply Chain Pulse
          </h1>
          <p className="text-lg md:text-xl text-neutral-600 mt-2">
            Real-time overview of your operations
          </p>
        </div>
        
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-3xl font-medium">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            All systems operational
          </div>
          <div className="text-neutral-500 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Cape Town • Just now
          </div>
        </div>
      </div>

      {/* KEY METRICS */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-xl tracking-tight">Key Metrics</h2>
          <Link href="/dashboard/reports" className="text-sm text-[#00b4d8] hover:underline flex items-center gap-1">
            View detailed reports <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue */}
          <div className="bg-white rounded-3xl p-6 md:p-7 border border-neutral-200 hover:border-neutral-300 transition-all group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Total Revenue</p>
                <p className="font-black text-4xl md:text-5xl tracking-[-1.5px] mt-3">R1.24M</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-2xl group-hover:bg-emerald-200 transition-colors">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm">
              <span className="text-emerald-600 font-medium">+12.4%</span>
              <span className="text-neutral-500">from last month</span>
            </div>
          </div>

          {/* OTIF */}
          <div className="bg-white rounded-3xl p-6 md:p-7 border border-neutral-200 hover:border-neutral-300 transition-all group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">OTIF Performance</p>
                <p className="font-black text-4xl md:text-5xl tracking-[-1.5px] mt-3">98.4%</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-2xl group-hover:bg-blue-200 transition-colors">
                <Truck className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm">
              <span className="text-emerald-600 font-medium">+3.2%</span>
              <span className="text-neutral-500">from last month</span>
            </div>
          </div>

          {/* Active Suppliers */}
          <div className="bg-white rounded-3xl p-6 md:p-7 border border-neutral-200 hover:border-neutral-300 transition-all group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Active Suppliers</p>
                <p className="font-black text-4xl md:text-5xl tracking-[-1.5px] mt-3">247</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-2xl group-hover:bg-amber-200 transition-colors">
                <Users className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm">
              <span className="text-emerald-600 font-medium">+18</span>
              <span className="text-neutral-500">new this week</span>
            </div>
          </div>

          {/* Gross Profit */}
          <div className="bg-white rounded-3xl p-6 md:p-7 border border-neutral-200 hover:border-neutral-300 transition-all group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Gross Profit</p>
                <p className="font-black text-4xl md:text-5xl tracking-[-1.5px] mt-3">R428k</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-2xl group-hover:bg-emerald-200 transition-colors">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm">
              <span className="text-emerald-600 font-medium">+9.1%</span>
              <span className="text-neutral-500">from last month</span>
            </div>
          </div>
        </div>
      </div>

      {/* CUSTOMER INSIGHTS */}
      <div className="mb-12">
        <h2 className="font-semibold text-xl tracking-tight mb-6">Customer Insights</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-3xl p-7 md:p-8 border border-neutral-200">
            <p className="text-sm font-medium text-neutral-500">Active Customers</p>
            <p className="font-black text-4xl md:text-5xl lg:text-6xl tracking-[-2px] mt-4">184</p>
            <p className="text-emerald-600 text-sm mt-3">+22 new this month</p>
          </div>

          <div className="bg-white rounded-3xl p-7 md:p-8 border border-neutral-200">
            <p className="text-sm font-medium text-neutral-500">Average Order Value</p>
            <p className="font-black text-4xl md:text-5xl lg:text-6xl tracking-[-2px] mt-4">R6,840</p>
            <p className="text-emerald-600 text-sm mt-3">+8% from last month</p>
          </div>

          <div className="bg-white rounded-3xl p-7 md:p-8 border border-neutral-200">
            <p className="text-sm font-medium text-neutral-500">Customer Retention</p>
            <p className="font-black text-4xl md:text-5xl lg:text-6xl tracking-[-2px] mt-4">94%</p>
            <p className="text-emerald-600 text-sm mt-3">Strong loyalty</p>
          </div>
        </div>
      </div>

      {/* SUPPLY CHAIN OVERVIEW */}
      <div className="mb-12">
        <h2 className="font-semibold text-xl tracking-tight mb-6">Supply Chain Overview</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* OTIF Performance */}
          <div className="bg-white rounded-3xl p-7 md:p-8 border border-neutral-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="font-medium">On-Time In-Full Delivery</p>
                <p className="font-black text-4xl md:text-5xl tracking-[-1.5px] mt-3">98.4%</p>
              </div>
              <ShieldCheck className="w-8 h-8 text-emerald-600" />
            </div>
            
            <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
              <div className="h-3 bg-[#00b4d8] rounded-full transition-all" style={{ width: '98.4%' }} />
            </div>
            <p className="text-xs text-neutral-500 mt-3">Target: 95% • Currently exceeding target</p>
          </div>

          {/* Live Shipments */}
          <div className="bg-white rounded-3xl p-7 md:p-8 border border-neutral-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="font-medium">Live Shipments</p>
                <p className="font-black text-4xl md:text-5xl tracking-[-1.5px] mt-3">42</p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-semibold text-emerald-700">12</div>
                <div className="text-xs text-emerald-600 mt-1">By Sea</div>
              </div>
              <div className="bg-amber-50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-semibold text-amber-700">18</div>
                <div className="text-xs text-amber-600 mt-1">By Road</div>
              </div>
              <div className="bg-blue-50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-semibold text-blue-700">12</div>
                <div className="text-xs text-blue-600 mt-1">By Air</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <h2 className="font-semibold text-xl tracking-tight mb-6">Quick Actions</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Create Purchase Order */}
          <Link 
            href="/dashboard/purchase-orders/new" 
            className="group bg-white border border-neutral-200 hover:border-[#00b4d8] rounded-3xl p-6 flex flex-col justify-between transition-all hover:shadow-md active:scale-[0.985]"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 bg-[#00b4d8]/10 rounded-2xl group-hover:bg-[#00b4d8]/20 transition-colors">
                <Plus className="w-6 h-6 text-[#00b4d8]" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-neutral-400 group-hover:text-[#00b4d8] transition-colors" />
            </div>
            <div className="mt-8">
              <p className="font-semibold text-lg">Create Purchase Order</p>
              <p className="text-sm text-neutral-500 mt-1">Raise a new PO with a supplier</p>
            </div>
          </Link>

          {/* Invite Supplier */}
          <Link 
            href="/dashboard/suppliers/add" 
            className="group bg-white border border-neutral-200 hover:border-[#00b4d8] rounded-3xl p-6 flex flex-col justify-between transition-all hover:shadow-md active:scale-[0.985]"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 bg-amber-100 rounded-2xl group-hover:bg-amber-200 transition-colors">
                <UserPlus className="w-6 h-6 text-amber-600" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-neutral-400 group-hover:text-amber-600 transition-colors" />
            </div>
            <div className="mt-8">
              <p className="font-semibold text-lg">Invite Supplier</p>
              <p className="text-sm text-neutral-500 mt-1">Add a new supplier to the network</p>
            </div>
          </Link>

          {/* View Reports */}
          <Link 
            href="/dashboard/reports" 
            className="group bg-white border border-neutral-200 hover:border-[#00b4d8] rounded-3xl p-6 flex flex-col justify-between transition-all hover:shadow-md active:scale-[0.985]"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 bg-blue-100 rounded-2xl group-hover:bg-blue-200 transition-colors">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-neutral-400 group-hover:text-blue-600 transition-colors" />
            </div>
            <div className="mt-8">
              <p className="font-semibold text-lg">View Reports</p>
              <p className="text-sm text-neutral-500 mt-1">Analytics and performance insights</p>
            </div>
          </Link>

          {/* Manage Suppliers */}
          <Link 
            href="/dashboard/suppliers" 
            className="group bg-white border border-neutral-200 hover:border-[#00b4d8] rounded-3xl p-6 flex flex-col justify-between transition-all hover:shadow-md active:scale-[0.985]"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 bg-neutral-100 rounded-2xl group-hover:bg-neutral-200 transition-colors">
                <Users className="w-6 h-6 text-neutral-600" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
            </div>
            <div className="mt-8">
              <p className="font-semibold text-lg">Manage Suppliers</p>
              <p className="text-sm text-neutral-500 mt-1">View and manage your supplier network</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}