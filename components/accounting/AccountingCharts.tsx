'use client';

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
  type ChartOptions,
  type ChartData,
  type ScriptableContext,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import type { LucideIcon } from 'lucide-react';
import { formatMoney } from '@/lib/accounting/types';
import type { RatioCard, RatioTone } from '@/lib/accounting/ratios';

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

/**
 * Lucid financial palette — soft, high-contrast on white (board-ready).
 * Avoid muddy greys; keep series clearly separable.
 */
export const C = {
  // Series
  revenue: '#0d9488', // teal-600
  revenueSoft: 'rgba(13, 148, 136, 0.14)',
  revenueLine: '#0f766e',
  cogs: '#f59e0b', // amber-500
  cogsSoft: 'rgba(245, 158, 11, 0.16)',
  opex: '#f43f5e', // rose-500
  opexSoft: 'rgba(244, 63, 94, 0.12)',
  net: '#0284c7', // sky-600
  netSoft: 'rgba(2, 132, 199, 0.14)',
  netLine: '#0369a1',
  cashIn: '#10b981', // emerald-500
  cashOut: '#64748b', // slate-500
  cashNet: '#8b5cf6', // violet-500
  pipeline: '#a855f7',
  pipelineW: '#6366f1',
  forecast: '#38bdf8',
  band: 'rgba(45, 212, 191, 0.12)',
  // Structure
  assets: '#06b6d4',
  liabilities: '#fb7185',
  equity: '#34d399',
  // Chrome
  grid: 'rgba(226, 232, 240, 0.9)',
  tick: '#64748b',
  legend: '#0f172a',
  white: '#ffffff',
  border: 'rgba(14, 165, 233, 0.35)',
  muted: '#94a3b8',
};

const AGING_COLORS = ['#34d399', '#2dd4bf', '#38bdf8', '#fbbf24', '#fb7185'];

function moneyTick(v: string | number) {
  const n = Number(v);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}R${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}R${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `R${n.toLocaleString('en-ZA')}`;
}

function moneyLabel(ctx: {
  dataset: { label?: string };
  parsed: { y?: number | null } | number | null;
}) {
  const raw =
    typeof ctx.parsed === 'number'
      ? ctx.parsed
      : ctx.parsed && typeof ctx.parsed === 'object'
        ? ctx.parsed.y
        : null;
  if (raw == null) return '';
  return `${ctx.dataset.label || ''}: ${formatMoney(Number(raw))}`;
}

const basePlugins = {
  legend: {
    position: 'top' as const,
    align: 'end' as const,
    labels: {
      color: C.legend,
      boxWidth: 10,
      boxHeight: 10,
      padding: 16,
      usePointStyle: true,
      pointStyle: 'circle' as const,
      font: { size: 11, weight: 600 as const, family: 'system-ui, sans-serif' },
    },
  },
  tooltip: {
    backgroundColor: C.white,
    titleColor: C.legend,
    bodyColor: '#334155',
    borderColor: C.border,
    borderWidth: 1,
    padding: 14,
    cornerRadius: 14,
    titleFont: { size: 12, weight: 700 as const },
    bodyFont: { size: 12 },
    displayColors: true,
    boxPadding: 4,
    callbacks: { label: moneyLabel },
  },
};

const cartesianScales = {
  x: {
    ticks: {
      color: C.tick,
      maxRotation: 0,
      font: { size: 11, weight: 500 as const },
    },
    grid: { color: 'transparent', drawBorder: false },
    border: { display: false },
  },
  y: {
    ticks: {
      color: C.tick,
      font: { size: 11, weight: 500 as const },
      callback: moneyTick,
      padding: 8,
    },
    grid: { color: C.grid, drawBorder: false },
    border: { display: false },
  },
};

const lineOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: basePlugins,
  scales: cartesianScales,
  elements: {
    line: { tension: 0.35, borderWidth: 2.5, borderCapStyle: 'round' as const },
    point: { radius: 0, hoverRadius: 5, hitRadius: 12 },
  },
};

const barOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: basePlugins,
  scales: cartesianScales,
};

