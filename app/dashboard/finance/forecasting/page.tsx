'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { PieChart } from 'lucide-react';

export default function ForecastingPage() {
  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Forecasting & Planning</h1>
        <div className="card p-12">
          <h2 className="text-4xl font-bold mb-8">Revenue & Expense Forecasting</h2>
          <p className="text-xl text-slate-600">AI-powered forecasts and scenario planning module.</p>
        </div>
      </div>
    </div>
  );
}