'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Download,
  Landmark,
  Loader2,
  RefreshCw,
  Sparkles,
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

type SchoolRow = {
  school_profile_id: number;
  school_name: string;
  province?: string | null;
  district?: string | null;
  score?: number;
  nutritionPassPct?: number | null;
  avgEnergyKcal?: number | null;
  avgProteinG?: number | null;
  mealsServed?: number;
  daysFed?: number;
  wastePct?: number;
  learners?: number;
};

export default function AgencyNutritionPage() {
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
  const [forbidden, setForbidden] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: period.from,
        to: period.to,
        mode: 'agency',
      });
      const res = await fetch(`/api/schools/nutrition?${params}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.status === 403) {
        setForbidden(true);
        setData(null);
        return;
      }
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

  const aggregate = (data?.aggregate || {}) as Record<string, number | null>;
  const schools = (data?.schools || []) as SchoolRow[];
  const agency = (data?.agency || {}) as { name?: string };

  const exportCsv = () => {
    const lines = [
      'school,province,district,score,pass_pct,avg_energy,avg_protein,meals,days_fed,waste_pct,learners',
    ];
    for (const s of schools) {
      lines.push(
        [
          csv(s.school_name),
          s.province || '',
          s.district || '',
          s.score ?? '',
          s.nutritionPassPct ?? '',
          s.avgEnergyKcal ?? '',
          s.avgProteinG ?? '',
          s.mealsServed ?? '',
          s.daysFed ?? '',
          s.wastePct ?? '',
          s.learners ?? '',
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dbe-nutrition-${period.from}_${period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (forbidden) {
    return (
      <SchoolsPage>
        <SchoolsHeader
          title="Programme nutrition"
          titleAccent="DBE only"
          mode="agency"
          description="Register as DBE/PEU to see multi-school nutrition roll-ups."
        />
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center max-w-lg">
          <Landmark className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <p className="font-bold">Not an agency workspace</p>
          <Link
            href="/dashboard/schools/agency"
            className="btn-primary !py-2 !px-4 text-sm mt-4 inline-flex"
          >
            Register / open DBE →
          </Link>
        </div>
      </SchoolsPage>
    );
  }

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Programme nutrition"
        titleAccent={agency.name || 'DBE'}
        mode="agency"
        description="Aggregate energy, protein, pass rates and waste across all approved schools — the national / provincial nutrition cockpit."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> CSV
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
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              {
                label: 'Schools',
                value: String(aggregate.schools ?? schools.length),
              },
              {
                label: 'Avg nutrition score',
                value:
                  aggregate.avgNutritionScore != null
                    ? String(aggregate.avgNutritionScore)
                    : '—',
              },
              {
                label: 'Avg pass %',
                value:
                  aggregate.avgNutritionPassPct != null
                    ? `${aggregate.avgNutritionPassPct}%`
                    : '—',
              },
              {
                label: 'Meals served',
                value: String(aggregate.totalMealsServed ?? 0),
              },
              {
                label: 'Avg energy',
                value:
                  aggregate.avgEnergyKcal != null
                    ? `${aggregate.avgEnergyKcal} kcal`
                    : '—',
              },
              {
                label: 'Avg protein',
                value:
                  aggregate.avgProteinG != null
                    ? `${aggregate.avgProteinG} g`
                    : '—',
              },
              {
                label: 'Avg waste',
                value:
                  aggregate.avgWastePct != null
                    ? `${aggregate.avgWastePct}%`
                    : '—',
              },
              {
                label: 'Below 70% pass',
                value: String(aggregate.schoolsBelowNorm ?? 0),
              },
            ].map((k) => (
              <div
                key={k.label}
                className="rounded-2xl border border-sky-200 bg-white dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/40 px-3 py-3"
              >
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  {k.label}
                </p>
                <p className="text-xl font-black tabular-nums mt-0.5">
                  {k.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 overflow-hidden">
            <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00b4d8]" />
              Schools ranked by nutrition score
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-3">#</th>
                    <th className="px-3 py-3">School</th>
                    <th className="px-3 py-3">District</th>
                    <th className="px-3 py-3 text-right">Score</th>
                    <th className="px-3 py-3 text-right">Pass %</th>
                    <th className="px-3 py-3 text-right">Energy</th>
                    <th className="px-3 py-3 text-right">Protein</th>
                    <th className="px-3 py-3 text-right">Meals</th>
                    <th className="px-3 py-3 text-right">Waste %</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-12 text-center text-slate-500"
                      >
                        No approved schools with feeding data in this period.
                      </td>
                    </tr>
                  ) : (
                    schools.map((s, i) => (
                      <tr
                        key={s.school_profile_id}
                        className="border-b border-slate-50"
                      >
                        <td className="px-4 py-2.5 text-slate-400 font-bold">
                          {i + 1}
                        </td>
                        <td className="px-3 py-2.5 font-semibold">
                          {s.school_name}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">
                          {[s.district, s.province].filter(Boolean).join(', ') ||
                            '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-black tabular-nums">
                          {s.score ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {s.nutritionPassPct != null
                            ? `${s.nutritionPassPct}%`
                            : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {s.avgEnergyKcal ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {s.avgProteinG ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {s.mealsServed ?? 0}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {s.wastePct ?? 0}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </SchoolsPage>
  );
}

function csv(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
