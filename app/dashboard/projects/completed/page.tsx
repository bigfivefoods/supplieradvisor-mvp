'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { CheckCircle } from 'lucide-react';

export default function CompletedProjectsPage() {
  return (
    <div className="pl-0 min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Completed Projects</h1>
        <div className="card p-12">
          <div className="flex items-center gap-4 mb-8">
            <CheckCircle size={48} className="text-emerald-500" />
            <h2 className="text-4xl font-bold">Completed Projects Archive</h2>
          </div>
          <p className="text-xl text-slate-600">All completed projects with on-chain milestone records, ratings, RIAD summary, and full audit trail.</p>
        </div>
      </div>
    </div>
  );
}
