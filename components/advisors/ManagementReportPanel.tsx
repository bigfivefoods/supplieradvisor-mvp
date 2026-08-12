'use client';

/**
 * Owner management report panel — slice & dice + one-page A4 landscape PDF.
 * Works for every Advisor via /api/advisors/management-report.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Download,
  FileText,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
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

type DimOption = { key: string; label: string; options: Array<{ id: string; label: string }> };

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
      const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
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
        // PDF always packs full overview key metrics
        slice: 'overview',
        dims,
        format: 'pdf',
        orientation: 'landscape',
      });
      const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
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
      toast.success('A4 landscape management report downloaded');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'PDF failed');
    } finally {
      setPdfBusy(false);
    }
  };

  if (!companyId) return null;

  return (
    <section
      id="management-report"
      className={`rounded-3xl border border-slate-200 bg-white overflow-hidden scroll-mt-24 ${className}`}
      aria-label="Owner management report"
    >
      <div className="bg-gradient-to-r from-[#0077b6] via-[#00b4d8] to-emerald-600 px-4 py-3 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/80">
            Owner pack · one-page A4 landscape
          </p>
          <h2 className="text-base sm:text-lg font-black leading-tight">
            Management report
            {report?.brand ? ` · ${report.brand}` : ''}
          </h2>
          <p className="text-xs text-white/90 mt-0.5">
            Slice & dice on screen, then download a one-page A4 landscape PDF
            with all key metrics for the period.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            type="button"
            disabled={pdfBusy || loading}
            onClick={() => void downloadPdf()}
            className="inline-flex items-center gap-1.5 rounded-full bg-white text-[#0077b6] px-3 py-2 text-xs font-black hover:bg-sky-50 disabled:opacity-50"
          >
            {pdfBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download A4 landscape PDF
          </button>
        </div>
      </div>

      <div className={`space-y-4 ${compact ? 'p-3' : 'p-4 sm:p-5'}`}>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <div className="flex-1 min-w-0">
            <PeriodSlicer value={period} onChange={setPeriod} />
          </div>
          {dimensions.length ? (
            <div className="flex flex-wrap gap-2 items-end">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                <SlidersHorizontal className="h-3 w-3" /> Slice filters
              </span>
              {dimensions.map((d) => (
                <label key={d.key} className="block text-[10px] font-bold text-slate-500">
                  {d.label}
                  <select
                    className="mt-0.5 block min-w-[8rem] rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800"
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

        {/* Slice tabs */}
        <div className="flex flex-wrap gap-1.5">
          {(report?.availableSlices || [{ id: 'overview', label: 'Overview' }]).map(
            (s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSlice(s.id)}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
                  slice === s.id
                    ? 'border-[#0077b6] bg-[#0077b6] text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300'
                }`}
              >
                {s.label}
              </button>
            )
          )}
        </div>

        {loading || !report ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-7 w-7 animate-spin text-[#00b4d8]" />
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm font-black text-slate-900">{report.headline}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {report.filterSummary} · {report.period.from} → {report.period.to}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {report.kpis.map((k) => (
                <div
                  key={k.label}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                >
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    {k.label}
                  </p>
                  <p className="text-lg font-black tabular-nums text-slate-900 mt-0.5">
                    {k.value}
                  </p>
                </div>
              ))}
            </div>

            <ManagementReportCharts report={report} />

            <div className="grid sm:grid-cols-3 gap-2">
              {[
                {
                  title: 'Highlights',
                  items: report.highlights,
                  tone: 'border-emerald-200 bg-emerald-50/60',
                },
                {
                  title: 'Risks / watch',
                  items: report.risks,
                  tone: 'border-rose-200 bg-rose-50/60',
                },
                {
                  title: 'Owner actions',
                  items: report.actions,
                  tone: 'border-sky-200 bg-sky-50/60',
                },
              ].map((sec) => (
                <div
                  key={sec.title}
                  className={`rounded-2xl border px-3 py-2.5 ${sec.tone}`}
                >
                  <p className="text-[10px] font-black uppercase tracking-wider mb-1">
                    {sec.title}
                  </p>
                  <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                    {(sec.items || []).slice(0, 5).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {report.tables.map((t) => (
              <div
                key={t.title}
                className="overflow-x-auto rounded-2xl border border-slate-200"
              >
                <div className="px-3 py-2 border-b bg-slate-50 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <p className="text-xs font-black text-slate-800">{t.title}</p>
                </div>
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead className="text-[10px] font-black uppercase text-slate-400">
                    <tr>
                      {t.headers.map((h) => (
                        <th key={h} className="px-3 py-2">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-1.5 font-semibold text-slate-800">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
