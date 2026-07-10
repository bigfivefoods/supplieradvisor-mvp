'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/** High-contrast palette for dark sales portal backgrounds */
const COLORS = {
  grid: 'rgba(255,255,255,0.08)',
  tick: '#e2e8f0',
  legend: '#f1f5f9',
  projectedLine: '#fbbf24', // amber-400 — bright on slate
  projectedFill: 'rgba(251,191,36,0.22)',
  earnedLine: '#34d399', // emerald-400
  earnedFill: 'rgba(52,211,153,0.18)',
  pipelineBar: '#38bdf8', // sky-400
  commissionBar: '#fb923c', // orange-400
  tooltipBg: 'rgba(15,23,42,0.96)',
  tooltipBorder: 'rgba(251,191,36,0.45)',
  tooltipText: '#f8fafc',
};

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: {
      position: 'top' as const,
      align: 'end' as const,
      labels: {
        color: COLORS.legend,
        boxWidth: 14,
        boxHeight: 14,
        padding: 16,
        usePointStyle: true,
        pointStyle: 'circle' as const,
        font: { size: 12, weight: 600 as const },
      },
    },
    tooltip: {
      backgroundColor: COLORS.tooltipBg,
      titleColor: COLORS.tooltipText,
      bodyColor: COLORS.tooltipText,
      borderColor: COLORS.tooltipBorder,
      borderWidth: 1,
      padding: 12,
      cornerRadius: 12,
      titleFont: { size: 12, weight: 700 as const },
      bodyFont: { size: 12 },
      displayColors: true,
      callbacks: {
        label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
          `${ctx.dataset.label || ''}: R${Number(ctx.parsed.y || 0).toLocaleString('en-ZA')}`,
      },
    },
  },
  scales: {
    x: {
      ticks: {
        color: COLORS.tick,
        maxRotation: 0,
        font: { size: 11, weight: 500 as const },
      },
      grid: { color: COLORS.grid, drawBorder: false },
      border: { display: false },
    },
    y: {
      ticks: {
        color: COLORS.tick,
        font: { size: 11, weight: 500 as const },
        callback: (v: string | number) => `R${Number(v).toLocaleString('en-ZA')}`,
      },
      grid: { color: COLORS.grid, drawBorder: false },
      border: { display: false },
    },
  },
};

export function EarningsTrendChart({
  labels,
  projected,
  earned,
}: {
  labels: string[];
  projected: number[];
  earned: number[];
}) {
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: 'Projected commission',
            data: projected,
            borderColor: COLORS.projectedLine,
            backgroundColor: COLORS.projectedFill,
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: COLORS.projectedLine,
            pointBorderColor: '#0f172a',
            pointBorderWidth: 2,
          },
          {
            label: 'Earned (paid deals)',
            data: earned,
            borderColor: COLORS.earnedLine,
            backgroundColor: COLORS.earnedFill,
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: COLORS.earnedLine,
            pointBorderColor: '#0f172a',
            pointBorderWidth: 2,
          },
        ],
      }}
      options={baseOptions}
    />
  );
}

export function ForecastBarChart({
  labels,
  amounts,
  commissions,
}: {
  labels: string[];
  amounts: number[];
  commissions: number[];
}) {
  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: 'Weighted pipeline',
            data: amounts,
            backgroundColor: COLORS.pipelineBar,
            hoverBackgroundColor: '#7dd3fc',
            borderRadius: 10,
            borderSkipped: false,
            maxBarThickness: 28,
          },
          {
            label: 'Est. commission',
            data: commissions,
            backgroundColor: COLORS.commissionBar,
            hoverBackgroundColor: '#fdba74',
            borderRadius: 10,
            borderSkipped: false,
            maxBarThickness: 28,
          },
        ],
      }}
      options={{
        ...baseOptions,
        scales: {
          ...baseOptions.scales,
          x: {
            ...baseOptions.scales.x,
            ticks: {
              ...baseOptions.scales.x.ticks,
              maxRotation: 40,
              minRotation: 0,
            },
            grid: { display: false },
          },
        },
      }}
    />
  );
}