export function ChartCard({
  title,
  subtitle,
  children,
  className = '',
  height = 300,
  icon: Icon,
  badge,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  height?: number;
  icon?: LucideIcon;
  badge?: string;
}) {
  return (
    <div
      className={`rounded-[1.35rem] border border-slate-200/90 bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${className}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-2.5">
          {Icon && (
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#0284c7] border border-sky-100">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <div className="text-sm font-black tracking-tight text-slate-900">{title}</div>
            {subtitle && (
              <div className="mt-0.5 text-[11px] text-slate-500 leading-snug">{subtitle}</div>
            )}
          </div>
        </div>
        {badge && (
          <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
            {badge}
          </span>
        )}
      </div>
      <div style={{ height }} className="relative w-full">
        {children}
      </div>
    </div>
  );
}

export function EmptyChartState({
  message = 'Post journals to populate this chart',
}: {
  message?: string;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50/90 to-white text-center px-4">
      <p className="text-xs text-slate-500 max-w-xs leading-relaxed">{message}</p>
    </div>
  );
}

function hasSignal(arr: Array<number | null | undefined>) {
  return arr.some((v) => v != null && Math.abs(Number(v)) > 0.001);
}

/** Revenue / expenses / net — lucid multi-line */
export function PnlTrendChart({
  labels,
  revenue,
  expenses,
  netIncome,
}: {
  labels: string[];
  revenue: number[];
  expenses: number[];
  netIncome: number[];
}) {
  const ok = hasSignal([...revenue, ...expenses, ...netIncome]);
  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Revenue',
        data: revenue,
        borderColor: C.revenueLine,
        backgroundColor: (ctx: ScriptableContext<'line'>) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return C.revenueSoft;
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, 'rgba(13, 148, 136, 0.22)');
          g.addColorStop(1, 'rgba(13, 148, 136, 0.02)');
          return g;
        },
        fill: true,
        pointHoverBackgroundColor: C.revenue,
      },
      {
        label: 'Expenses',
        data: expenses,
        borderColor: C.opex,
        backgroundColor: 'transparent',
        borderDash: [5, 4],
        pointHoverBackgroundColor: C.opex,
      },
      {
        label: 'Net income',
        data: netIncome,
        borderColor: C.netLine,
        backgroundColor: C.netSoft,
        fill: true,
        pointHoverBackgroundColor: C.net,
      },
    ],
  };

  return (
    <div className="relative h-full w-full">
      {!ok && <EmptyChartState />}
      <Line data={data} options={lineOptions} />
    </div>
  );
}

/** Stacked P&L composition */
export function PnlStackChart({
  labels,
  revenue,
  cogs,
  expenses,
}: {
  labels: string[];
  revenue: number[];
  cogs: number[];
  expenses: number[];
}) {
  const ok = hasSignal([...revenue, ...cogs, ...expenses]);
  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: 'Revenue',
        data: revenue,
        backgroundColor: C.revenue,
        borderRadius: 8,
        stack: 'pl',
        maxBarThickness: 32,
      },
      {
        label: 'COGS',
        data: cogs.map((v) => -Math.abs(v)),
        backgroundColor: C.cogs,
        borderRadius: 8,
        stack: 'pl',
        maxBarThickness: 32,
      },
      {
        label: 'OpEx',
        data: expenses.map((v) => -Math.abs(v)),
        backgroundColor: C.opex,
        borderRadius: 8,
        stack: 'pl',
        maxBarThickness: 32,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    ...barOptions,
    scales: {
      ...cartesianScales,
      x: { ...cartesianScales.x, stacked: true },
      y: { ...cartesianScales.y, stacked: true },
    },
  };

  return (
    <div className="relative h-full w-full">
      {!ok && <EmptyChartState />}
      <Bar data={data} options={options} />
    </div>
  );
}

export function CashflowChart({
  labels,
  inflow,
  outflow,
  net,
}: {
  labels: string[];
  inflow: number[];
  outflow: number[];
  net?: number[];
}) {
  const ok = hasSignal([...inflow, ...outflow]);

  if (net) {
    const lineData: ChartData<'line'> = {
      labels,
      datasets: [
        {
          label: 'Inflow',
          data: inflow,
          borderColor: C.cashIn,
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          fill: true,
        },
        {
          label: 'Outflow',
          data: outflow,
          borderColor: C.cashOut,
          backgroundColor: 'rgba(100, 116, 139, 0.1)',
          fill: true,
        },
        {
          label: 'Net cash',
          data: net,
          borderColor: C.cashNet,
          backgroundColor: 'transparent',
          borderDash: [6, 3],
          borderWidth: 2.5,
        },
      ],
    };
    return (
      <div className="relative h-full w-full">
        {!ok && (
          <EmptyChartState message="Import bank lines or record payments for cash charts" />
        )}
        <Line data={lineData} options={lineOptions} />
      </div>
    );
  }

  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: 'Inflow',
        data: inflow,
        backgroundColor: C.cashIn,
        borderRadius: 8,
        maxBarThickness: 28,
      },
      {
        label: 'Outflow',
        data: outflow.map((v) => -Math.abs(v)),
        backgroundColor: C.cashOut,
        borderRadius: 8,
        maxBarThickness: 28,
      },
    ],
  };

  return (
    <div className="relative h-full w-full">
      {!ok && (
        <EmptyChartState message="Import bank lines or record payments for cash charts" />
      )}
      <Bar data={data} options={barOptions} />
    </div>
  );
}

export function AgingBarChart({
  buckets,
}: {
  buckets: {
    current: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    d90_plus: number;
  };
}) {
  const labels = ['Current', '1–30', '31–60', '61–90', '90+'];
  const values = [
    buckets.current,
    buckets.d1_30,
    buckets.d31_60,
    buckets.d61_90,
    buckets.d90_plus,
  ];
  const ok = values.some((v) => v > 0);

  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: 'Balance',
        data: values,
        backgroundColor: AGING_COLORS,
        borderRadius: 12,
        maxBarThickness: 44,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    ...barOptions,
    indexAxis: 'y',
    plugins: { ...basePlugins, legend: { display: false } },
  };

  return (
    <div className="relative h-full w-full">
      {!ok && <EmptyChartState message="No open balances in aging buckets" />}
      <Bar data={data} options={options} />
    </div>
  );
}

export function MixDoughnut({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: Array<{ label: string; value: number; color?: string }>;
  centerLabel?: string;
  centerValue?: string;
}) {
  const palette = [
    C.revenue,
    C.net,
    C.cashNet,
    C.cogs,
    C.opex,
    C.cashIn,
    '#38bdf8',
    '#a78bfa',
  ];
  const filtered = segments.filter((s) => Math.abs(s.value) > 0.001);
  const ok = filtered.length > 0;

  const data: ChartData<'doughnut'> = {
    labels: filtered.map((s) => s.label),
    datasets: [
      {
        data: filtered.map((s) => Math.abs(s.value)),
        backgroundColor: filtered.map((s, i) => s.color || palette[i % palette.length]),
        borderWidth: 3,
        borderColor: '#fff',
        hoverOffset: 8,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      ...basePlugins,
      legend: {
        position: 'right',
        labels: {
          ...basePlugins.legend.labels,
          font: { size: 10, weight: 600 as const },
          padding: 10,
        },
      },
      tooltip: {
        ...basePlugins.tooltip,
        callbacks: {
          label: (ctx) => {
            const v = Number(ctx.parsed || 0);
            const total = filtered.reduce((s, x) => s + Math.abs(x.value), 0) || 1;
            return `${ctx.label}: ${formatMoney(v)} (${((v / total) * 100).toFixed(0)}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="relative h-full w-full">
      {!ok && <EmptyChartState />}
      <Doughnut data={data} options={options} />
      {ok && centerValue && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pr-14 sm:pr-20">
          <div className="text-center">
            {centerLabel && (
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                {centerLabel}
              </div>
            )}
            <div className="text-sm font-black tabular-nums text-slate-900 sm:text-base">
              {centerValue}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function BalanceCompositionChart({
  assets,
  liabilities,
  equity,
}: {
  assets: number;
  liabilities: number;
  equity: number;
}) {
  return (
    <MixDoughnut
      segments={[
        { label: 'Assets', value: Math.max(0, assets), color: C.assets },
        { label: 'Liabilities', value: Math.max(0, liabilities), color: C.liabilities },
        { label: 'Equity', value: Math.max(0, equity), color: C.equity },
      ]}
      centerLabel="Assets"
      centerValue={formatMoney(assets)}
    />
  );
}

export function ForecastLineChart({
  labels,
  historyCount,
  revenue,
  revenueForecast,
  netIncome,
  netForecast,
  revenueLow,
  revenueHigh,
}: {
  labels: string[];
  historyCount: number;
  revenue: Array<number | null>;
  revenueForecast: Array<number | null>;
  netIncome: Array<number | null>;
  netForecast: Array<number | null>;
  revenueLow?: Array<number | null>;
  revenueHigh?: Array<number | null>;
}) {
  const ok =
    hasSignal(revenue as number[]) || hasSignal(revenueForecast as number[]);

  const data: ChartData<'line'> = {
    labels,
    datasets: [
      ...(revenueHigh && revenueLow
        ? [
            {
              label: 'Revenue band high',
              data: revenueHigh,
              borderColor: 'transparent',
              backgroundColor: C.band,
              fill: '+1' as const,
              pointRadius: 0,
              borderWidth: 0,
              tension: 0.35,
            },
            {
              label: 'Revenue band low',
              data: revenueLow,
              borderColor: 'transparent',
              backgroundColor: C.band,
              fill: false as const,
              pointRadius: 0,
              borderWidth: 0,
              tension: 0.35,
            },
          ]
        : []),
      {
        label: 'Revenue (actual)',
        data: revenue,
        borderColor: C.revenueLine,
        backgroundColor: 'transparent',
        spanGaps: false,
      },
      {
        label: 'Revenue (forecast)',
        data: revenueForecast,
        borderColor: C.revenue,
        borderDash: [7, 4],
        backgroundColor: 'transparent',
        spanGaps: false,
      },
      {
        label: 'Net (actual)',
        data: netIncome,
        borderColor: C.netLine,
        backgroundColor: 'transparent',
        spanGaps: false,
      },
      {
        label: 'Net (forecast)',
        data: netForecast,
        borderColor: C.forecast,
        borderDash: [7, 4],
        backgroundColor: 'transparent',
        spanGaps: false,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    ...lineOptions,
    plugins: {
      ...basePlugins,
      legend: {
        ...basePlugins.legend,
        labels: {
          ...basePlugins.legend.labels,
          filter: (item) => !String(item.text).includes('band'),
        },
      },
    },
  };

  return (
    <div className="relative h-full w-full">
      {!ok && (
        <EmptyChartState message="Need posted monthly history to project forecasts" />
      )}
      {ok && historyCount > 0 && historyCount < labels.length && (
        <div className="absolute right-2 top-0 z-10 rounded-full bg-sky-50 border border-sky-100 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-700">
          Forecast →
        </div>
      )}
      <Line data={data} options={options} />
    </div>
  );
}

export function HorizonBarsChart({
  horizons,
}: {
  horizons: Array<{
    months: number;
    revenue: number;
    expenses: number;
    netIncome: number;
  }>;
}) {
  const labels = horizons.map((h) => `${h.months}m`);
  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: 'Revenue',
        data: horizons.map((h) => h.revenue),
        backgroundColor: C.revenue,
        borderRadius: 10,
        maxBarThickness: 36,
      },
      {
        label: 'Expenses',
        data: horizons.map((h) => h.expenses),
        backgroundColor: C.opex,
        borderRadius: 10,
        maxBarThickness: 36,
      },
      {
        label: 'Net income',
        data: horizons.map((h) => h.netIncome),
        backgroundColor: C.net,
        borderRadius: 10,
        maxBarThickness: 36,
      },
    ],
  };

  return (
    <div className="relative h-full w-full">
      <Bar data={data} options={barOptions} />
    </div>
  );
}

/** Horizontal bridge: Revenue → COGS → OpEx → Net */
export function PeriodWaterfall({
  revenue,
  cogs,
  expenses,
  netIncome,
}: {
  revenue: number;
  cogs: number;
  expenses: number;
  netIncome: number;
}) {
  const labels = ['Revenue', 'COGS', 'OpEx', 'Net'];
  const values = [revenue, -Math.abs(cogs), -Math.abs(expenses), netIncome];
  const colors = [
    C.revenue,
    C.cogs,
    C.opex,
    netIncome >= 0 ? C.net : C.opex,
  ];

  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: 'Amount',
        data: values,
        backgroundColor: colors,
        borderRadius: 12,
        maxBarThickness: 48,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    ...barOptions,
    indexAxis: 'y',
    plugins: { ...basePlugins, legend: { display: false } },
  };

  return <Bar data={data} options={options} />;
}

/** Gross / net margin % trend */
export function MarginTrendChart({
  labels,
  grossMargin,
  netMargin,
}: {
  labels: string[];
  grossMargin: number[];
  netMargin: number[];
}) {
  const ok = hasSignal([...grossMargin, ...netMargin]);
  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Gross margin %',
        data: grossMargin,
        borderColor: C.revenueLine,
        backgroundColor: C.revenueSoft,
        fill: true,
      },
      {
        label: 'Net margin %',
        data: netMargin,
        borderColor: C.netLine,
        backgroundColor: 'transparent',
        borderDash: [4, 3],
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    ...lineOptions,
    scales: {
      ...cartesianScales,
      y: {
        ...cartesianScales.y,
        ticks: {
          ...cartesianScales.y.ticks,
          callback: (v) => `${v}%`,
        },
      },
    },
    plugins: {
      ...basePlugins,
      tooltip: {
        ...basePlugins.tooltip,
        callbacks: {
          label: (ctx) =>
            `${ctx.dataset.label}: ${Number(ctx.parsed.y ?? 0).toFixed(1)}%`,
        },
      },
    },
  };

  return (
    <div className="relative h-full w-full">
      {!ok && <EmptyChartState message="Need revenue history for margin trends" />}
      <Line data={data} options={options} />
    </div>
  );
}

function toneStyles(tone: RatioTone) {
  switch (tone) {
    case 'good':
      return 'border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-white';
    case 'warn':
      return 'border-amber-100 bg-gradient-to-br from-amber-50/80 to-white';
    case 'bad':
      return 'border-rose-100 bg-gradient-to-br from-rose-50/70 to-white';
    default:
      return 'border-slate-200/90 bg-white';
  }
}

function toneValue(tone: RatioTone) {
  switch (tone) {
    case 'good':
      return 'text-emerald-700';
    case 'warn':
      return 'text-amber-700';
    case 'bad':
      return 'text-rose-600';
    default:
      return 'text-slate-900';
  }
}

/** Board-style ratio cards */
export function RatioGrid({
  ratios,
  title = 'Key accounting ratios',
  subtitle,
}: {
  ratios: RatioCard[];
  title?: string;
  subtitle?: string;
}) {
  if (!ratios.length) return null;
  return (
    <div className="mb-6">
      <div className="mb-3">
        <h3 className="text-sm font-black tracking-tight text-slate-900">{title}</h3>
        {subtitle && (
          <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3">
        {ratios.map((r) => (
          <div
            key={r.id}
            className={`rounded-2xl border p-3.5 sm:p-4 shadow-sm ${toneStyles(r.tone)}`}
            title={r.hint}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              {r.label}
            </div>
            <div
              className={`text-xl sm:text-2xl font-black tabular-nums tracking-tight ${toneValue(r.tone)}`}
            >
              {r.value}
            </div>
            <div className="mt-1 text-[10px] text-slate-500 leading-snug line-clamp-2">
              {r.hint}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Simple horizontal % bar for a single ratio */
export function RatioBarChart({
  ratios,
}: {
  ratios: Array<{ label: string; value: number | null; max?: number }>;
}) {
  const labels = ratios.map((r) => r.label);
  const values = ratios.map((r) => (r.value == null ? 0 : r.value));
  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: '%',
        data: values,
        backgroundColor: values.map((v) =>
          v >= 15 ? C.revenue : v >= 5 ? C.cogs : C.opex
        ),
        borderRadius: 10,
        maxBarThickness: 36,
      },
    ],
  };
  const options: ChartOptions<'bar'> = {
    ...barOptions,
    indexAxis: 'y',
    plugins: {
      ...basePlugins,
      legend: { display: false },
      tooltip: {
        ...basePlugins.tooltip,
        callbacks: {
          label: (ctx) => `${Number(ctx.parsed.x ?? 0).toFixed(1)}%`,
        },
      },
    },
    scales: {
      ...cartesianScales,
      x: {
        ...cartesianScales.x,
        ticks: {
          ...cartesianScales.x.ticks,
          callback: (v) => `${v}%`,
        },
      },
    },
  };
  return <Bar data={data} options={options} />;
}
