'use client';

import { useMemo } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { AlertTriangle, PieChart, Users } from 'lucide-react';
import {
  ChartCard,
  EmptyChartState,
  MixDoughnut,
} from '@/components/accounting/AccountingCharts';
import {
  riadSlicePack,
  riadSummaryOf,
  type RiadMetricRow,
  type RiadSummary,
} from '@/lib/riad/slice-metrics';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const STATUS_CHIPS: Array<{
  key: string;
  label: string;
  countKey: keyof RiadSummary;
  on: string;
  off: string;
}> = [
  {
    key: 'all',
    label: 'All',
    countKey: 'total',
    on: 'bg-slate-900 text-white border-slate-900',
    off: 'bg-white text-slate-700 border-slate-200',
  },
  {
    key: 'open',
    label: 'Open',
    countKey: 'open',
    on: 'bg-sky-600 text-white border-sky-600',
    off: 'bg-sky-50 text-sky-900 border-sky-100',
  },
  {
    key: 'in_progress',
    label: 'In progress',
    countKey: 'inProgress',
    on: 'bg-indigo-600 text-white border-indigo-600',
    off: 'bg-indigo-50 text-indigo-900 border-indigo-100',
  },
  {
    key: 'on_hold',
    label: 'On hold',
    countKey: 'onHold',
    on: 'bg-amber-500 text-white border-amber-500',
    off: 'bg-amber-50 text-amber-900 border-amber-100',
  },
  {
    key: 'closed',
    label: 'Closed',
    countKey: 'closed',
    on: 'bg-emerald-600 text-white border-emerald-600',
    off: 'bg-emerald-50 text-emerald-900 border-emerald-100',
  },
  {
    key: 'critical',
    label: 'Critical open',
    countKey: 'critical',
    on: 'bg-red-600 text-white border-red-600',
    off: 'bg-red-50 text-red-900 border-red-100',
  },
];

function CountBar({
  labels,
  values,
  colors,
  empty,
}: {
  labels: string[];
  values: number[];
  colors: string[];
  empty: boolean;
}) {
  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 36,
      },
    ],
  };
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: ${Number(ctx.parsed.y || 0)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10, weight: 600 }, color: '#64748b' },
      },
      y: {
        beginAtZero: true,
        ticks: { precision: 0, font: { size: 10 }, color: '#64748b' },
        grid: { color: 'rgba(226, 232, 240, 0.9)' },
      },
    },
  };
  return (
    <div className="relative h-full w-full">
      {empty ? <EmptyChartState message="Log RIAD entries to populate this chart" /> : null}
      <Bar data={data} options={options} />
    </div>
  );
}

function MonthBar({
  labels,
  open,
  closed,
}: {
  labels: string[];
  open: number[];
  closed: number[];
}) {
  const empty = !open.some((n) => n > 0) && !closed.some((n) => n > 0);
  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: 'Open',
        data: open,
        backgroundColor: '#0284c7',
        borderRadius: 6,
        stack: 'm',
      },
      {
        label: 'Closed',
        data: closed,
        backgroundColor: '#10b981',
        borderRadius: 6,
        stack: 'm',
      },
    ],
  };
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 10, font: { size: 10, weight: 600 } },
      },
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 }, color: '#64748b' } },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { precision: 0, font: { size: 10 }, color: '#64748b' },
        grid: { color: 'rgba(226, 232, 240, 0.9)' },
      },
    },
  };
  return (
    <div className="relative h-full w-full">
      {empty ? <EmptyChartState message="No dated RIAD in the last six months" /> : null}
      <Bar data={data} options={options} />
    </div>
  );
}

export function RiadMetricsBoard({
  universe,
  slice,
  summary,
  statusFilter,
  onStatusFilter,
  compact,
}: {
  /** Full register — drives the KPI cards */
  universe: RiadMetricRow[];
  /** Current slice — drives the charts */
  slice?: RiadMetricRow[];
  summary?: RiadSummary;
  statusFilter: string;
  onStatusFilter: (key: string) => void;
  compact?: boolean;
}) {
  const cards = summary || riadSummaryOf(universe);
  const chartItems = slice ?? universe;
  const pack = useMemo(() => riadSlicePack(chartItems), [chartItems]);
  const totalSlice = chartItems.length;

  return (
    <div className="space-y-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
        Status overview · click a card to slice
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {STATUS_CHIPS.map((c) => {
          const on = statusFilter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onStatusFilter(c.key)}
              className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                on ? `${c.on} shadow-md` : c.off
              }`}
            >
              <div className="text-[11px] font-medium opacity-90">{c.label}</div>
              <div className="mt-0.5 text-2xl font-black tabular-nums tracking-tight">
                {cards[c.countKey]}
              </div>
            </button>
          );
        })}
      </div>

      {compact ? null : (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            <ChartCard
              title="Type mix"
              subtitle="Risk · issue · action · decision"
              height={220}
              icon={PieChart}
            >
              <MixDoughnut
                format="count"
                emptyMessage="Log RIAD entries to populate this chart"
                segments={pack.byType}
                centerLabel="This slice"
                centerValue={String(totalSlice)}
              />
            </ChartCard>
            <ChartCard
              title="Severity"
              subtitle="How hot the open book is"
              height={220}
              icon={AlertTriangle}
            >
              <CountBar
                labels={pack.bySeverity.map((s) => s.label)}
                values={pack.bySeverity.map((s) => s.value)}
                colors={pack.bySeverity.map((s) => s.color)}
                empty={!pack.bySeverity.length}
              />
            </ChartCard>
            <ChartCard
              title="Owners"
              subtitle="Who is holding the log"
              height={220}
              icon={Users}
            >
              <MixDoughnut
                format="count"
                emptyMessage="Assign owners on the register"
                segments={pack.byOwner}
                centerLabel="People"
                centerValue={String(pack.byOwner.length)}
              />
            </ChartCard>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard
              title="Status mix"
              subtitle="This slice"
              height={220}
            >
              <MixDoughnut
                format="count"
                emptyMessage="Log RIAD entries to populate this chart"
                segments={pack.byStatus}
                centerLabel="Entries"
                centerValue={String(totalSlice)}
              />
            </ChartCard>
            <ChartCard
              title="Logged (6 months)"
              subtitle="Open vs closed by month raised"
              height={220}
            >
              <MonthBar
                labels={pack.byMonth.map((m) => m.label)}
                open={pack.byMonth.map((m) => m.open)}
                closed={pack.byMonth.map((m) => m.closed)}
              />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
