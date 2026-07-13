'use client';

import Link from 'next/link';
import { FileText, Download, Heart, ArrowRight } from 'lucide-react';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';

const REPORTS = [
  {
    title: 'Food security & jobs',
    desc: 'Jobs created per container and people fed from food sales — live report with map.',
    href: '/dashboard/containers/impact',
  },
  {
    title: 'Deploy feasibility',
    desc: 'Region deployment model — cost, uptake, people served, margin per meal, POS & marketing income.',
    href: '/dashboard/containers/feasibility',
  },
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
          description="Generate and export performance, payout, impact, and compliance reports for the outlet network."
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {REPORTS.map((report) => {
            const body = (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
                    {report.href ? (
                      <Heart className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <FileText className="w-5 h-5 text-[#00b4d8]" />
                    )}
                  </div>
                  {report.href ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      Open <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-[#0077b6] cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Export
                    </button>
                  )}
                </div>
                <h3 className="font-bold text-slate-800 mb-1 group-hover:text-[#0077b6]">
                  {report.title}
                </h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  {report.desc}
                </p>
              </>
            );

            if (report.href) {
              return (
                <Link
                  key={report.title}
                  href={report.href}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-emerald-100 hover:border-emerald-400 hover:shadow-md transition-all group block bg-gradient-to-br from-emerald-50/40 to-white"
                >
                  {body}
                </Link>
              );
            }

            return (
              <div
                key={report.title}
                className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200 hover:border-[#00b4d8] hover:shadow-md transition-all group"
              >
                {body}
              </div>
            );
          })}
        </div>
      </ContainersPage>
    </CompanyRequired>
  );
}