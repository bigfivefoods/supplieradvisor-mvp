'use client';
import Breadcrumb from '@/components/ui/Breadcrumb';
export default function SimulationLab() {
  return (
    <div className="pl-0 pr-12 py-12 bg-[#f8fafc]">
      <Breadcrumb items={[{label:'Home',href:'/dashboard'},{label:'AI Lab',href:'/dashboard/ai-lab'},{label:'Simulation Lab'}]} />
      <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8]">Simulation Lab</h1>
      <p className="text-xl text-slate-600 mt-4">Run supply-chain scenarios with AI.</p>
    </div>
  );
}
