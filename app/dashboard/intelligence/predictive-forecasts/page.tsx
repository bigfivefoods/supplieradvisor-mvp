'use client';

import { ChevronDown } from 'lucide-react';

export default function PredictiveForecasts() {
  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      {/* CLEAN MANUAL BREADCRUMB - NO TS ERROR, NO DUPLICATE DASHBOARD */}
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-8">
        <span className="font-medium text-neutral-400">Dashboard</span>
        <span className="text-neutral-300">›</span>
        <a href="/dashboard/ai-lab" className="hover:text-neutral-700">AI Lab</a>
        <span className="text-neutral-300">›</span>
        <span className="font-medium text-neutral-950">Predictive Forecasts</span>
      </div>

      <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8]">Predictive Forecasts</h1>
      <p className="text-xl text-slate-600 mt-4">AI-powered demand and risk predictions</p>

      {/* Your real AI content goes here — placeholder for now */}
      <div className="mt-12 bg-white rounded-3xl p-12 shadow-sm border border-neutral-100">
        <div className="text-center py-20 text-neutral-400">
          <div className="text-6xl mb-6">📈</div>
          <h3 className="text-2xl font-semibold mb-3">Demand Forecasting Engine</h3>
          <p className="max-w-md mx-auto">Real-time AI predictions, risk alerts, and scenario modelling coming soon...</p>
        </div>
      </div>
    </div>
  );
}