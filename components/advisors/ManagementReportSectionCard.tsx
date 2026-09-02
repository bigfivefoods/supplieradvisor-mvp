'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, FileText, Search } from 'lucide-react';
import type { ManagementReportSection } from '@/lib/advisors/management-report';
import { ManagementChartCard } from '@/components/advisors/ManagementReportCharts';

export default function ManagementReportSectionCard({
  section,
}: {
  section: ManagementReportSection;
}) {
  const [open, setOpen] = useState(section.defaultOpen !== false);
  const [q, setQ] = useState('');
  const charts = [
    section.chart,
    ...(section.extraCharts || []),
  ].filter(Boolean) as NonNullable<ManagementReportSection['chart']>[];
  const rows = section.table?.rows || [];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      row.some((cell) => String(cell).toLowerCase().includes(needle))
    );
  }, [rows, q]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/5 dark:border-cyan-400/25 dark:bg-gradient-to-br dark:from-[#061825] dark:via-[#0b2f44] dark:to-[#0c3d4a] dark:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.55)] dark:ring-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-3.5 py-2.5 text-left dark:border-cyan-400/20 dark:bg-gradient-to-r dark:from-[#0c4a6e]/80 dark:via-[#0e7490]/50 dark:to-[#134e4a]/60"
        aria-expanded={open}
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#00b4d8] transition-transform dark:text-cyan-300 ${
            open ? '' : '-rotate-90'
          }`}
        />
        <FileText className="h-3.5 w-3.5 text-[#00b4d8] dark:text-cyan-300" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-black text-slate-800 dark:text-white">
            {section.title}
          </span>
          {section.hint ? (
            <span className="block text-[10px] font-medium text-slate-400 dark:text-cyan-100/70">
              {section.hint}
            </span>
          ) : null}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:border dark:border-cyan-300/30 dark:bg-cyan-500/20 dark:text-cyan-100">
          {rows.length} row{rows.length === 1 ? '' : 's'}
        </span>
      </button>
      {open ? (
        <div className="space-y-3 p-3 sm:p-4">
          {charts.length ? (
            <div
              className={`grid gap-3 ${
                charts.length === 1 ? 'grid-cols-1' : 'md:grid-cols-2'
              }`}
            >
              {charts.map((c) => (
                <ManagementChartCard key={c.id} chart={c} />
              ))}
            </div>
          ) : null}

          {section.kpis?.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {section.kpis.map((k) => (
                <div
                  key={k.label}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-cyan-500/20 dark:bg-cyan-950/30"
                >
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-cyan-200/80">
                    {k.label}
                  </p>
                  <p className="text-sm font-black tabular-nums text-slate-900 dark:text-white">
                    {k.value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {section.table ? (
            <>
              {rows.length > 8 ? (
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs font-semibold text-slate-800 shadow-sm dark:border-cyan-500/30 dark:bg-[#0b1e33] dark:text-cyan-50"
                    placeholder="Search this list"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </label>
              ) : null}
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-cyan-500/15">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead className="bg-slate-50/80 text-[10px] font-black uppercase tracking-wide text-slate-400 dark:bg-gradient-to-r dark:from-[#083344]/90 dark:to-[#0b3a4a]/70 dark:text-cyan-200/80">
                    <tr>
                      {section.table.headers.map((h) => (
                        <th key={h} className="px-3.5 py-2.5">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length ? (
                      filtered.map((row, i) => (
                        <tr
                          key={i}
                          className={`border-t border-slate-100 dark:border-cyan-500/10 ${
                            i % 2 === 1
                              ? 'bg-slate-50/40 dark:bg-cyan-950/25'
                              : 'bg-white dark:bg-transparent'
                          }`}
                        >
                          {row.map((cell, j) => (
                            <td
                              key={j}
                              className="px-3.5 py-2 font-semibold text-slate-800 dark:text-cyan-50"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={section.table.headers.length}
                          className="px-3.5 py-6 text-center text-slate-400 dark:text-cyan-200/60"
                        >
                          No rows in this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
