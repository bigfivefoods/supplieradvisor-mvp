'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { Calendar } from 'lucide-react';

export default function GanttPage() {
  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Gantt Charts</h1>
        <div className="card p-12">
          <div className="flex items-center gap-4 mb-8">
            <Calendar size={48} className="text-[#00b4d8]" />
            <h2 className="text-4xl font-bold">Project Gantt Charts</h2>
          </div>
          <p className="text-xl text-slate-600">Interactive Gantt charts with on-chain milestones, real-time updates, ratings, RIAD, and full audit trail.</p>
        </div>
      </div>
    </div>
  );
}
