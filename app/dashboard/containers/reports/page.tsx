'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Heart, ArrowRight, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';
import { getSelectedCompanyId } from '@/lib/containers/company';

type ReportCard = {
  title: string;
  desc: string;
  href?: string;
  /** CSV export type for /api/containers/reports/export */
  exportType?: 'inventory' | 'network' | 'contractors';
};

const REPORTS: ReportCard[] = [
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
  {
    title: 'Reseller customer feedback',
    desc: 'Product, price, brand & packaging stars plus free-text notes from the field.',
    href: '/dashboard/containers/resellers/feedback',
  },
  {
    title: 'Reseller RIAD log',
    desc: 'Risks, issues, actions and decisions logged by resellers in the field.',
    href: '/dashboard/containers/resellers/riad',
  },
  {
    title: 'Inventory & stock',
    desc: 'CSV of stock levels across all outlets — product, qty, reorder, cost.',
    exportType: 'inventory',
  },
  {
    title: 'Outlet network',
    desc: 'CSV of containers — name, code, GPS, city, contractor assignment.',
    exportType: 'network',
  },
  {
    title: 'Contractors',
    desc: 'CSV of operators — verification and training status for audits.',
    exportType: 'contractors',
  },
  {
    title: 'Monthly performance',
    desc: 'Revenue, margin, and sales by container — sales ledger integration next.',
  },
  {
    title: 'Contractor payouts',
    desc: 'Commission calculations and payment history — coming with payouts module.',
  },
  {
    title: 'Regional summary',
    desc: 'Performance breakdown by province/region — use network CSV + impact for now.',
  },
];

export default function ContainersReports() {
  return (
    <CompanyRequired>
      <ReportsInner />
    </CompanyRequired>
  );
}

function ReportsInner() {
  const companyId = getSelectedCompanyId()!;
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (exportType: string, title: string) => {
    setBusy(exportType);
    try {
      const res = await fetch(
        `/api/containers/reports/export?companyId=${companyId}&type=${exportType}`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || `Export failed (${res.status})`
        );
      }
      const blob = await res.blob();
      const dispo = res.headers.get('Content-Disposition') || '';
      const match = /filename="([^"]+)"/.exec(dispo);
      const filename = match?.[1] || `${exportType}-${Date.now()}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${title} downloaded`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ContainersPage>
      <ContainersHeader
        title="Container"
        titleAccent="reports"
        description="Live impact and feasibility links, plus CSV exports for inventory, network, and contractors."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {REPORTS.map((report) => {
          const isExport = Boolean(report.exportType);
          const isLive = Boolean(report.href);
          const body = (
            <>
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
                  {isLive ? (
                    <Heart className="w-5 h-5 text-emerald-600" />
                  ) : isExport ? (
                    <Download className="w-5 h-5 text-[#00b4d8]" />
                  ) : (
                    <FileText className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                {isLive ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    Open <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                ) : isExport ? (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-100 px-2 py-1 rounded-full">
                    CSV export
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-full">
                    Coming soon
                  </span>
                )}
              </div>
              <h3 className="font-bold text-slate-800 mb-1 group-hover:text-[#0077b6]">
                {report.title}
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                {report.desc}
              </p>
              {isExport && report.exportType && (
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#0077b6]">
                  {busy === report.exportType ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Download CSV
                </span>
              )}
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

          if (report.exportType) {
            return (
              <button
                key={report.title}
                type="button"
                disabled={busy === report.exportType}
                onClick={() => void download(report.exportType!, report.title)}
                className="bg-white rounded-3xl p-5 sm:p-6 border border-sky-100 hover:border-[#00b4d8] hover:shadow-md transition-all group text-left w-full disabled:opacity-60"
              >
                {body}
              </button>
            );
          }

          return (
            <div
              key={report.title}
              className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200 opacity-90"
            >
              {body}
            </div>
          );
        })}
      </div>
    </ContainersPage>
  );
}
