'use client';
import Breadcrumb from '@/components/ui/Breadcrumb';
export default function PredictiveForecasts() {
  return (
    <div className="pl-0 pr-12 py-12 bg-[#f8fafc]">
      <Breadcrumb items={[{label:'Home',href:'/dashboard'},{label:'AI Lab',href:'/dashboard/ai-lab'},{label:'Predictive Forecasts'}]} />
      <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8]">Predictive Forecasts</h1>
      <p className="text-xl text-slate-600 mt-4">AI-powered demand and risk predictions.</p>
    </div>
  );
}
