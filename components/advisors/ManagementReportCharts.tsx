'use client';

/**
 * On-screen charts for Advisor management report packs.
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

const optsCommon = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { mode: 'index' as const, intersect: false },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 10 }, maxRotation: 0 },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(148,163,184,0.25)' },
      ticks: { font: { size: 10 } },
    },
  },
};

function ChartCard({ chart }: { chart: ManagementChart }) {
  const labels = chart.series.map((s) => s.label);
  const values = chart.series.map((s) => s.value);
  const colors = chart.series.map(
    (s, i) => s.color || ['#0077b6', '#00b4d8', '#059669', '#d97706', '#7c3aed', '#e11d48'][i % 6]
  );

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: chart.title,
          data: values,
          backgroundColor:
            chart.type === 'donut' ? colors : colors.map((c) => c),
          borderColor: chart.type === 'line' ? colors[0] || '#0077b6' : '#ffffff',
          borderWidth: chart.type === 'donut' ? 2 : chart.type === 'line' ? 2 : 0,
          borderRadius: chart.type === 'bar' || chart.type === 'horizontal_bar' ? 6 : 0,
          fill: chart.type === 'line',
          tension: 0.35,
          pointRadius: chart.type === 'line' ? 3 : 0,
        },
      ],
    }),
    [chart.title, chart.type, labels, values, colors]
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
        {chart.title}
      </p>
      <div className="h-44">
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
                  labels: { boxWidth: 10, font: { size: 10 } },
                },
              },
              cutout: '58%',
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
    <div className="grid gap-3 md:grid-cols-2">
      {charts.slice(0, 2).map((c) => (
        <ChartCard key={c.id} chart={c} />
      ))}
    </div>
  );
}
