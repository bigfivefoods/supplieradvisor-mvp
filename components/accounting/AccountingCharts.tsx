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
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { formatMoney } from '@/lib/accounting/types';

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

const C = {
  cyan: '#00b4d8',
  cyanDeep: '#0077b6',
  cyanSoft: 'rgba(0, 180, 216, 0.18)',
  emerald: '#059669',
  emeraldSoft: 'rgba(16, 185, 129, 0.16)',
  amber: '#d97706',
  amberSoft: 'rgba(245, 158, 11, 0.18)',
  violet: '#7c3aed',
  violetSoft: 'rgba(124, 58, 237, 0.14)',
  rose: '#e11d48',
  roseSoft: 'rgba(225, 29, 72, 0.14)',
  slate: '#64748b',
  slateSoft: 'rgba(100, 116, 139, 0.14)',
  grid: 'rgba(148, 163, 184, 0.22)',
  tick: '#64748b',
  legend: '#0f172a',
  white: '#ffffff',
  border: 'rgba(0, 180, 216, 0.4)',
};

function moneyTick(v: string | number) {
  const n = Number(v);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}R${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${n < 0 ? '-' : ''}R${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `R${n.toLocaleString('en-ZA')}`;
}

function moneyLabel(ctx: { dataset: { label?: string }; parsed: { y?: number | null } | number | null }) {
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
      boxWidth: 12,
      boxHeight: 12,
      padding: 14,
      usePointStyle: true,
      pointStyle: 'circle' as const,
      font: { size: 11, weight: 600 as const },
    },
  },
  tooltip: {
    backgroundColor: C.white,
    titleColor: C.legend,
    bodyColor: C.legend,
    borderColor: C.border,
    borderWidth: 1,
    padding: 12,
    cornerRadius: 12,
    titleFont: { size: 12, weight: 700 as const },
    bodyFont: { size: 12 },
    displayColors: true,
    callbacks: { label: moneyLabel },
  },
};

