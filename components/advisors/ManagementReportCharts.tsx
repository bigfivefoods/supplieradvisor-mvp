'use client';

/**
 * On-screen charts for Advisor management report packs.
 * Light + dark: dark mode uses deep card surfaces and brighter series/labels.
 */
import { useEffect, useMemo, useState } from 'react';
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
  '#38bdf8',
  '#22d3ee',
  '#34d399',
  '#fbbf24',
  '#a78bfa',
  '#fb7185',
  '#2dd4bf',
  '#818cf8',
];

const PALETTE_LIGHT = [
  '#0077b6',
  '#00b4d8',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#e11d48',
  '#0d9488',
  '#4f46e5',
];

function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const read = () =>
      root.classList.contains('dark') ||
      root.getAttribute('data-theme') === 'dark';
    setDark(read());
    const obs = new MutationObserver(() => setDark(read()));
    obs.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function ChartCard({
  chart,
  isDark,
}: {
  chart: ManagementChart;
  isDark: boolean;
}) {
  const palette = isDark ? PALETTE : PALETTE_LIGHT;
  const labels = chart.series.map((s) => s.label);
  const values = chart.series.map((s) => s.value);
  const colors = chart.series.map(
    (s, i) => s.color || palette[i % palette.length]
  );

  const tickColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark
    ? 'rgba(148,163,184,0.12)'
    : 'rgba(148,163,184,0.2)';
  const legendColor = isDark ? '#e2e8f0' : '#475569';
  const donutBorder = isDark ? '#0f172a' : '#ffffff';
  const lineFill = isDark
    ? 'rgba(34,211,238,0.18)'
    : 'rgba(0,180,216,0.15)';
  const pointFill = isDark ? '#0f172a' : '#ffffff';

  const optsCommon = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: isDark
            ? 'rgba(15,23,42,0.96)'
            : 'rgba(15,23,42,0.92)',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0',
          borderColor: isDark ? 'rgba(34,211,238,0.35)' : 'transparent',
          borderWidth: isDark ? 1 : 0,
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
            color: tickColor,
            maxRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: gridColor },
          ticks: { font: { size: 10 }, color: tickColor },
        },
      },
    }),
    [isDark, tickColor, gridColor]
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
              ? lineFill
              : chart.type === 'donut'
                ? colors
                : colors,
          borderColor:
            chart.type === 'line'
              ? colors[0] || palette[0]
              : chart.type === 'donut'
                ? donutBorder
                : colors,
          borderWidth:
            chart.type === 'donut' ? 3 : chart.type === 'line' ? 2.5 : 0,
          borderRadius:
            chart.type === 'bar' || chart.type === 'horizontal_bar' ? 8 : 0,
          borderSkipped: false as const,
          fill: chart.type === 'line',
          tension: 0.4,
          pointRadius: chart.type === 'line' ? 4 : 0,
          pointHoverRadius: chart.type === 'line' ? 6 : 0,
          pointBackgroundColor: pointFill,
          pointBorderColor: colors[0] || palette[0],
          pointBorderWidth: 2,
        },
      ],
    }),
    [
      chart.title,
      chart.type,
      labels,
      values,
      colors,
      lineFill,
      donutBorder,
      pointFill,
      palette,
    ]
  );

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900 dark:shadow-none dark:ring-cyan-500/10 dark:hover:ring-cyan-400/25 dark:hover:shadow-none">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0077b6] via-[#00b4d8] to-emerald-500 dark:from-cyan-400 dark:via-teal-400 dark:to-emerald-400" />
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-1">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-200">
          {chart.title}
        </p>
        {chart.unit ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-cyan-300">
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
                    color: legendColor,
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
  const isDark = useIsDark();
  const charts = useMemo(() => ensureManagementCharts(report), [report]);
  if (!charts.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-cyan-300/70">
          Charts & trends
        </p>
        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-400">
          {charts.length} visual{charts.length === 1 ? '' : 's'} · same data as
          PDF
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
          <ChartCard key={c.id} chart={c} isDark={isDark} />
        ))}
      </div>
    </div>
  );
}
