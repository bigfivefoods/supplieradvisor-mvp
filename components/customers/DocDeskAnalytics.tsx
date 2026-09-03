'use client';

import { Bar } from 'react-chartjs-2';
import {
  BarChart3,
  CalendarRange,
  Users,
} from 'lucide-react';
import PeriodSlicer, {
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import {
  C,
  ChartCard,
  MixDoughnut,
} from '@/components/accounting/AccountingCharts';
import { formatMoney } from '@/lib/customers/documents';
import {
  customerIdFromSeriesKey,
  docsDeskTotals,
  docsValueByCustomer,
  docsValueByTime,
} from '@/lib/customers/doc-desk-analytics';
import type { DocListGroupBy } from '@/lib/customers/doc-list-group';
import type { GroupableDoc } from '@/lib/customers/doc-list-group';

function chipClass(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs font-black tracking-wide transition-colors ${
    active
      ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm'
      : 'border-slate-200 bg-white text-slate-600 hover:border-[#00b4d8]/50 hover:text-[#0077b6]'
  }`;
}

export default function DocDeskAnalytics({
  noun,
  period,
  onPeriod,
  docs,
  groupBy,
  onGroupBy,
  statusFilter,
  onStatus,
  statuses,
  customerId,
  onCustomer,
  customers,
  listDocs,
  timeKey,
  onTimeKey,
}: {
  noun: string;
  period: PeriodSlicerValue;
  onPeriod: (next: PeriodSlicerValue) => void;
  docs: GroupableDoc[];
  groupBy: DocListGroupBy;
  onGroupBy: (next: DocListGroupBy) => void;
  statusFilter: string;
  onStatus: (next: string) => void;
  statuses: string[];
  customerId: string;
  onCustomer: (next: string) => void;
  customers: Array<{ id: string; name: string }>;
  listDocs?: GroupableDoc[];
  timeKey?: string | null;
  onTimeKey?: (key: string | null) => void;
}) {
  const chartDocs = docs;
  const shown = listDocs || docs;
  const totals = docsDeskTotals(shown);
  const byTime = docsValueByTime(chartDocs, period.from, period.to);
  const byCustomer = docsValueByCustomer(chartDocs, 7);
  const topCustomers = customers.slice(0, 8);
  const activeTime = timeKey || null;
  const activeCustIdx = byCustomer.findIndex((p) => {
    const id = customerIdFromSeriesKey(p.key);
    return id != null && id === customerId;
  });
  const drilled = Boolean(activeTime) || (customerId && customerId !== 'all');

  const clickTime = (key: string) => {
    if (!onTimeKey) return;
    const next = activeTime === key ? null : key;
    onTimeKey(next);
    if (next) onGroupBy('date');
  };

  const clickCustomer = (key: string) => {
    const id = customerIdFromSeriesKey(key);
    if (!id) return;
    const next = customerId === id ? 'all' : id;
    onCustomer(next);
    if (next !== 'all') onGroupBy('customer');
  };

  return (
    <div className="space-y-4 mb-5">
      <PeriodSlicer
        value={period}
        onChange={onPeriod}
        defaultOpen={false}
        className="mb-0"
      />

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            {noun} in period
          </div>
          <div className="mt-0.5 text-2xl font-black tabular-nums text-slate-900">
            {totals.count}
          </div>
          <div className="text-[11px] text-slate-500">{period.label}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:col-span-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Value
          </div>
          <div className="mt-0.5 text-2xl font-black tabular-nums text-slate-900">
            {formatMoney(totals.amount, totals.currency)}
          </div>
          <div className="text-[11px] text-slate-500">
            {drilled
              ? 'Filtered from the graph — click the same slice again to clear'
              : `Sliced ${period.from} → ${period.to} · click a bar or slice to filter the list`}
          </div>
        </div>
      </div>
      {drilled ? (
        <button
          type="button"
          className="text-xs font-black text-[#0077b6] underline"
          onClick={() => {
            onCustomer('all');
            onTimeKey?.(null);
          }}
        >
          Clear graph filter
        </button>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard
          title={`${noun} by date`}
          subtitle={period.label}
          height={220}
          icon={BarChart3}
        >
          {byTime.length ? (
            <Bar
              data={{
                labels: byTime.map((p) => p.label),
                datasets: [
                  {
                    label: 'Value',
                    data: byTime.map((p) => p.amount),
                    backgroundColor: byTime.map((p) =>
                      activeTime === p.key ? C.revenue : C.revenueSoft
                    ),
                    borderColor: C.revenue,
                    borderWidth: 1.5,
                    borderRadius: 10,
                    maxBarThickness: 36,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                onHover: (evt, els) => {
                  const t = evt.native?.target as HTMLElement | undefined;
                  if (t) t.style.cursor = els.length ? 'pointer' : 'default';
                },
                onClick: (_evt, els) => {
                  if (!els.length) return;
                  const p = byTime[els[0].index];
                  if (p) clickTime(p.key);
                },
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false }, ticks: { maxRotation: 0, font: { size: 10 } } },
                  y: { grid: { color: C.grid }, ticks: { font: { size: 10 } } },
                },
              }}
            />
          ) : (
            <p className="text-xs text-slate-500 py-10 text-center">
              No {noun.toLowerCase()} in this period.
            </p>
          )}
        </ChartCard>
        <ChartCard
          title="By customer"
          subtitle="Share of value in this slice"
          height={220}
          icon={Users}
        >
          <MixDoughnut
            segments={byCustomer.map((p) => ({
              label: p.label,
              value: p.amount,
            }))}
            centerLabel={noun}
            centerValue={String(totals.count)}
            emptyMessage={`No ${noun.toLowerCase()} to chart`}
            activeIndex={activeCustIdx >= 0 ? activeCustIdx : null}
            onSegmentClick={(i) => {
              const p = byCustomer[i];
              if (p) clickCustomer(p.key);
            }}
          />
        </ChartCard>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
            List
          </span>
          {(
            [
              ['none', 'List'],
              ['date', 'By date'],
              ['customer', 'By customer'],
            ] as Array<[DocListGroupBy, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onGroupBy(id)}
              className={chipClass(groupBy === id)}
            >
              {id === 'date' ? (
                <CalendarRange className="inline w-3 h-3 mr-1 -mt-0.5" />
              ) : null}
              {id === 'customer' ? (
                <Users className="inline w-3 h-3 mr-1 -mt-0.5" />
              ) : null}
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
            Status
          </span>
          <button
            type="button"
            onClick={() => onStatus('all')}
            className={chipClass(statusFilter === 'all')}
          >
            All
          </button>
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStatus(s)}
              className={chipClass(statusFilter === s)}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
            Customer
          </span>
          <button
            type="button"
            onClick={() => onCustomer('all')}
            className={chipClass(customerId === 'all')}
          >
            All customers
          </button>
          {topCustomers.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onCustomer(c.id)}
              className={chipClass(customerId === c.id)}
              title={c.name}
            >
              {c.name.length > 22 ? `${c.name.slice(0, 20)}…` : c.name}
            </button>
          ))}
          {customers.length > topCustomers.length ? (
            <select
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600"
              value={
                topCustomers.some((c) => c.id === customerId) ||
                customerId === 'all'
                  ? ''
                  : customerId
              }
              onChange={(e) =>
                onCustomer(e.target.value || 'all')
              }
            >
              <option value="">More…</option>
              {customers.slice(8).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>
    </div>
  );
}
