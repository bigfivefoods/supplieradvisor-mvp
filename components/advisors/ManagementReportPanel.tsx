'use client';

/**
 * Owner management report panel — Insights slice & dice + A4 landscape PDF.
 * Works for every Advisor via /api/advisors/management-report.
 * Light + dark: dark mode uses deep surfaces and bright accents (no white cards).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import {
  type AdvisorReportId,
  type ManagementReportDoc,
  managementReportApiUrl,
} from '@/lib/advisors/management-report';
import ManagementReportCharts from '@/components/advisors/ManagementReportCharts';

type DimOption = {
  key: string;
  label: string;
  options: Array<{ id: string; label: string }>;
};

type Props = {
  advisor: AdvisorReportId;
  /** Optional dimension filters (coach, quarry, crop…) */
  dimensions?: DimOption[];
  /** Compact embed on existing report pages */
  compact?: boolean;
  className?: string;
};

export default function ManagementReportPanel({
  advisor,
  dimensions = [],
  compact,
  className = '',
}: Props) {
  const companyId = getSelectedCompanyId();
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('this_month', 1)
  );
  const [slice, setSlice] = useState('overview');
  const [dims, setDims] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [report, setReport] = useState<ManagementReportDoc | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const url = managementReportApiUrl(advisor, companyId, {
        from: period.from,
        to: period.to,
        slice,
        dims,
        format: 'json',
      });
      const res = await fetch(url, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load report');
      setReport(data.report as ManagementReportDoc);
      if (data.report?.slice) setSlice(String(data.report.slice));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [advisor, companyId, period.from, period.to, slice, dims]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadPdf = async () => {
    if (!companyId) return;
    setPdfBusy(true);
    try {
      const url = managementReportApiUrl(advisor, companyId, {
        from: period.from,
        to: period.to,
        slice: 'overview',
        dims,
        format: 'pdf',
        orientation: 'landscape',
      });
      const res = await fetch(url, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'PDF failed');
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download =
        res.headers
          .get('Content-Disposition')
          ?.match(/filename="([^"]+)"/)?.[1] ||
        `${advisor}-Management-A4-Landscape.pdf`;
      a.click();
      URL.revokeObjectURL(objectUrl);
      toast.success('A4 landscape Insights PDF downloaded');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'PDF failed');
    } finally {
      setPdfBusy(false);
    }
  };

  if (!companyId) return null;

  // Dark KPI tile gradients — deep colour → brighter brand (no flat grey/white)
  const darkKpiGradients = [
    'dark:border-sky-400/25 dark:bg-gradient-to-br dark:from-[#0b1e33] dark:via-[#0c4a6e] dark:to-[#0891b2]',
    'dark:border-cyan-400/25 dark:bg-gradient-to-br dark:from-[#042f2e] dark:via-[#0e7490] dark:to-[#22d3ee]',
    'dark:border-emerald-400/25 dark:bg-gradient-to-br dark:from-[#052e16] dark:via-[#047857] dark:to-[#34d399]',
    'dark:border-amber-400/25 dark:bg-gradient-to-br dark:from-[#1c1003] dark:via-[#b45309] dark:to-[#fbbf24]',
    'dark:border-violet-400/25 dark:bg-gradient-to-br dark:from-[#1e1033] dark:via-[#6d28d9] dark:to-[#a78bfa]',
    'dark:border-rose-400/25 dark:bg-gradient-to-br dark:from-[#2a0a14] dark:via-[#be123c] dark:to-[#fb7185]',
    'dark:border-teal-400/25 dark:bg-gradient-to-br dark:from-[#042f2e] dark:via-[#0f766e] dark:to-[#2dd4bf]',
    'dark:border-indigo-400/25 dark:bg-gradient-to-br dark:from-[#0f172a] dark:via-[#4338ca] dark:to-[#818cf8]',
  ];

  return (
    <section
      id="management-report"
      className={`overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/5 scroll-mt-24 dark:border-cyan-500/20 dark:bg-gradient-to-b dark:from-[#061018] dark:via-[#0a1628] dark:to-[#04101a] dark:ring-cyan-400/15 dark:shadow-[0_0_40px_-12px_rgba(34,211,238,0.25)] ${className}`}
      aria-label="Reports"
    >
      {/* Hero — brand band */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#005f8a] via-[#0077b6] to-[#00b4d8] px-4 py-4 text-white sm:px-5 dark:from-[#022c4a] dark:via-[#0369a1] dark:to-[#0d9488]">
        <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl dark:bg-cyan-300/20" />
        <div className="pointer-events-none absolute bottom-0 right-16 h-20 w-20 rounded-full bg-emerald-400/20 blur-xl dark:bg-teal-300/30" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/85 dark:text-cyan-100">
              <Sparkles className="h-3 w-3" />
              Insights · slice & dice · full pack
            </p>
            <h2 className="mt-0.5 text-lg font-black leading-tight sm:text-xl">
              Reports
              {report?.brand ? (
                <span className="font-semibold text-white/90 dark:text-cyan-50">
                  {' '}
                  · {report.brand}
                </span>
              ) : null}
            </h2>
            <p className="mt-1 max-w-xl text-xs text-white/90 sm:text-sm dark:text-sky-100/95">
              One slicer at the top, then the full pack: people, floor, diary,
              trends and graphs. Download the same metrics as an A4 PDF.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-bold backdrop-blur hover:bg-white/20 dark:border-cyan-300/40 dark:bg-gradient-to-r dark:from-cyan-950/40 dark:to-teal-900/30 dark:hover:from-cyan-900/50 dark:hover:to-teal-800/40"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <button
              type="button"
              disabled={pdfBusy || loading}
              onClick={() => void downloadPdf()}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-black text-[#0077b6] shadow-sm hover:bg-sky-50 disabled:opacity-50 dark:border dark:border-cyan-300/50 dark:bg-gradient-to-r dark:from-cyan-400 dark:to-teal-300 dark:text-[#042f2e] dark:hover:from-cyan-300 dark:hover:to-teal-200 dark:shadow-cyan-400/30"
            >
              {pdfBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download A4 PDF
            </button>
          </div>
        </div>
      </div>

      <div className={`space-y-5 ${compact ? 'p-3' : 'p-4 sm:p-6'}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <PeriodSlicer value={period} onChange={setPeriod} />
          </div>
          {dimensions.length ? (
            <div className="flex flex-wrap items-end gap-2">
              <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-cyan-300">
                <SlidersHorizontal className="h-3 w-3" /> Slice filters
              </span>
              {dimensions.map((d) => (
                <label
                  key={d.key}
                  className="block text-[10px] font-bold text-slate-500 dark:text-cyan-100/80"
                >
                  {d.label}
                  <select
                    className="mt-0.5 block min-w-[8rem] rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 shadow-sm dark:border-cyan-500/30 dark:bg-gradient-to-br dark:from-[#0b1e33] dark:to-[#083344] dark:text-cyan-50 dark:shadow-none"
                    value={dims[d.key] || ''}
                    onChange={(e) =>
                      setDims((prev) => ({
                        ...prev,
                        [d.key]: e.target.value,
                      }))
                    }
                  >
                    <option value="">All</option>
                    {d.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-cyan-300">
          Slice & dice
        </p>

        {loading || !report ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14">
            <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8] dark:text-cyan-300" />
            <p className="text-xs font-semibold text-slate-400 dark:text-cyan-200/70">
              Building Insights pack…
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white px-4 py-3 dark:border-cyan-400/25 dark:bg-gradient-to-br dark:from-[#0b1e33] dark:via-[#0c4a6e]/80 dark:to-[#134e4a]/70">
              <p className="text-sm font-black text-slate-900 sm:text-base dark:text-white">
                {report.headline}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-cyan-100/80">
                {report.product}
                {report.filterSummary ? ` · ${report.filterSummary}` : ''} ·{' '}
                {report.period.from} → {report.period.to}
              </p>
            </div>

            {/* KPI grid */}
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-cyan-300">
                Report pack · key metrics
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {report.kpis.map((k, i) => {
                  const accents = [
                    'from-sky-500 to-cyan-400',
                    'from-cyan-500 to-teal-400',
                    'from-emerald-500 to-green-400',
                    'from-amber-500 to-orange-400',
                    'from-violet-500 to-purple-400',
                    'from-rose-500 to-pink-400',
                    'from-teal-500 to-cyan-400',
                    'from-indigo-500 to-blue-400',
                  ];
                  return (
                    <div
                      key={k.label}
                      className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm ring-1 ring-slate-900/5 dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] dark:ring-0 ${darkKpiGradients[i % darkKpiGradients.length]}`}
                    >
                      <div
                        className={`absolute left-0 top-0 h-full w-1 bg-gradient-to-b ${accents[i % accents.length]} dark:w-1.5 dark:opacity-90`}
                      />
                      <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10 blur-xl dark:bg-white/15" />
                      <p className="relative pl-2 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-white/75">
                        {k.label}
                      </p>
                      <p className="relative mt-1 pl-2 text-xl font-black tabular-nums tracking-tight text-slate-900 sm:text-2xl dark:text-white dark:drop-shadow-sm">
                        {k.value}
                      </p>
                      {k.hint ? (
                        <p className="relative mt-0.5 pl-2 text-[10px] font-medium text-slate-400 dark:text-white/65">
                          {k.hint}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Charts — always prominent */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3 sm:p-4 dark:border-cyan-400/25 dark:bg-gradient-to-br dark:from-[#061825] dark:via-[#0b2f44] dark:to-[#0a3d3a]/90">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-[#0077b6] to-[#00b4d8] text-white shadow-sm dark:from-cyan-400 dark:to-teal-300 dark:text-[#042f2e] dark:shadow-cyan-400/30">
                  <BarChart3 className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 dark:text-white">
                    Visual Insights
                  </p>
                  <p className="text-[10px] font-medium text-slate-400 dark:text-cyan-100/70">
                    Live charts from this period — included on the PDF
                  </p>
                </div>
              </div>
              <ManagementReportCharts report={report} />
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              {[
                {
                  title: 'Highlights',
                  items: report.highlights,
                  tone:
                    'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-400/30 dark:from-[#052e16] dark:via-[#065f46] dark:to-[#10b981]/70',
                  chip:
                    'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/25 dark:text-emerald-100 dark:border dark:border-emerald-300/30',
                  dot: 'bg-slate-400 dark:bg-emerald-300',
                },
                {
                  title: 'Risks / watch',
                  items: report.risks,
                  tone:
                    'border-rose-200/80 bg-gradient-to-br from-rose-50 to-white dark:border-rose-400/30 dark:from-[#2a0a14] dark:via-[#9f1239] dark:to-[#fb7185]/65',
                  chip:
                    'bg-rose-100 text-rose-800 dark:bg-rose-400/25 dark:text-rose-100 dark:border dark:border-rose-300/30',
                  dot: 'bg-slate-400 dark:bg-rose-300',
                },
                {
                  title: 'Owner actions',
                  items: report.actions,
                  tone:
                    'border-sky-200/80 bg-gradient-to-br from-sky-50 to-white dark:border-cyan-400/30 dark:from-[#0b1e33] dark:via-[#0369a1] dark:to-[#22d3ee]/60',
                  chip:
                    'bg-sky-100 text-sky-800 dark:bg-cyan-400/25 dark:text-cyan-50 dark:border dark:border-cyan-300/30',
                  dot: 'bg-slate-400 dark:bg-cyan-300',
                },
              ].map((sec) => (
                <div
                  key={sec.title}
                  className={`rounded-2xl border px-3.5 py-3 shadow-sm dark:shadow-[0_8px_24px_-10px_rgba(0,0,0,0.5)] ${sec.tone}`}
                >
                  <p
                    className={`mb-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${sec.chip}`}
                  >
                    {sec.title}
                  </p>
                  <ul className="space-y-1.5 text-xs font-medium text-slate-700 dark:text-white/90">
                    {(sec.items || []).slice(0, 5).map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${sec.dot}`}
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {report.tables.map((tbl) => (
              <div
                key={tbl.title}
                className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/5 dark:border-cyan-400/25 dark:bg-gradient-to-br dark:from-[#061825] dark:via-[#0b2f44] dark:to-[#0c3d4a] dark:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.55)] dark:ring-0"
              >
                <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-3.5 py-2.5 dark:border-cyan-400/20 dark:bg-gradient-to-r dark:from-[#0c4a6e]/80 dark:via-[#0e7490]/50 dark:to-[#134e4a]/60">
                  <FileText className="h-3.5 w-3.5 text-[#00b4d8] dark:text-cyan-300" />
                  <p className="text-xs font-black text-slate-800 dark:text-white">
                    {tbl.title}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-xs">
                    <thead className="bg-slate-50/80 text-[10px] font-black uppercase tracking-wide text-slate-400 dark:bg-gradient-to-r dark:from-[#083344]/90 dark:to-[#0b3a4a]/70 dark:text-cyan-200/80">
                      <tr>
                        {tbl.headers.map((h) => (
                          <th key={h} className="px-3.5 py-2.5">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tbl.rows.map((row, i) => (
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
