'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { List } from 'lucide-react';

export default function BillsOfMaterialsPage() {
  return (
    <div className="pl-[25px] min-h-screen bg-[#f8fafc]">
      <div className="py-12">
        <Breadcrumb />
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-12">Master Production Schedules</h1>
        <div className="card p-12">
          <h2 className="text-4xl font-bold mb-8">BOM Management & Version Control</h2>
          <p className="text-xl text-slate-600">Full BOM editor, versioning, and cost roll-up module (ready for expansion).</p>
        </div>
      </div>
    </div>
  );
}