'use client';

/**
 * On-screen charts for Advisor management report packs.
 * Matches Insights web aesthetic (cards, brand palette, clear legends).
 */
import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import type { ManagementChart } from '@/lib/advisors/management-report';
import { ensureManagementCharts } from '@/lib/advisors/management-report';
import type { ManagementReportDoc } from '@/lib/advisors/management-report';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

const PALETTE = [
  '#0077b6',
  '#00b4d8',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#e11d48',
  '#0d9488',
  '#4f46e5',
];

const optsCommon = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      backgroundColor: 'rgba(15,23,42,0.92)',
      titleFont: { size: 11, weight: 'bold' as const },
      bodyFont: { size: 11 },
      padding: 10,
      cornerRadius: 10,
      displayColors: true,
      boxPadding: 4,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: {
        font: { size: 10, weight: 600 as const },
        color: '#64748b',
        maxRotation: 0,
      },
    },
    y: {
      beginAtZero: true,
      border: { display: false },
      grid: { color: 'rgba(148,163,184,0.2)' },
      ticks: { font: { size: 10 }, color: '#94a3b8' },
    },
  },
};

function ChartCard({ chart }: { chart: ManagementChart }) {
  const labels = chart.series.map((s) => s.label);
  const values = chart.series.map((s) => s.value);
  const colors = chart.series.map(
    (s, i) => s.color || PALETTE[i % PALETTE.length]
  );

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: chart.title,
          data: values,
          backgroundColor:
            chart.type === 'line'
              ? 'rgba(0,180,216,0.15)'
              : chart.type === 'donut'
                ? colors
                : colors,
          borderColor:
            chart.type === 'line'
              ? colors[0] || '#0077b6'
              : chart.type === 'donut'
                ? '#ffffff'
                : colors,
          borderWidth: chart.type === 'donut' ? 3 : chart.type === 'line' ? 2.5 : 0,
          borderRadius:
            chart.type === 'bar' || chart.type === 'horizontal_bar' ? 8 : 0,
          borderSkipped: false as const,
          fill: chart.type === 'line',
          tension: 0.4,
          pointRadius: chart.type === 'line' ? 4 : 0,
          pointHoverRadius: chart.type === 'line' ? 6 : 0,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: colors[0] || '#0077b6',
          pointBorderWidth: 2,
        },
      ],
    }),
    [chart.title, chart.type, labels, values, colors]
  );

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0077b6] via-[#00b4d8] to-emerald-500" />
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-1">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-600">
          {chart.title}
        </p>
        {chart.unit ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
            {chart.unit}
          </span>
        ) : null}
      </div>
      <div className="h-52 px-3 pb-3 pt-1 sm:h-56">
        {chart.type === 'donut' ? (
          <Doughnut
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: true,
                  position: 'right',
                  labels: {
                    boxWidth: 10,
                    boxHeight: 10,
                    borderRadius: 3,
                    font: { size: 10, weight: 600 },
                    color: '#475569',
                    padding: 10,
                  },
                },
                tooltip: optsCommon.plugins.tooltip,
              },
              cutout: '62%',
            }}
          />
        ) : chart.type === 'line' ? (
          <Line data={data} options={optsCommon} />
        ) : (
          <Bar
            data={data}
            options={{
              ...optsCommon,
              indexAxis: chart.type === 'horizontal_bar' ? 'y' : 'x',
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function ManagementReportCharts({
  report,
}: {
  report: ManagementReportDoc;
}) {
  const charts = useMemo(() => ensureManagementCharts(report), [report]);
  if (!charts.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Charts & trends
        </p>
        <p className="text-[10px] font-semibold text-slate-400">
          {charts.length} visual{charts.length === 1 ? '' : 's'} · same data as PDF
        </p>
      </div>
      <div
        className={`grid gap-3 ${
          charts.length === 1
            ? 'grid-cols-1'
            : charts.length >= 3
              ? 'md:grid-cols-2 xl:grid-cols-3'
              : 'md:grid-cols-2'
        }`}
      >
        {charts.slice(0, 4).map((c) => (
          <ChartCard key={c.id} chart={c} />
        ))}
      </div>
    </div>
  );
}
