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

const gridColor = 'rgba(148,163,184,0.12)';
const tickColor = '#94a3b8';

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
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
          },
          {
            label: 'Earned (paid deals)',
            data: earned,
            borderColor: '#34d399',
            backgroundColor: 'rgba(52,211,153,0.1)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: tickColor, boxWidth: 12, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: R${Number(ctx.parsed.y || 0).toLocaleString('en-ZA')}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: tickColor, maxRotation: 0 },
            grid: { color: gridColor },
          },
          y: {
            ticks: {
              color: tickColor,
              callback: (v) => `R${Number(v).toLocaleString('en-ZA')}`,
            },
            grid: { color: gridColor },
          },
        },
      }}
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
            backgroundColor: 'rgba(14,165,233,0.55)',
            borderRadius: 8,
          },
          {
            label: 'Est. commission',
            data: commissions,
            backgroundColor: 'rgba(249,115,22,0.7)',
            borderRadius: 8,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: tickColor, boxWidth: 12, font: { size: 11 } },
          },
        },
        scales: {
          x: {
            ticks: { color: tickColor, maxRotation: 45, minRotation: 0 },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: tickColor,
              callback: (v) => `R${Number(v).toLocaleString('en-ZA')}`,
            },
            grid: { color: gridColor },
          },
        },
      }}
    />
  );
}
