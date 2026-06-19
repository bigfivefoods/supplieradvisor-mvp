'use client';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { FileText, Download } from 'lucide-react';

export default function ContainersReports() {
  return (
    <div className="pl-0 pr-12 py-12 max-w-screen-2xl mx-auto">
      <Breadcrumb />
      
      <div className="mb-8">
        <h1 className="text-6xl font-black tracking-[-3px] text-[#00b4d8] mb-2">Reports</h1>
        <p className="text-xl text-neutral-600">Generate and export container performance, payout, and compliance reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {[
          { title: "Monthly Performance Report", desc: "Revenue, margin, and sales by container" },
          { title: "Contractor Payout Report", desc: "Commission calculations and payment history" },
          { title: "Inventory & Stock Report", desc: "Stock levels and replenishment summary" },
          { title: "Compliance & Audit Report", desc: "Visit logs and compliance status" },
          { title: "Top Performers Report", desc: "Best performing containers and contractors" },
          { title: "Regional Summary", desc: "Performance breakdown by province/region" },
        ].map((report, index) => (
          <div key={index} className="bg-white rounded-3xl p-8 border hover:border-[#00b4d8] transition-colors group">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center group-hover:bg-[#00b4d8]/10 transition-colors">
                <FileText className="w-6 h-6 text-neutral-600 group-hover:text-[#00b4d8]" />
              </div>
              <button className="flex items-center gap-2 text-sm text-neutral-600 hover:text-[#00b4d8]">
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
            <h3 className="font-bold text-xl mb-2">{report.title}</h3>
            <p className="text-neutral-600 text-sm">{report.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}