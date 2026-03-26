'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { Target, Calendar } from 'lucide-react';

export default function ActiveProjectsPage() {
  return (
    <div className="pl-[25px] min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Active Projects</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-8">
            <div className="flex items-center gap-4 mb-6">
              <Target size={32} className="text-[#00b4d8]" />
              <h3 className="text-3xl font-bold">Active Projects</h3>
            </div>
            <p className="text-xl text-slate-600">All live projects with on-chain milestones and real-time status</p>
          </div>
          
          <div className="card p-8">
            <div className="flex items-center gap-4 mb-6">
              <Calendar size={32} className="text-[#00b4d8]" />
              <h3 className="text-3xl font-bold">Milestones</h3>
            </div>
            <p className="text-xl text-slate-600">On-chain milestone tracking and approvals</p>
          </div>
          
          <div className="card p-8">
            <div className="flex items-center gap-4 mb-6">
              <Target size={32} className="text-emerald-500" />
              <h3 className="text-3xl font-bold">RIAD Summary</h3>
            </div>
            <p className="text-xl text-slate-600">Risks, Issues, Actions & Decisions for active projects</p>
          </div>
        </div>
      </div>
    </div>
  );
}
