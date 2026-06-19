'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { TrendingUp, Users, MapPin, DollarSign } from 'lucide-react';

export default function ContainersMetrics() {
  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />
      
      <div className="mb-8">
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-2">Container Metrics</h1>
        <p className="text-xl text-neutral-600">Aggregate performance across all your retail outlets</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-3xl p-6 border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-sm text-neutral-500">Total Containers</div>
          </div>
          <div className="text-4xl font-bold">124</div>
          <div className="text-emerald-600 text-sm mt-1">+8 this month</div>
        </div>

        <div className="bg-white rounded-3xl p-6 border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-sm text-neutral-500">Active Contractors</div>
          </div>
          <div className="text-4xl font-bold">119</div>
          <div className="text-emerald-600 text-sm mt-1">96% active rate</div>
        </div>

        <div className="bg-white rounded-3xl p-6 border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-sm text-neutral-500">Total Monthly Revenue</div>
          </div>
          <div className="text-4xl font-bold">R 4.2M</div>
          <div className="text-emerald-600 text-sm mt-1">+18% vs last month</div>
        </div>

        <div className="bg-white rounded-3xl p-6 border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-sm text-neutral-500">Avg Gross Margin</div>
          </div>
          <div className="text-4xl font-bold">31.4%</div>
          <div className="text-emerald-600 text-sm mt-1">+2.1% improvement</div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-12 border text-center">
        <p className="text-2xl font-semibold text-neutral-400 mb-2">Advanced Metrics Dashboard Coming Soon</p>
        <p className="text-neutral-500 max-w-md mx-auto">
          Top performing containers, regional breakdowns, trend charts, contractor performance rankings, 
          and impact metrics (jobs created, households served) will be displayed here.
        </p>
      </div>
    </div>
  );
}