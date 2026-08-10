'use client';

/**
 * NSNP Monitoring Tool report — slice & dice + charts for DBE/PEU.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  ClipboardCheck,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  TrendingUp,
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
import type {
  MonitoringReportPayload,
  MonitoringReportRow,
} from '@/lib/schools/nsnp-monitoring-report';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const COLORS = {
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#f43f5e',
  sky: '#0ea5e9',
  teal: '#14b8a6',
  violet: '#8b5cf6',
  slate: '#64748b',
  indigo: '#6366f1',
  amber: '#f59e0b',
  grid: 'rgba(226, 232, 240, 0.9)',
  tick: '#64748b',
};

export default function MonitoringReportPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('this_month', 4)
  );
  const [status, setStatus] = useState('submitted');
  const [district, setDistrict] = useState('');
  const [circuit, setCircuit] = useState('');
  const [quintile, setQuintile] = useState('');
  const [traffic, setTraffic] = useState('all');
  const [monitor, setMonitor] = useState('');
  const [feeding, setFeeding] = useState('all');
  const [breakfast, setBreakfast] = useState('all');
  const [q, setQ] = useState('');
  const [minKpi, setMinKpi] = useState('');
  const [maxKpi, setMaxKpi] = useState('');
  const [report, setReport] = useState<MonitoringReportPayload | null>(null);
  const [role, setRole] = useState<string>('agency');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: period.from,
        to: period.to,
      });
      if (status) params.set('status', status);
      if (district) params.set('district', district);
      if (circuit) params.set('circuit', circuit);
      if (quintile) params.set('quintile', quintile);
      if (traffic && traffic !== 'all') params.set('traffic', traffic);
      if (monitor.trim()) params.set('monitor', monitor.trim());
      if (feeding && feeding !== 'all') params.set('feeding', feeding);
      if (breakfast && breakfast !== 'all') params.set('breakfast', breakfast);
      if (q.trim()) params.set('q', q.trim());
      if (minKpi !== '') params.set('minKpi', minKpi);
      if (maxKpi !== '') params.set('maxKpi', maxKpi);

      const res = await fetch(
        `/api/schools/monitoring/report?${params}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setReport(data.report || null);
      setRole(data.role || 'agency');
      if (data.warning) toast.message(data.warning);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [
    companyId,
    period.from,
    period.to,
    status,
    district,
    circuit,
    quintile,
    traffic,
    monitor,
    feeding,
    breakfast,
    q,
    minKpi,
    maxKpi,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const facets = report?.facets;
  const s = report?.summary;

  const trafficChart = useMemo((): ChartData<'doughnut'> => {
    const t = report?.traffic || [];
    return {
      labels: t.map((x) => x.name),
      datasets: [
        {
          data: t.map((x) => x.count),
          backgroundColor: [COLORS.green, COLORS.yellow, COLORS.red],
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    };
  }, [report]);

  const scoresChart = useMemo((): ChartData<'bar'> => {
    const a = report?.scoreAverages || [];
    return {
      labels: a.map((x) => x.name),
      datasets: [
        {
          label: 'Average score',
          data: a.map((x) => x.value),
          backgroundColor: [
            COLORS.sky,
            COLORS.teal,
            COLORS.violet,
            COLORS.amber,
          ],
          borderRadius: 8,
        },
      ],
    };
  }, [report]);

  const districtChart = useMemo((): ChartData<'bar'> => {
    const d = (report?.byDistrict || []).slice(0, 12);
    return {
      labels: d.map((x) => x.name),
      datasets: [
        {
          label: 'Visits',
          data: d.map((x) => x.count),
          backgroundColor: 'rgba(14, 165, 233, 0.75)',
          borderRadius: 6,
        },
        {
          label: 'Avg KPI',
          data: d.map((x) => x.avg_kpi ?? 0),
          backgroundColor: 'rgba(139, 92, 246, 0.65)',
          borderRadius: 6,
        },
      ],
    };
  }, [report]);

  const monthChart = useMemo((): ChartData<'line'> => {
    const m = report?.byMonth || [];
    return {
      labels: m.map((x) => x.period),
      datasets: [
        {
          label: 'Visits',
          data: m.map((x) => x.count),
          borderColor: COLORS.sky,
          backgroundColor: 'rgba(14, 165, 233, 0.12)',
          fill: true,
          tension: 0.35,
          yAxisID: 'y',
        },
        {
          label: 'Avg KPI',
          data: m.map((x) => x.avg_kpi ?? 0),
          borderColor: COLORS.teal,
          backgroundColor: 'transparent',
          tension: 0.35,
          yAxisID: 'y1',
        },
      ],
    };
  }, [report]);

  const quintileChart = useMemo((): ChartData<'bar'> => {
    const d = report?.byQuintile || [];
    return {
      labels: d.map((x) => x.name),
      datasets: [
        {
          label: 'Avg KPI',
          data: d.map((x) => x.avg_kpi ?? 0),
          backgroundColor: 'rgba(20, 184, 166, 0.8)',
          borderRadius: 8,
        },
        {
          label: 'Visits',
          data: d.map((x) => x.count),
          backgroundColor: 'rgba(99, 102, 241, 0.55)',
          borderRadius: 8,
        },
      ],
    };
  }, [report]);

  const monitorChart = useMemo((): ChartData<'bar'> => {
    const d = (report?.byMonitor || []).slice(0, 10);
    return {
      labels: d.map((x) => x.name),
      datasets: [
        {
          label: 'Visits completed',
          data: d.map((x) => x.count),
          backgroundColor: 'rgba(139, 92, 246, 0.75)',
          borderRadius: 8,
        },
      ],
    };
  }, [report]);

  const feedingChart = useMemo((): ChartData<'doughnut'> => {
    const f = report?.feeding || [];
    return {
      labels: f.map((x) => x.name),
      datasets: [
        {
          data: f.map((x) => x.count),
          backgroundColor: [COLORS.green, COLORS.red, COLORS.slate],
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    };
  }, [report]);

  const kpiBandChart = useMemo((): ChartData<'bar'> => {
    const b = report?.kpiBands || [];
    return {
      labels: b.map((x) => x.name),
      datasets: [
        {
          label: 'Schools / visits',
          data: b.map((x) => x.count),
          backgroundColor: [
            COLORS.green,
            COLORS.yellow,
            COLORS.red,
            COLORS.slate,
          ],
          borderRadius: 8,
        },
      ],
    };
  }, [report]);

  const barOpts: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: COLORS.grid },
        ticks: { color: COLORS.tick },
      },
      x: {
        grid: { display: false },
        ticks: { color: COLORS.tick, maxRotation: 40 },
      },
    },
  };

  const doughnutOpts: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
    },
    cutout: '58%',
  };

  const lineOpts: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: COLORS.grid },
        ticks: { color: COLORS.tick },
      },
      y1: {
        beginAtZero: true,
        max: 100,
        position: 'right',
        grid: { drawOnChartArea: false },
        ticks: { color: COLORS.tick },
      },
      x: {
        grid: { display: false },
        ticks: { color: COLORS.tick },
      },
    },
  };

  const exportCsv = () => {
    const rows = report?.rows || [];
    if (!rows.length) {
      toast.message('No rows to export');
      return;
    }
    const headers = [
      'id',
      'visit_date',
      'status',
      'school_name',
      'emis_number',
      'district',
      'circuit',
      'quintile',
      'monitor_name',
      'overall_kpi',
      'rkmp_score',
      'nehs_score',
      'gardens_score',
      'traffic_light',
      'feeding_today',
      'breakfast_served',
      'sp_name',
      'nsnp_learners',
      'learners_eating',
    ];
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        headers
          .map((h) => escape((r as MonitoringReportRow)[h as keyof MonitoringReportRow]))
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nsnp-monitoring-report-${period.from}_${period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const clearFilters = () => {
    setStatus('submitted');
    setDistrict('');
    setCircuit('');
    setQuintile('');
    setTraffic('all');
    setMonitor('');
    setFeeding('all');
    setBreakfast('all');
    setQ('');
    setMinKpi('');
    setMaxKpi('');
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Monitoring tool report"
        titleAccent="Slice · dice · graphs"
        mode="agency"
        description="Analyse NSNP field monitoring visits — KPI traffic lights, district performance, PEU activity, feeding and prize-linked scores."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/schools/monitoring"
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <ClipboardCheck className="w-3.5 h-3.5" /> Forms
            </Link>
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
              className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        }
      />

      <div className="mb-4">
        <PeriodSlicer value={period} onChange={setPeriod} />
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 p-4 space-y-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <Filter className="w-3.5 h-3.5" /> Filters
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          <FilterField label="Status">
            <select
              className="field"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All</option>
              <option value="submitted">Submitted</option>
              <option value="draft">Drafts</option>
            </select>
          </FilterField>
          <FilterField label="Traffic light">
            <select
              className="field"
              value={traffic}
              onChange={(e) => setTraffic(e.target.value)}
            >
              <option value="all">All</option>
              <option value="green">Green</option>
              <option value="yellow">Yellow</option>
              <option value="red">Red</option>
            </select>
          </FilterField>
          <FilterField label="District">
            <select
              className="field"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            >
              <option value="">All districts</option>
              {(facets?.districts || []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Circuit">
            <select
              className="field"
              value={circuit}
              onChange={(e) => setCircuit(e.target.value)}
            >
              <option value="">All circuits</option>
              {(facets?.circuits || []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Quintile">
            <select
              className="field"
              value={quintile}
              onChange={(e) => setQuintile(e.target.value)}
            >
              <option value="">All</option>
              {(facets?.quintiles || ['1', '2', '3', '4', '5']).map((q) => (
                <option key={q} value={q}>
                  Q{q}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Monitor">
            <select
              className="field"
              value={monitor}
              onChange={(e) => setMonitor(e.target.value)}
            >
              <option value="">All monitors</option>
              {(facets?.monitors || []).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Feeding today">
            <select
              className="field"
              value={feeding}
              onChange={(e) => setFeeding(e.target.value)}
            >
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </FilterField>
          <FilterField label="Breakfast">
            <select
              className="field"
              value={breakfast}
              onChange={(e) => setBreakfast(e.target.value)}
            >
              <option value="all">All</option>
              <option value="yes">Served</option>
              <option value="no">Not served</option>
            </select>
          </FilterField>
          <FilterField label="Min KPI">
            <input
              className="field"
              inputMode="numeric"
              placeholder="0"
              value={minKpi}
              onChange={(e) => setMinKpi(e.target.value)}
            />
          </FilterField>
          <FilterField label="Max KPI">
            <input
              className="field"
              inputMode="numeric"
              placeholder="100"
              value={maxKpi}
              onChange={(e) => setMaxKpi(e.target.value)}
            />
          </FilterField>
          <FilterField label="Search" className="sm:col-span-2">
            <input
              className="field"
              placeholder="School, EMIS, SP, district…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </FilterField>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            Clear filters
          </button>
          <span className="text-[11px] text-slate-400">
            {role === 'school'
              ? 'School view — your submitted visits only'
              : 'DBE view — all agency monitoring visits'}
          </span>
        </div>
      </div>

      {loading && !report ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
            <KpiCard label="Visits" value={String(s?.total ?? 0)} />
            <KpiCard
              label="Avg KPI"
              value={s?.avg_kpi != null ? String(s.avg_kpi) : '—'}
              sub="/100"
              tone={
                s?.avg_kpi != null
                  ? s.avg_kpi >= 81
                    ? 'green'
                    : s.avg_kpi >= 50
                      ? 'yellow'
                      : 'red'
                  : undefined
              }
            />
            <KpiCard
              label="Green"
              value={String(s?.green ?? 0)}
              tone="green"
            />
            <KpiCard
              label="Yellow"
              value={String(s?.yellow ?? 0)}
              tone="yellow"
            />
            <KpiCard label="Red" value={String(s?.red ?? 0)} tone="red" />
            <KpiCard
              label="Schools"
              value={String(s?.schools_visited ?? 0)}
              sub={`${s?.monitors ?? 0} monitors`}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            <MiniStat
              label="Avg RKMP"
              value={s?.avg_rkmp != null ? `${s.avg_rkmp}/20` : '—'}
            />
            <MiniStat
              label="Avg NEHS"
              value={s?.avg_nehs != null ? `${s.avg_nehs}/20` : '—'}
            />
            <MiniStat
              label="Avg gardens"
              value={s?.avg_gardens != null ? `${s.avg_gardens}/10` : '—'}
            />
            <MiniStat
              label="Feeding yes"
              value={`${s?.feeding_yes ?? 0} · no ${s?.feeding_no ?? 0}`}
            />
          </div>

          {/* Charts grid */}
          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <ChartCard title="Traffic light mix" icon>
              <div className="h-64">
                {(s?.total ?? 0) === 0 ? (
                  <EmptyChart />
                ) : (
                  <Doughnut data={trafficChart} options={doughnutOpts} />
                )}
              </div>
            </ChartCard>
            <ChartCard title="Average scores">
              <div className="h-64">
                {(s?.total ?? 0) === 0 ? (
                  <EmptyChart />
                ) : (
                  <Bar data={scoresChart} options={barOpts} />
                )}
              </div>
            </ChartCard>
            <ChartCard title="KPI band distribution">
              <div className="h-64">
                {(s?.total ?? 0) === 0 ? (
                  <EmptyChart />
                ) : (
                  <Bar data={kpiBandChart} options={barOpts} />
                )}
              </div>
            </ChartCard>
            <ChartCard title="Feeding on visit day">
              <div className="h-64">
                {(s?.total ?? 0) === 0 ? (
                  <EmptyChart />
                ) : (
                  <Doughnut data={feedingChart} options={doughnutOpts} />
                )}
              </div>
            </ChartCard>
            <ChartCard title="Visits over time" wide>
              <div className="h-72">
                {(report?.byMonth || []).length === 0 ? (
                  <EmptyChart />
                ) : (
                  <Line data={monthChart} options={lineOpts} />
                )}
              </div>
            </ChartCard>
            <ChartCard title="By district (visits + avg KPI)" wide>
              <div className="h-72">
                {(report?.byDistrict || []).length === 0 ? (
                  <EmptyChart />
                ) : (
                  <Bar data={districtChart} options={barOpts} />
                )}
              </div>
            </ChartCard>
            <ChartCard title="By quintile">
              <div className="h-64">
                {(report?.byQuintile || []).length === 0 ? (
                  <EmptyChart />
                ) : (
                  <Bar data={quintileChart} options={barOpts} />
                )}
              </div>
            </ChartCard>
            <ChartCard title="By monitor (workload)">
              <div className="h-64">
                {(report?.byMonitor || []).length === 0 ? (
                  <EmptyChart />
                ) : (
                  <Bar data={monitorChart} options={barOpts} />
                )}
              </div>
            </ChartCard>
          </div>

          {/* Rankings */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <RankList
              title="Top schools by avg KPI"
              items={report?.topSchools || []}
              tone="good"
            />
            <RankList
              title="Schools needing support (lowest KPI)"
              items={report?.bottomSchools || []}
              tone="warn"
            />
          </div>

          {/* Detail table */}
          <div className="rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 overflow-hidden">
            <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-black">Visit detail</p>
                <p className="text-[11px] text-slate-500">
                  {report?.rows?.length || 0} rows (max 500 shown)
                  {loading ? ' · refreshing…' : ''}
                </p>
              </div>
              <Link
                href="/dashboard/schools/monitoring"
                className="text-xs font-bold text-[#0077b6]"
              >
                Open form →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[960px]">
                <thead>
                  <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">School</th>
                    <th className="px-3 py-2">District</th>
                    <th className="px-3 py-2">Monitor</th>
                    <th className="px-3 py-2">KPI</th>
                    <th className="px-3 py-2">RKMP</th>
                    <th className="px-3 py-2">NEHS</th>
                    <th className="px-3 py-2">Gardens</th>
                    <th className="px-3 py-2">Feed</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {(report?.rows || []).length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-12 text-center text-slate-500"
                      >
                        No monitoring visits match these filters.
                      </td>
                    </tr>
                  ) : (
                    (report?.rows || []).map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-slate-50 hover:bg-sky-50/40"
                      >
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          {r.visit_date || '—'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-xs">
                            {r.school_name || '—'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {r.emis_number || ''}
                            {r.quintile != null ? ` · Q${r.quintile}` : ''}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {r.district || '—'}
                          {r.circuit ? (
                            <span className="block text-[10px] text-slate-400">
                              {r.circuit}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {r.monitor_name || '—'}
                        </td>
                        <td className="px-3 py-2">
                          <TrafficPill
                            light={r.traffic_light}
                            score={r.overall_kpi}
                          />
                        </td>
                        <td className="px-3 py-2 text-xs tabular-nums">
                          {r.rkmp_score != null ? r.rkmp_score : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs tabular-nums">
                          {r.nehs_score != null ? r.nehs_score : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs tabular-nums">
                          {r.gardens_score != null ? r.gardens_score : '—'}
                        </td>
                        <td className="px-3 py-2 text-[10px] font-bold uppercase">
                          {r.feeding_today || '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              r.status === 'submitted'
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex gap-2">
                            <a
                              href={`/api/schools/monitoring/pdf?companyId=${companyId}&id=${r.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-bold text-slate-600 hover:underline"
                            >
                              PDF
                            </a>
                            <Link
                              href={`/dashboard/schools/monitoring?id=${r.id}`}
                              className="text-[11px] font-bold text-[#0077b6] hover:underline"
                            >
                              View
                            </Link>
                          </div>
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

      <style jsx global>{`
        .field {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          background: white;
        }
      `}</style>
    </SchoolsPage>
  );
}

function FilterField({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-xs ${className}`}>
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'green' | 'yellow' | 'red';
}) {
  const ring =
    tone === 'green'
      ? 'border-emerald-200 bg-emerald-50'
      : tone === 'yellow'
        ? 'border-amber-200 bg-amber-50'
        : tone === 'red'
          ? 'border-rose-200 bg-rose-50'
          : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-2xl border ${ring} px-3 py-2.5`}>
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="text-xl font-black tabular-nums text-slate-900">
        {value}
        {sub ? (
          <span className="text-xs font-semibold text-slate-400 ml-1">{sub}</span>
        ) : null}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
      <div className="text-[9px] font-bold uppercase text-slate-400">{label}</div>
      <div className="text-sm font-black text-slate-800">{value}</div>
    </div>
  );
}

function ChartCard({
  title,
  children,
  wide,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  icon?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border border-sky-300 bg-sky-50 dark:!border-sky-400 dark:!bg-sky-950 dark:ring-1 dark:ring-sky-500/50 p-4 ${
        wide ? 'lg:col-span-2' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        {icon ? <TrendingUp className="w-4 h-4 text-[#0077b6]" /> : null}
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-slate-400">
      No data for current filters
    </div>
  );
}

function TrafficPill({
  light,
  score,
}: {
  light?: string | null;
  score?: number | null;
}) {
  const l = String(light || '').toLowerCase();
  const cls =
    l === 'green'
      ? 'bg-emerald-100 text-emerald-900'
      : l === 'yellow'
        ? 'bg-amber-100 text-amber-900'
        : l === 'red'
          ? 'bg-rose-100 text-rose-900'
          : 'bg-slate-100 text-slate-600';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black tabular-nums ${cls}`}
    >
      {score != null ? score : '—'}
      {light ? (
        <span className="text-[9px] uppercase opacity-70">{light}</span>
      ) : null}
    </span>
  );
}

function RankList({
  title,
  items,
  tone,
}: {
  title: string;
  items: Array<{ name: string; count: number; avg_kpi?: number | null }>;
  tone: 'good' | 'warn';
}) {
  return (
    <div
      className={`rounded-3xl border p-4 ${
        tone === 'good'
          ? 'border-emerald-100 bg-emerald-50/40'
          : 'border-amber-100 bg-amber-50/40'
      }`}
    >
      <h3 className="text-sm font-black mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">No ranked schools yet</p>
      ) : (
        <ol className="space-y-2">
          {items.map((it, i) => (
            <li
              key={it.name + i}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="text-[10px] font-bold text-slate-400 mr-1.5">
                  {i + 1}.
                </span>
                <span className="font-semibold text-slate-900">{it.name}</span>
                <span className="text-[10px] text-slate-400 ml-1">
                  ({it.count} visit{it.count === 1 ? '' : 's'})
                </span>
              </span>
              <span className="font-black tabular-nums shrink-0">
                {it.avg_kpi != null ? it.avg_kpi : '—'}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
