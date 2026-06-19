'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';

export default function PredictiveForecasts() {
  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />
      <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-4">Predictive Forecasts</h1>
      <p className="text-xl text-neutral-600 mb-8">Demand forecasting, revenue projections, inventory planning, and scenario-based predictions powered by AI.</p>

      <div className="bg-white rounded-3xl p-12 border text-center">
        <p className="text-2xl font-semibold text-neutral-400">Coming Soon</p>
        <p className="text-neutral-500 mt-2">This module is under active development.</p>
      </div>
    </div>
  );
}