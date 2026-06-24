'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { 
  TrendingUp, Users, Truck, Package, AlertTriangle, 
  ArrowRight, Plus, Target 
} from 'lucide-react';

interface CompanyData {
  id: number;
  trading_name: string;
  legal_name: string | null;
  industry: string | null;
}

export default function DashboardHome() {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);

  // Create Supabase client (modern pattern)
  const supabase = createClient();

  useEffect(() => {
    const loadCompanyData = async () => {
      const companyId = localStorage.getItem('selectedCompanyId');
      
      if (!companyId) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, trading_name, legal_name, industry')
        .eq('id', Number(companyId))
        .single();

      if (data) {
        setCompany(data);
      }
      setLoading(false);
    };

    loadCompanyData();
  }, [supabase]);

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#00b4d8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-500">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-12 max-w-md mx-auto text-center">
        <h2 className="text-2xl font-bold mb-4">No Company Selected</h2>
        <p className="text-neutral-600 mb-6">Please select a company to view your dashboard.</p>
        <Link href="/dashboard/select-company" className="btn-primary px-8 py-3 inline-block">
          Select Company
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 lg:pr-12 py-8 lg:py-12 max-w-screen-2xl mx-auto">
      
      {/* Header */}
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-sm text-neutral-500 mb-1">Good evening</p>
            <h1 className="font-black text-5xl md:text-6xl tracking-[-2.5px]">
              {company.trading_name}
            </h1>
            <p className="text-xl text-neutral-600 mt-2">
              {company.industry || 'Your business command center'}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/my-business" 
              className="btn-secondary px-6 py-3 flex items-center gap-2"
            >
              Manage Business <ArrowRight className="w-4 h-4" />
            </Link>
            <Link 
              href="/dashboard/suppliers/add" 
              className="btn-primary px-6 py-3 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Supplier
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards - Premium Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-white rounded-3xl border border-neutral-200 p-6 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-100 rounded-2xl">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-xs font-medium px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full">+12%</span>
          </div>
          <div className="text-4xl font-black tracking-tighter mb-1">R 4.2M</div>
          <div className="text-sm text-neutral-600">Monthly Revenue</div>
          <div className="text-xs text-neutral-400 mt-4">vs last month</div>
        </div>

        <div className="bg-white rounded-3xl border border-neutral-200 p-6 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-2xl">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium px-3 py-1 bg-blue-100 text-blue-700 rounded-full">+8</span>
          </div>
          <div className="text-4xl font-black tracking-tighter mb-1">147</div>
          <div className="text-sm text-neutral-600">Active Suppliers</div>
          <div className="text-xs text-neutral-400 mt-4">12 new this month</div>
        </div>

        <div className="bg-white rounded-3xl border border-neutral-200 p-6 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-100 rounded-2xl">
              <Package className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-xs font-medium px-3 py-1 bg-amber-100 text-amber-700 rounded-full">94</span>
          </div>
          <div className="text-4xl font-black tracking-tighter mb-1">312</div>
          <div className="text-sm text-neutral-600">Open Orders</div>
          <div className="text-xs text-neutral-400 mt-4">23 due this week</div>
        </div>

        <div className="bg-white rounded-3xl border border-neutral-200 p-6 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-2xl">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-xs font-medium px-3 py-1 bg-purple-100 text-purple-700 rounded-full">On Track</span>
          </div>
          <div className="text-4xl font-black tracking-tighter mb-1">87%</div>
          <div className="text-sm text-neutral-600">Target Achievement</div>
          <div className="text-xs text-neutral-400 mt-4">Q2 2026</div>
        </div>
      </div>

      {/* Quick Actions + Business Health */}
      <div className="grid lg:grid-cols-3 gap-6 mb-10">
        
        {/* Quick Actions */}
        <div className="lg:col-span-1 bg-white rounded-3xl border border-neutral-200 p-8">
          <h3 className="font-bold text-xl mb-6 tracking-tight">Quick Actions</h3>
          <div className="space-y-3">
            {[
              { label: 'Add New Supplier', href: '/dashboard/suppliers/add', icon: Truck },
              { label: 'Create Purchase Order', href: '/dashboard/suppliers/po', icon: Package },
              { label: 'View Team', href: '/dashboard/my-business/team', icon: Users },
              { label: 'Upload Document', href: '/dashboard/my-business/documents', icon: Package },
            ].map((action, index) => {
              const Icon = action.icon;
              return (
                <Link 
                  key={index}
                  href={action.href}
                  className="flex items-center justify-between px-5 py-4 rounded-2xl hover:bg-neutral-50 border border-transparent hover:border-neutral-200 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-neutral-100 rounded-2xl group-hover:bg-white transition-colors">
                      <Icon className="w-5 h-5 text-neutral-700" />
                    </div>
                    <span className="font-medium">{action.label}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Business Pulse / Health */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-neutral-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-xl tracking-tight">Business Pulse</h3>
            <Link href="/dashboard/intelligence" className="text-sm text-[#00b4d8] hover:underline flex items-center gap-1">
              View full intelligence <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-neutral-500 mb-2">Supplier Health</div>
              <div className="text-3xl font-black tracking-tighter mb-1">92</div>
              <div className="text-emerald-600 text-sm font-medium">Excellent</div>
              <div className="h-2 bg-emerald-100 rounded-full mt-3">
                <div className="h-2 w-[92%] bg-emerald-500 rounded-full" />
              </div>
            </div>
            <div>
              <div className="text-sm text-neutral-500 mb-2">Order Fulfillment</div>
              <div className="text-3xl font-black tracking-tighter mb-1">78</div>
              <div className="text-amber-600 text-sm font-medium">Good</div>
              <div className="h-2 bg-amber-100 rounded-full mt-3">
                <div className="h-2 w-[78%] bg-amber-500 rounded-full" />
              </div>
            </div>
            <div>
              <div className="text-sm text-neutral-500 mb-2">Risk Score</div>
              <div className="text-3xl font-black tracking-tighter mb-1">Low</div>
              <div className="text-emerald-600 text-sm font-medium">Stable</div>
              <div className="h-2 bg-emerald-100 rounded-full mt-3">
                <div className="h-2 w-[25%] bg-emerald-500 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity + Alerts */}
      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* Recent Activity */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-xl tracking-tight">Recent Activity</h3>
            <Link href="/dashboard/intelligence/pulse-dashboard" className="text-sm text-[#00b4d8]">View all</Link>
          </div>

          <div className="space-y-5 text-sm">
            {[1,2,3,4].map((i) => (
              <div key={i} className="flex gap-4 pb-5 border-b last:border-none last:pb-0">
                <div className="w-9 h-9 rounded-2xl bg-neutral-100 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">New supplier onboarded</div>
                  <div className="text-neutral-500 text-xs mt-0.5">Fresh Produce SA • 2 hours ago</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts & Notifications */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-xl tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Alerts &amp; Attention
            </h3>
            <Link href="/dashboard/suppliers/risk-alerts" className="text-sm text-[#00b4d8]">Manage</Link>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-sm">3 suppliers have pending compliance documents</div>
                <div className="text-xs text-amber-700 mt-1">Action required within 5 days</div>
              </div>
            </div>

            <div className="flex gap-4 p-4 bg-red-50 rounded-2xl border border-red-100">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-sm">2 purchase orders are overdue</div>
                <div className="text-xs text-red-700 mt-1">Review and follow up</div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}