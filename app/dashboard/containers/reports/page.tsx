'use client';

import { FileText, Download } from 'lucide-react';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';

const REPORTS = [
  { title: 'Monthly performance', desc: 'Revenue, margin, and sales by container' },
  { title: 'Contractor payouts', desc: 'Commission calculations and payment history' },
  { title: 'Inventory & stock', desc: 'Stock levels and replenishment summary' },
  { title: 'Compliance & audit', desc: 'Visit logs and compliance status' },
  { title: 'Top performers', desc: 'Best performing containers and contractors' },
  { title: 'Regional summary', desc: 'Performance breakdown by province/region' },
];

export default function ContainersReports() {
  return (
    <CompanyRequired>
      <ContainersPage>
        <ContainersHeader
          title="Container"
          titleAccent="reports"
          description="Generate and export performance, payout, and compliance reports for the outlet network."
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {REPORTS.map((report) => (
            <div
              key={report.title}
              className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200 hover:border-[#00b4d8] hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#00b4d8]" />
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-[#0077b6] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
              </div>
              <h3 className="font-bold text-slate-800 mb-1 group-hover:text-[#0077b6]">
                {report.title}
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">{report.desc}</p>
            </div>
          ))}
        </div>
      </ContainersPage>
    </CompanyRequired>
  );
}