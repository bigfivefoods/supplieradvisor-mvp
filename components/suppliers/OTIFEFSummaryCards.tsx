'use client';

import { TrendingUp, Clock, Package, ShieldCheck } from 'lucide-react';

interface OTIFEFData {
  overall: number;
  onTime: number;
  inFull: number;
  errorFree: number;
  totalPOs: number;
  supplierCount: number;
}

export default function OTIFEFSummaryCards({ data }: { data: OTIFEFData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Overall OTIFEF */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium text-neutral-500">OVERALL OTIFEF</div>
          <TrendingUp className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="font-black text-6xl tracking-tighter mb-2">
          {data.overall.toFixed(1)}<span className="text-4xl">%</span>
        </div>
        <div className="text-sm text-emerald-600 font-medium">Based on selected period</div>
      </div>

      {/* On Time */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium text-neutral-500">ON TIME</div>
          <Clock className="w-5 h-5 text-blue-600" />
        </div>
        <div className="font-black text-6xl tracking-tighter mb-2">
          {data.onTime.toFixed(1)}<span className="text-4xl">%</span>
        </div>
        <div className="text-sm text-neutral-600">Average across suppliers</div>
      </div>

      {/* In Full */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium text-neutral-500">IN FULL</div>
          <Package className="w-5 h-5 text-purple-600" />
        </div>
        <div className="font-black text-6xl tracking-tighter mb-2">
          {data.inFull.toFixed(1)}<span className="text-4xl">%</span>
        </div>
        <div className="text-sm text-neutral-600">Quantity accuracy</div>
      </div>

      {/* Error Free */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium text-neutral-500">ERROR FREE</div>
          <ShieldCheck className="w-5 h-5 text-orange-600" />
        </div>
        <div className="font-black text-6xl tracking-tighter mb-2">
          {data.errorFree.toFixed(1)}<span className="text-4xl">%</span>
        </div>
        <div className="text-sm text-neutral-600">Damage-free rate</div>
      </div>
    </div>
  );
}