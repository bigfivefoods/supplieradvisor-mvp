'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  Download,
  Loader2,
  Minus,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import type { BenchmarkKpi } from '@/lib/schools/nutrition-report';

type LearnerRow = {
  learner_id: number;
  display_name?: string;
  grade?: string | null;
  estimated_meals: number;
  estimated_energy_kcal: number;
  estimated_protein_g: number;
  estimated_daily_energy_kcal: number;
  estimated_daily_protein_g: number;
  overall_ok: boolean | null;
};

export default function SchoolNutritionPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('this_month', 3)
  );
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: period.from,
        to: period.to,
        mode: 'school',
        learners: '1',
      });
      const res = await fetch(`/api/schools/nutrition?${params}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, period.from, period.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = (data?.summary || {}) as Record<string, number | null>;
  const benchmarks = (data?.benchmarks || []) as BenchmarkKpi[];
  const learners = (data?.learners || {}) as {
    privacy?: boolean;
    total?: number;
    meetingNorm?: number;
    belowNorm?: number;
    rows?: LearnerRow[];
  };
  const school = (data?.school || {}) as Record<string, unknown>;
  const agency = (data?.agency || {}) as {
    name?: string | null;
    peerCount?: number;
  };
  const norms = (data?.norms || {}) as {
    min_energy_kcal?: number;
    min_protein_g?: number;
  };
  const trend = (data?.trend || []) as Array<{
    date: string;
    served: number;
    energy: number | null;
    protein: number | null;
    pass: boolean | null;
  }>;

  const exportLearnersCsv = () => {
    const rows = learners.rows || [];
    const lines = [
      'learner_id,name,grade,estimated_meals,estimated_kcal,estimated_protein_g,daily_kcal,daily_protein_g,meets_norm',
    ];
    for (const r of rows) {
      lines.push(
        [
          r.learner_id,
          csv(r.display_name || ''),
          r.grade || '',
          r.estimated_meals,
          r.estimated_energy_kcal,
          r.estimated_protein_g,
          r.estimated_daily_energy_kcal,
          r.estimated_daily_protein_g,
          r.overall_ok == null ? '' : r.overall_ok ? 'yes' : 'no',
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutrition-learners-${period.from}_${period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Nutrition report"
        titleAccent={String(school.name || 'School')}
        description="Per-meal energy & protein vs NSNP norms, learner estimates, and how you compare to the DBE / PEU average across linked schools."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportLearnersCsv}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Learners CSV
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      <PeriodSlicer
        value={period}
        onChange={setPeriod}
        showTrailing
        className="mb-4"
      />

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : !data ? (
        <p className="text-sm text-slate-500">No data</p>
      ) : (
        <div className="space-y-6">
          {/* Score hero */}
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 flex flex-wrap gap-6 items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Nutrition score
              </p>
              <p className="text-5xl font-black tabular-nums text-slate-900">
                {summary.score != null ? summary.score : '—'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Norm lunch: {norms.min_energy_kcal ?? 450} kcal ·{' '}
                {norms.min_protein_g ?? 15}g protein
              </p>
            </div>
            <div className="flex-1 min-w-[12rem] grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat
                label="Pass days"
                value={
                  summary.nutritionPassPct != null
                    ? `${summary.nutritionPassPct}%`
                    : '—'
                }
              />
              <Stat
                label="Avg energy"
                value={
                  summary.avgEnergyKcal != null
                    ? `${summary.avgEnergyKcal}`
                    : '—'
                }
                sub="kcal/meal"
              />
              <Stat
                label="Avg protein"
                value={
                  summary.avgProteinG != null ? `${summary.avgProteinG}` : '—'
                }
                sub="g/meal"
              />
              <Stat
                label="Meals served"
                value={String(summary.mealsServed ?? 0)}
                sub={`${summary.daysFed ?? 0} days`}
              />
            </div>
          </div>

          {/* vs DBE */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-black text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00b4d8]" />
                vs DBE / PEU average
              </h2>
              <p className="text-[11px] text-slate-500">
                {agency.name
                  ? `${agency.name} · ${agency.peerCount || 0} schools`
                  : 'Join DBE to unlock peer averages'}
              </p>
            </div>
            {!agency.name ? (
              <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm">
                Link your school to a DBE/PEU under{' '}
                <Link
                  href="/dashboard/schools/agency"
                  className="font-bold underline"
                >
                  Join DBE
                </Link>{' '}
                to see how you rank against other approved schools.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {benchmarks.map((b) => (
                  <BenchmarkCard key={b.key} b={b} />
                ))}
              </div>
            )}
          </div>

          {/* Trend */}
          {trend.length > 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
                Daily trend
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                      <th className="px-4 py-2">Date</th>
                      <th className="px-3 py-2 text-right">Served</th>
                      <th className="px-3 py-2 text-right">Energy</th>
                      <th className="px-3 py-2 text-right">Protein</th>
                      <th className="px-3 py-2 text-right">Norm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.slice(-21).map((t) => (
                      <tr key={t.date} className="border-b border-slate-50">
                        <td className="px-4 py-2 font-mono text-xs">
                          {t.date}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold">
                          {t.served}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {t.energy ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {t.protein ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {t.pass == null ? (
                            <span className="text-slate-400">—</span>
                          ) : t.pass ? (
                            <span className="text-emerald-700 font-bold text-xs">
                              PASS
                            </span>
                          ) : (
                            <span className="text-rose-700 font-bold text-xs">
                              BELOW
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Learners */}
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                <Users className="w-4 h-4 text-[#00b4d8]" />
                Per-learner nutrition estimate
                {learners.privacy ? (
                  <span className="normal-case font-semibold text-violet-700">
                    · privacy on
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-slate-500">
                {learners.meetingNorm ?? 0} meeting · {learners.belowNorm ?? 0}{' '}
                below · {learners.total ?? 0} learners
              </p>
            </div>
            <p className="px-4 py-2 text-[11px] text-slate-500 border-b bg-slate-50">
              {String(data.methodNote || '')}
            </p>
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-2">Learner</th>
                    <th className="px-3 py-2">Grade</th>
                    <th className="px-3 py-2 text-right">Meals</th>
                    <th className="px-3 py-2 text-right">kcal</th>
                    <th className="px-3 py-2 text-right">Protein g</th>
                    <th className="px-3 py-2 text-right">Daily kcal</th>
                    <th className="px-3 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(learners.rows || []).length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        Import learners and log serve days with menu nutrition
                        for estimates.
                      </td>
                    </tr>
                  ) : (
                    (learners.rows || []).map((r) => (
                      <tr
                        key={r.learner_id}
                        className="border-b border-slate-50"
                      >
                        <td className="px-4 py-2 font-semibold">
                          {r.display_name}
                        </td>
                        <td className="px-3 py-2 text-xs">{r.grade || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.estimated_meals}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.estimated_energy_kcal}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.estimated_protein_g}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.estimated_daily_energy_kcal}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.overall_ok == null ? (
                            <span className="text-slate-400 text-xs">n/a</span>
                          ) : r.overall_ok ? (
                            <span className="text-emerald-700 font-bold text-xs">
                              OK
                            </span>
                          ) : (
                            <span className="text-rose-700 font-bold text-xs">
                              LOW
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </SchoolsPage>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white/80 px-3 py-2">
      <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
      <p className="text-lg font-black tabular-nums">{value}</p>
      {sub ? <p className="text-[10px] text-slate-400">{sub}</p> : null}
    </div>
  );
}

function BenchmarkCard({ b }: { b: BenchmarkKpi }) {
  const good =
    b.delta == null
      ? null
      : b.higherIsBetter === false
        ? b.delta <= 0
        : b.delta >= 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {b.label}
      </p>
      <div className="flex items-end justify-between gap-2 mt-1">
        <div>
          <p className="text-xl font-black tabular-nums">
            {b.school != null ? b.school : '—'}
            {b.unit ? (
              <span className="text-xs font-bold text-slate-400 ml-0.5">
                {b.unit}
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-slate-500">
            DBE avg {b.agencyAvg != null ? b.agencyAvg : '—'}
            {b.unit || ''}
          </p>
        </div>
        {b.delta != null ? (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-black tabular-nums ${
              good === null
                ? 'text-slate-400'
                : good
                  ? 'text-emerald-700'
                  : 'text-rose-700'
            }`}
          >
            {b.delta > 0 ? (
              <ArrowUp className="w-3.5 h-3.5" />
            ) : b.delta < 0 ? (
              <ArrowDown className="w-3.5 h-3.5" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
            {b.delta > 0 ? '+' : ''}
            {b.delta}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function csv(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