const cartesianScales = {
  x: {
    ticks: { color: C.tick, maxRotation: 0, font: { size: 10, weight: 500 as const } },
    grid: { color: C.grid, drawBorder: false },
    border: { display: false },
  },
  y: {
    ticks: {
      color: C.tick,
      font: { size: 10, weight: 500 as const },
      callback: moneyTick,
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
  height = 280,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={`rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm ${className}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black tracking-tight text-slate-900">{title}</div>
          {subtitle && (
            <div className="mt-0.5 text-[11px] text-slate-500 leading-snug">{subtitle}</div>
          )}
        </div>
      </div>
      <div style={{ height }} className="relative w-full">
        {children}
      </div>
    </div>
  );
}

export function EmptyChartState({ message = 'Post journals to populate this chart' }: { message?: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 text-center px-4">
      <p className="text-xs text-slate-500 max-w-xs">{message}</p>
    </div>
  );
}

/** Revenue vs expenses vs net — multi-month line */
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
  const hasData = [...revenue, ...expenses, ...netIncome].some((v) => Math.abs(v) > 0.001);
  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Revenue',
        data: revenue,
        borderColor: C.emerald,
        backgroundColor: C.emeraldSoft,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2.5,
      },
      {
        label: 'Expenses',
        data: expenses,
        borderColor: C.rose,
        backgroundColor: 'transparent',
        tension: 0.35,
        pointRadius: 3,
        borderWidth: 2,
        borderDash: [4, 3],
      },
      {
        label: 'Net income',
        data: netIncome,
        borderColor: C.cyanDeep,
        backgroundColor: C.cyanSoft,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        borderWidth: 2.5,
      },
    ],
  };

  return (
    <div className="relative h-full w-full">
      {!hasData && <EmptyChartState />}
      <Line data={data} options={lineOptions} />
    </div>
  );
}

/** Stacked revenue / cogs / opex bars */
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
  const hasData = [...revenue, ...cogs, ...expenses].some((v) => Math.abs(v) > 0.001);
  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: 'Revenue',
        data: revenue,
        backgroundColor: C.emerald,
        borderRadius: 6,
        stack: 'pl',
        maxBarThickness: 28,
      },
      {
        label: 'COGS',
        data: cogs.map((v) => -Math.abs(v)),
        backgroundColor: C.amber,
        borderRadius: 6,
        stack: 'pl',
        maxBarThickness: 28,
      },
      {
        label: 'OpEx',
        data: expenses.map((v) => -Math.abs(v)),
        backgroundColor: C.rose,
        borderRadius: 6,
        stack: 'pl',
        maxBarThickness: 28,
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
      {!hasData && <EmptyChartState />}
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
  const hasData = [...inflow, ...outflow].some((v) => Math.abs(v) > 0.001);
  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        type: 'bar' as const,
        label: 'Inflow',
        data: inflow,
        backgroundColor: C.emerald,
        borderRadius: 8,
        maxBarThickness: 26,
        order: 2,
      },
      {
        type: 'bar' as const,
        label: 'Outflow',
        data: outflow.map((v) => -Math.abs(v)),
        backgroundColor: C.slate,
        borderRadius: 8,
        maxBarThickness: 26,
        order: 2,
      },
      ...(net
        ? [
            {
              type: 'line' as const,
              label: 'Net cash',
              data: net,
              borderColor: C.cyan,
              backgroundColor: C.cyanSoft,
              tension: 0.35,
              borderWidth: 2.5,
              pointRadius: 3,
              order: 1,
              yAxisID: 'y',
            },
          ]
        : []),
    ] as ChartData<'bar'>['datasets'],
  };

  // Use Line chart when net overlay needed — Chart.js mixed charts work with Bar as base in v4 with care.
  // Simpler: dual dataset bar only if no net, else line for all three.
  if (net) {
    const lineData: ChartData<'line'> = {
      labels,
      datasets: [
        {
          label: 'Inflow',
          data: inflow,
          borderColor: C.emerald,
          backgroundColor: C.emeraldSoft,
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2,
        },
        {
          label: 'Outflow',
          data: outflow,
          borderColor: C.slate,
          backgroundColor: C.slateSoft,
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2,
        },
        {
          label: 'Net',
          data: net,
          borderColor: C.cyanDeep,
          backgroundColor: 'transparent',
          tension: 0.3,
          borderWidth: 2.5,
          pointRadius: 3,
          borderDash: [5, 3],
        },
      ],
    };
    return (
      <div className="relative h-full w-full">
        {!hasData && <EmptyChartState message="Import bank lines or record payments for cash charts" />}
        <Line data={lineData} options={lineOptions} />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {!hasData && <EmptyChartState message="Import bank lines or record payments for cash charts" />}
      <Bar data={data} options={barOptions} />
    </div>
  );
}

export function AgingBarChart({
  buckets,
}: {
  buckets: { current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number };
}) {
  const labels = ['Current', '1–30', '31–60', '61–90', '90+'];
  const values = [buckets.current, buckets.d1_30, buckets.d31_60, buckets.d61_90, buckets.d90_plus];
  const colors = [C.emerald, C.cyan, C.amber, '#f97316', C.rose];
  const hasData = values.some((v) => v > 0);

  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: 'Balance',
        data: values,
        backgroundColor: colors,
        borderRadius: 10,
        maxBarThickness: 48,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    ...barOptions,
    indexAxis: 'y',
    plugins: {
      ...basePlugins,
      legend: { display: false },
    },
  };

  return (
    <div className="relative h-full w-full">
      {!hasData && <EmptyChartState message="No open balances in aging buckets" />}
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
  const palette = [C.cyan, C.emerald, C.violet, C.amber, C.rose, C.slate, C.cyanDeep];
  const filtered = segments.filter((s) => Math.abs(s.value) > 0.001);
  const hasData = filtered.length > 0;

  const data: ChartData<'doughnut'> = {
    labels: filtered.map((s) => s.label),
    datasets: [
      {
        data: filtered.map((s) => Math.abs(s.value)),
        backgroundColor: filtered.map((s, i) => s.color || palette[i % palette.length]),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 6,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      ...basePlugins,
      legend: {
        position: 'right',
        labels: {
          ...basePlugins.legend.labels,
          font: { size: 10, weight: 600 as const },
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
      {!hasData && <EmptyChartState />}
      <Doughnut data={data} options={options} />
      {hasData && centerValue && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pr-16 sm:pr-20">
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
        { label: 'Assets', value: Math.max(0, assets), color: C.cyan },
        { label: 'Liabilities', value: Math.max(0, liabilities), color: C.rose },
        { label: 'Equity', value: Math.max(0, equity), color: C.emerald },
      ]}
      centerLabel="Assets"
      centerValue={formatMoney(assets)}
    />
  );
}

/** Historical solid + forecast dashed with revenue confidence band */
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
  const hasData =
    revenue.some((v) => v != null && Math.abs(v) > 0.001) ||
    revenueForecast.some((v) => v != null && Math.abs(v) > 0.001);

  const data: ChartData<'line'> = {
    labels,
    datasets: [
      ...(revenueHigh && revenueLow
        ? [
            {
              label: 'Revenue band high',
              data: revenueHigh,
              borderColor: 'transparent',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              fill: '+1',
              pointRadius: 0,
              borderWidth: 0,
              tension: 0.3,
            },
            {
              label: 'Revenue band low',
              data: revenueLow,
              borderColor: 'transparent',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              fill: false,
              pointRadius: 0,
              borderWidth: 0,
              tension: 0.3,
            },
          ]
        : []),
      {
        label: 'Revenue (actual)',
        data: revenue,
        borderColor: C.emerald,
        backgroundColor: C.emeraldSoft,
        fill: false,
        tension: 0.35,
        pointRadius: 3,
        borderWidth: 2.5,
        spanGaps: false,
      },
      {
        label: 'Revenue (forecast)',
        data: revenueForecast,
        borderColor: C.emerald,
        backgroundColor: 'transparent',
        borderDash: [6, 4],
        tension: 0.35,
        pointRadius: 2,
        borderWidth: 2,
        spanGaps: false,
      },
      {
        label: 'Net (actual)',
        data: netIncome,
        borderColor: C.cyanDeep,
        backgroundColor: 'transparent',
        tension: 0.35,
        pointRadius: 3,
        borderWidth: 2.5,
        spanGaps: false,
      },
      {
        label: 'Net (forecast)',
        data: netForecast,
        borderColor: C.cyan,
        backgroundColor: 'transparent',
        borderDash: [6, 4],
        tension: 0.35,
        pointRadius: 2,
        borderWidth: 2,
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
      {!hasData && (
        <EmptyChartState message="Need posted monthly history to project 1–12 month forecasts" />
      )}
      {/* History / forecast divider hint */}
      {hasData && historyCount > 0 && historyCount < labels.length && (
        <div className="absolute right-2 top-0 z-10 rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
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
        backgroundColor: C.emerald,
        borderRadius: 8,
        maxBarThickness: 32,
      },
      {
        label: 'Expenses',
        data: horizons.map((h) => h.expenses),
        backgroundColor: C.rose,
        borderRadius: 8,
        maxBarThickness: 32,
      },
      {
        label: 'Net income',
        data: horizons.map((h) => h.netIncome),
        backgroundColor: C.cyanDeep,
        borderRadius: 8,
        maxBarThickness: 32,
      },
    ],
  };

  return (
    <div className="relative h-full w-full">
      <Bar data={data} options={barOptions} />
    </div>
  );
}

/** Single-period waterfall-style summary as horizontal bars */
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
  const colors = [C.emerald, C.amber, C.rose, netIncome >= 0 ? C.cyanDeep : C.rose];

  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: 'Amount',
        data: values,
        backgroundColor: colors,
        borderRadius: 10,
        maxBarThickness: 40,
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
