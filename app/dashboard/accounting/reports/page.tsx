'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  Info,
  Sparkles,
  CalendarRange,
  Briefcase,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { formatMoney } from '@/lib/accounting/types';
import {
  fiscalYearLabel,
  fiscalYearMonths,
  fiscalYearQuarters,
  resolvePeriodPreset,
  type PeriodPreset,
} from '@/lib/accounting/fiscal';
import { horizonsFromMax } from '@/lib/accounting/forecast';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';
import {
  AgingBarChart,
  BalanceCompositionChart,
  CashflowChart,
  ChartCard,
  ForecastLineChart,
  HorizonBarsChart,
  MixDoughnut,
  PeriodWaterfall,
  PnlStackChart,
  PnlTrendChart,
} from '@/components/accounting/AccountingCharts';

const REPORTS = [
  { id: 'forecast', label: 'Forecast', accent: true },
  { id: 'trends', label: 'Trends' },
  { id: 'pnl', label: 'Profit & loss' },
  { id: 'balance_sheet', label: 'Balance sheet' },
  { id: 'trial_balance', label: 'Trial balance' },
  { id: 'ar_aging', label: 'AR aging' },
  { id: 'ap_aging', label: 'AP aging' },
  { id: 'cashflow', label: 'Cash flow' },
  { id: 'management_accounts', label: 'Mgmt snapshot' },
] as const;

const HISTORY_OPTIONS = [3, 6, 12, 18, 24, 36] as const;
const HORIZON_PRESETS = [1, 3, 6, 9, 12, 18, 24] as const;

const INITIAL = resolvePeriodPreset('this_month');

type ViewMode = 'month' | 'quarter' | 'ytd' | 'trailing';

export default function ReportsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [report, setReport] = useState<string>('forecast');
  const [viewMode, setViewMode] = useState<ViewMode>('trailing');
  const [preset, setPreset] = useState<PeriodPreset>('this_month');
  const [from, setFrom] = useState(INITIAL.from);
  const [to, setTo] = useState(INITIAL.to);
  const [periodLabel, setPeriodLabel] = useState(INITIAL.label);
  const [historyMonths, setHistoryMonths] = useState(12);
  const [horizonMonths, setHorizonMonths] = useState(12);
  const [selectedHorizons, setSelectedHorizons] = useState<number[]>([1, 3, 6, 9, 12]);
  const [includePipeline, setIncludePipeline] = useState(true);
  const [customHorizon, setCustomHorizon] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const fyLabel = useMemo(() => fiscalYearLabel(new Date()), []);
  const fyMonths = useMemo(() => fiscalYearMonths(new Date()), []);
  const fyQuarters = useMemo(() => fiscalYearQuarters(new Date()), []);

  const applyPreset = useCallback((p: Exclude<PeriodPreset, 'custom'>) => {
    const range = resolvePeriodPreset(p);
    setPreset(range.preset);
    setFrom(range.from);
    setTo(range.to);
    setPeriodLabel(range.label);
  }, []);

  const applyCustomRange = useCallback((nextFrom: string, nextTo: string, label: string) => {
    setPreset('custom');
    setFrom(nextFrom);
    setTo(nextTo);
    setPeriodLabel(label);
  }, []);

  const toggleHorizon = (h: number) => {
    setSelectedHorizons((prev) => {
      const has = prev.includes(h);
      const next = has ? prev.filter((x) => x !== h) : [...prev, h].sort((a, b) => a - b);
      return next.length ? next : [h];
    });
    setHorizonMonths((prev) => Math.max(prev, h));
  };

  const applyMaxHorizon = (max: number) => {
    setHorizonMonths(max);
    setSelectedHorizons(horizonsFromMax(max));
  };

  const addCustomHorizon = () => {
    const n = Number(customHorizon);
    if (!Number.isFinite(n) || n < 1 || n > 36) {
      toast.error('Enter a horizon between 1 and 36 months');
      return;
    }
    const h = Math.round(n);
    setSelectedHorizons((prev) => Array.from(new Set([...prev, h])).sort((a, b) => a - b));
    setHorizonMonths((prev) => Math.max(prev, h));
    setCustomHorizon('');
  };

  const isSeriesReport = report === 'trends' || report === 'forecast';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        report,
      });
      if (privyUserId) params.set('privyUserId', privyUserId);

      if (isSeriesReport) {
        params.set('months', String(historyMonths));
        params.set('includePipeline', includePipeline ? '1' : '0');
        if (from) params.set('to', to || from); // anchor history end
        if (report === 'forecast') {
          params.set('horizons', selectedHorizons.join(','));
          params.set('horizonMonths', String(Math.max(...selectedHorizons, horizonMonths)));
        }
      } else if (report !== 'ar_aging' && report !== 'ap_aging') {
        if (from) params.set('from', from);
        if (to) params.set('to', to);
      }

      const res = await fetch(`/api/accounting/reports?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
      if (json.warning) toast.message(json.warning);
      if (json.pipeline?.warning) toast.message(`Pipeline: ${json.pipeline.warning}`);
    } catch (err) {
      setData(null);
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [
    companyId,
    privyUserId,
    report,
    from,
    to,
    historyMonths,
    horizonMonths,
    selectedHorizons,
    includePipeline,
    isSeriesReport,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeMonthKey = `${from}_${to}`;

  return (
    <AccountingPage>
      <AccountingHeader
        title="Reports &"
        titleAccent="analytics"
        description="Slice by month, quarter, or year · layer CRM pipeline sales · set forecast horizons (1–36 months)."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2.5 !px-5 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {REPORTS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setReport(r.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border transition-all ${
              report === r.id
                ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm shadow-cyan-500/20'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/40'
            }`}
          >
            {'accent' in r && r.accent && report !== r.id && (
              <Sparkles className="w-3 h-3 text-amber-500" />
            )}
            {r.label}
          </button>
        ))}
      </div>

      {/* ── Period & forecast controls ── */}
      <Panel className="mb-6">
        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <CalendarRange className="w-4 h-4 text-[#00b4d8]" />
              <span className="font-bold text-slate-900">
                {isSeriesReport ? `Trailing ${historyMonths} months` : periodLabel}
              </span>
              {!isSeriesReport && (
                <span className="text-xs text-neutral-400 tabular-nums">
                  {from} → {to}
                </span>
              )}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              FY {fyLabel} · Mar–Feb
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'trailing' as const, label: 'Trailing history', series: true },
                { id: 'month' as const, label: 'Month', series: false },
                { id: 'quarter' as const, label: 'Quarter', series: false },
                { id: 'ytd' as const, label: 'YTD / FY', series: false },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setViewMode(m.id);
                  if (m.id === 'month') applyPreset('this_month');
                  else if (m.id === 'quarter') applyPreset('this_quarter');
                  else if (m.id === 'ytd') applyPreset('ytd');
                }}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors ${
                  viewMode === m.id
                    ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {viewMode === 'trailing' && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                History window (months back)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {HISTORY_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setHistoryMonths(n)}
                    className={`min-w-[3rem] text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-colors ${
                      historyMonths === n
                        ? 'border-[#00b4d8] bg-[#00b4d8]/10 text-[#0077b6]'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/40'
                    }`}
                  >
                    {n}m
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-neutral-500">
                Used for <strong>Trends</strong> and <strong>Forecast</strong>. Statement reports
                use the month / quarter / YTD picker.
              </p>
            </div>
          )}

          {viewMode === 'month' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Chip active={preset === 'this_month'} onClick={() => applyPreset('this_month')} label="This month" />
                <Chip active={preset === 'last_month'} onClick={() => applyPreset('last_month')} label="Last month" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fyMonths.map((m) => {
                  const active = activeMonthKey === `${m.from}_${m.to}`;
                  return (
                    <button
                      key={m.from}
                      type="button"
                      onClick={() =>
                        applyCustomRange(
                          m.from,
                          m.to,
                          `${m.label} ${m.from.slice(0, 4)}`
                        )
                      }
                      className={`min-w-[3rem] text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-colors ${
                        active
                          ? 'border-[#00b4d8] bg-[#00b4d8]/10 text-[#0077b6]'
                          : m.isCurrent
                            ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/40'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === 'quarter' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Chip active={preset === 'this_quarter'} onClick={() => applyPreset('this_quarter')} label="This quarter" />
                <Chip active={preset === 'last_quarter'} onClick={() => applyPreset('last_quarter')} label="Last quarter" />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {fyQuarters.map((q) => {
                  const active = activeMonthKey === `${q.from}_${q.to}`;
                  return (
                    <button
                      key={q.quarter}
                      type="button"
                      onClick={() => applyCustomRange(q.from, q.to, `FY ${fyLabel} ${q.label}`)}
                      className={`text-left rounded-2xl border px-3 py-3 transition-colors ${
                        active
                          ? 'border-[#00b4d8] bg-[#00b4d8]/10 shadow-sm'
                          : q.isCurrent
                            ? 'border-emerald-200 bg-emerald-50/40'
                            : 'border-neutral-200 bg-white hover:border-[#00b4d8]/40'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900">{q.label}</div>
                      <div className="text-[10px] text-neutral-400 mt-1 tabular-nums">
                        {q.from} → {q.to}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === 'ytd' && (
            <div className="flex flex-wrap gap-2">
              <Chip active={preset === 'ytd'} onClick={() => applyPreset('ytd')} label="YTD (1 Mar → today)" />
              <Chip active={preset === 'full_fy'} onClick={() => applyPreset('full_fy')} label={`Full FY ${fyLabel}`} />
              <Chip
                active={periodLabel.startsWith('Full FY') && preset === 'custom'}
                onClick={() => {
                  const currentStart = resolvePeriodPreset('full_fy').from;
                  const [y, m, d] = currentStart.split('-').map(Number);
                  const lastDayPrior = new Date(y, m - 1, d);
                  lastDayPrior.setDate(lastDayPrior.getDate() - 1);
                  const prior = resolvePeriodPreset('full_fy', lastDayPrior);
                  applyCustomRange(prior.from, prior.to, prior.label);
                }}
                label="Prior FY"
              />
              <Chip
                active={periodLabel.startsWith('Calendar')}
                onClick={() => {
                  const y = new Date().getFullYear();
                  applyCustomRange(`${y}-01-01`, `${y}-12-31`, `Calendar ${y}`);
                }}
                label={`Calendar ${new Date().getFullYear()}`}
              />
            </div>
          )}

          {/* Custom dates always available for statement reports */}
          {!isSeriesReport && (
            <div className="flex flex-wrap gap-3 items-end pt-1 border-t border-neutral-100">
              <label className="text-xs font-semibold text-neutral-600">
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPreset('custom');
                    setPeriodLabel('Custom period');
                  }}
                  className="mt-1 block rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-neutral-600">
                To
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPreset('custom');
                    setPeriodLabel('Custom period');
                  }}
                  className="mt-1 block rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
          )}

          {/* Pipeline + forecast variables */}
          <div className="pt-3 border-t border-neutral-100 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includePipeline}
                  onChange={(e) => setIncludePipeline(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-[#00b4d8] focus:ring-[#00b4d8]"
                />
                <span className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-[#00b4d8]" />
                  Include pipeline sales (CRM opportunities)
                </span>
              </label>
              <Link
                href="/dashboard/customers/leads?tab=pipeline"
                className="text-[11px] font-semibold text-[#00b4d8] hover:underline"
              >
                Open sales pipeline →
              </Link>
            </div>

            {report === 'forecast' && (
              <div className="space-y-3 rounded-2xl border border-cyan-100 bg-sky-50/40 p-3 sm:p-4">
                <div className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
                  Forecast variables
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                    Months ahead (max horizon)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {HORIZON_PRESETS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => applyMaxHorizon(n)}
                        className={`min-w-[3rem] text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-colors ${
                          horizonMonths === n && selectedHorizons[selectedHorizons.length - 1] === n
                            ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/40'
                        }`}
                      >
                        {n}m
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                    Milestone cards (toggle any combination)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {HORIZON_PRESETS.map((n) => {
                      const on = selectedHorizons.includes(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => toggleHorizon(n)}
                          className={`min-w-[2.75rem] text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                            on
                              ? 'border-[#00b4d8] bg-[#00b4d8]/15 text-[#0077b6]'
                              : 'border-neutral-200 bg-white text-neutral-500'
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs font-semibold text-neutral-600">
                    Custom months ahead
                    <input
                      type="number"
                      min={1}
                      max={36}
                      value={customHorizon}
                      onChange={(e) => setCustomHorizon(e.target.value)}
                      placeholder="e.g. 15"
                      className="mt-1 block w-28 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={addCustomHorizon}
                    className="text-xs font-semibold rounded-full border border-[#00b4d8] text-[#0077b6] px-3 py-2 hover:bg-[#00b4d8]/10"
                  >
                    Add horizon
                  </button>
                  <span className="text-[11px] text-neutral-500 pb-2">
                    Active: {selectedHorizons.join(' · ')} months
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Panel>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <ReportBody report={report} data={data} includePipeline={includePipeline} />
      )}
    </AccountingPage>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
          : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/50'
      }`}
    >
      {label}
    </button>
  );
}

function ReportBody({
  report,
  data,
  includePipeline,
}: {
  report: string;
  data: Record<string, unknown> | null;
  includePipeline: boolean;
}) {
  if (!data) {
    return (
      <Panel>
        <div className="px-6 py-12 text-center text-sm text-neutral-500">No data</div>
      </Panel>
    );
  }

  if (report === 'forecast') {
    return <ForecastReport data={data} includePipeline={includePipeline} />;
  }

  if (report === 'trends') {
    return <TrendsReport data={data} includePipeline={includePipeline} />;
  }

  if (report === 'management_accounts') {
    return <MgmtSnapshot data={data} />;
  }

  if (report === 'trial_balance') {
    const rows = (data.rows as Array<Record<string, unknown>>) || [];
    const totals = data.totals as { debit: number; credit: number; balanced: boolean } | undefined;
    const topDebit = [...rows]
      .sort((a, b) => Number(b.debit) - Number(a.debit))
      .slice(0, 8);
    return (
      <>
        {totals && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <SumCard label="Total debits" value={formatMoney(totals.debit)} />
            <SumCard label="Total credits" value={formatMoney(totals.credit)} />
            <SumCard
              label="Balanced"
              value={totals.balanced ? 'Yes' : 'No'}
              tone={totals.balanced ? 'emerald' : 'amber'}
            />
          </div>
        )}
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <ChartCard title="Largest debit balances" subtitle="Top accounts by debit total">
            <MixDoughnut
              segments={topDebit.map((r) => ({
                label: String(r.code),
                value: Number(r.debit),
              }))}
              centerLabel="Debits"
              centerValue={formatMoney(totals?.debit || 0)}
            />
          </ChartCard>
          <ChartCard title="Debit vs credit" subtitle="Equation check" height={280}>
            <PeriodWaterfall
              revenue={totals?.debit || 0}
              cogs={0}
              expenses={0}
              netIncome={totals?.credit || 0}
            />
          </ChartCard>
        </div>
        <SimpleTable
          headers={['Code', 'Name', 'Type', 'Debit', 'Credit']}
          rows={rows.map((r) => [
            String(r.code),
            String(r.name),
            String(r.account_type),
            formatMoney(Number(r.debit)),
            formatMoney(Number(r.credit)),
          ])}
        />
      </>
    );
  }

  if (report === 'pnl') {
    const summary = data.summary as Record<string, number> | undefined;
    const rows = (data.rows as Array<Record<string, unknown>>) || [];
    const byType = {
      revenue: rows.filter((r) => r.account_type === 'revenue'),
      cogs: rows.filter((r) => r.account_type === 'cogs'),
      expense: rows.filter((r) => r.account_type === 'expense'),
    };
    return (
      <>
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <SumCard label="Revenue" value={formatMoney(summary.revenue)} tone="emerald" />
            <SumCard label="COGS" value={formatMoney(summary.cogs)} />
            <SumCard label="Gross profit" value={formatMoney(summary.grossProfit)} />
            <SumCard label="Expenses" value={formatMoney(summary.expenses)} />
            <SumCard
              label="Net income"
              value={formatMoney(summary.netIncome)}
              tone={summary.netIncome >= 0 ? 'emerald' : 'amber'}
            />
          </div>
        )}
        {summary && (
          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <ChartCard
              title="P&L bridge"
              subtitle="Revenue → costs → net for selected period"
              height={300}
            >
              <PeriodWaterfall
                revenue={summary.revenue}
                cogs={summary.cogs}
                expenses={summary.expenses}
                netIncome={summary.netIncome}
              />
            </ChartCard>
            <ChartCard title="Expense mix" subtitle="Operating expense accounts" height={300}>
              <MixDoughnut
                segments={byType.expense.slice(0, 8).map((r) => ({
                  label: String(r.name).slice(0, 22),
                  value: Number(r.amount),
                }))}
                centerLabel="OpEx"
                centerValue={formatMoney(summary.expenses)}
              />
            </ChartCard>
          </div>
        )}
        <SimpleTable
          headers={['Code', 'Name', 'Type', 'Amount']}
          rows={rows.map((r) => [
            String(r.code),
            String(r.name),
            String(r.account_type),
            formatMoney(Number(r.amount)),
          ])}
        />
      </>
    );
  }

  if (report === 'balance_sheet') {
    const summary = data.summary as Record<string, number | boolean> | undefined;
    const rows = (data.rows as Array<Record<string, unknown>>) || [];
    return (
      <>
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <SumCard label="Assets" value={formatMoney(Number(summary.assets))} tone="emerald" />
            <SumCard label="Liabilities" value={formatMoney(Number(summary.liabilities))} />
            <SumCard label="Equity (+ NI)" value={formatMoney(Number(summary.equity))} />
            <SumCard
              label="Equation"
              value={summary.balanced ? 'Balanced' : 'Off'}
              tone={summary.balanced ? 'emerald' : 'amber'}
            />
          </div>
        )}
        {summary && (
          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <ChartCard title="Balance sheet composition" subtitle="Assets · liabilities · equity">
              <BalanceCompositionChart
                assets={Number(summary.assets)}
                liabilities={Number(summary.liabilities)}
                equity={Number(summary.equity)}
              />
            </ChartCard>
            <ChartCard title="Top asset accounts" subtitle="Largest asset balances">
              <MixDoughnut
                segments={rows
                  .filter((r) => r.account_type === 'asset')
                  .slice(0, 8)
                  .map((r) => ({
                    label: String(r.name).slice(0, 20),
                    value: Number(r.amount),
                  }))}
                centerLabel="Assets"
                centerValue={formatMoney(Number(summary.assets))}
              />
            </ChartCard>
          </div>
        )}
        <SimpleTable
          headers={['Code', 'Name', 'Type', 'Amount']}
          rows={rows.map((r) => [
            String(r.code),
            String(r.name),
            String(r.account_type),
            formatMoney(Number(r.amount)),
          ])}
        />
      </>
    );
  }

  if (report === 'ar_aging' || report === 'ap_aging') {
    const buckets = data.buckets as
      | { current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number }
      | undefined;
    const rows = (data.rows as Array<Record<string, unknown>>) || [];
    const total = Number(data.total || 0);
    return (
      <>
        {buckets && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <SumCard label="Current" value={formatMoney(buckets.current)} tone="emerald" />
            <SumCard label="1–30" value={formatMoney(buckets.d1_30)} />
            <SumCard label="31–60" value={formatMoney(buckets.d31_60)} />
            <SumCard label="61–90" value={formatMoney(buckets.d61_90)} />
            <SumCard label="90+" value={formatMoney(buckets.d90_plus)} tone="amber" />
          </div>
        )}
        {buckets && (
          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <ChartCard
              title={report === 'ar_aging' ? 'Receivables aging' : 'Payables aging'}
              subtitle={`Total open ${formatMoney(total)}`}
              height={300}
            >
              <AgingBarChart buckets={buckets} />
            </ChartCard>
            <ChartCard title="Bucket mix" subtitle="Share of open balance by age">
              <MixDoughnut
                segments={[
                  { label: 'Current', value: buckets.current },
                  { label: '1–30', value: buckets.d1_30 },
                  { label: '31–60', value: buckets.d31_60 },
                  { label: '61–90', value: buckets.d61_90 },
                  { label: '90+', value: buckets.d90_plus },
                ]}
                centerLabel="Open"
                centerValue={formatMoney(total)}
              />
            </ChartCard>
          </div>
        )}
        <SectionLabel>
          {report === 'ar_aging' ? 'Receivables' : 'Payables'} detail
        </SectionLabel>
        <SimpleTable
          headers={['Number', 'Counterparty', 'Due', 'Days', 'Balance']}
          rows={rows.map((r) => [
            String(r.invoice_number || r.id),
            String(r.counterparty_name || '—'),
            String(r.due_date || '—'),
            String(r.days_overdue ?? 0),
            formatMoney(Number(r.balance_due)),
          ])}
        />
      </>
    );
  }

  if (report === 'cashflow') {
    const summary = data.summary as Record<string, number> | undefined;
    const rows = (data.rows as Array<Record<string, unknown>>) || [];
    // Build daily/weekly-ish series from payment rows for chart
    const byDay = new Map<string, { in: number; out: number }>();
    for (const r of rows) {
      const d = String(r.paid_at || '').slice(0, 10) || '—';
      if (!byDay.has(d)) byDay.set(d, { in: 0, out: 0 });
      const cell = byDay.get(d)!;
      const amt = Number(r.amount || 0);
      if (r.direction === 'inbound') cell.in += amt;
      else cell.out += amt;
    }
    const dayKeys = Array.from(byDay.keys()).sort().slice(-30);
    return (
      <>
        {summary && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <SumCard label="Inflow" value={formatMoney(summary.inflow)} tone="emerald" />
            <SumCard label="Outflow" value={formatMoney(summary.outflow)} />
            <SumCard label="Net" value={formatMoney(summary.net)} />
          </div>
        )}
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <ChartCard
            title="Cash movement"
            subtitle="Recent payments (last 30 dates with activity)"
            height={300}
            className="lg:col-span-2"
          >
            <CashflowChart
              labels={dayKeys.map((d) => d.slice(5))}
              inflow={dayKeys.map((d) => byDay.get(d)!.in)}
              outflow={dayKeys.map((d) => byDay.get(d)!.out)}
              net={dayKeys.map((d) => byDay.get(d)!.in - byDay.get(d)!.out)}
            />
          </ChartCard>
        </div>
        <SimpleTable
          headers={['Date', 'Direction', 'Method', 'Counterparty', 'Amount']}
          rows={rows.map((r) => [
            String(r.paid_at || '').slice(0, 10),
            String(r.direction),
            String(r.method || '—'),
            String(r.counterparty_name || '—'),
            formatMoney(Number(r.amount)),
          ])}
        />
      </>
    );
  }

  return null;
}

function PipelineStrip({
  pipeline,
  includePipeline,
}: {
  pipeline: {
    openValue?: number;
    weightedValue?: number;
    openDeals?: number;
    wonInHistory?: number;
    wonDeals?: number;
    topDeals?: Array<Record<string, unknown>>;
  } | null;
  includePipeline: boolean;
}) {
  if (!includePipeline || !pipeline) return null;
  return (
    <div className="mb-5 rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50/80 via-white to-sky-50/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-violet-700 mb-1">
            <Briefcase className="w-3 h-3" /> CRM pipeline sales
          </div>
          <p className="text-xs text-slate-600 max-w-xl">
            Live opportunities from the sales team (Supabase). Weighted = amount × stage probability.
          </p>
        </div>
        <Link
          href="/dashboard/customers/leads?tab=pipeline"
          className="text-xs font-semibold text-[#00b4d8] hover:underline"
        >
          Manage pipeline →
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <SumCard label="Open pipeline" value={formatMoney(pipeline.openValue || 0)} tone="emerald" />
        <SumCard label="Weighted pipeline" value={formatMoney(pipeline.weightedValue || 0)} />
        <SumCard label="Open deals" value={String(pipeline.openDeals || 0)} />
        <SumCard
          label="Won in history window"
          value={formatMoney(pipeline.wonInHistory || 0)}
          tone="emerald"
        />
      </div>
    </div>
  );
}

function TrendsReport({
  data,
  includePipeline,
}: {
  data: Record<string, unknown>;
  includePipeline: boolean;
}) {
  const labels = (data.labels as string[]) || [];
  const series = (data.series as Record<string, number[]>) || {};
  const totals = (data.totals as Record<string, number>) || {};
  const history = (data.history as Array<Record<string, unknown>>) || [];
  const pipeline = (data.pipeline as Record<string, unknown>) || null;
  const months = Number((data.period as { months?: number })?.months || history.length || 12);

  return (
    <>
      <PipelineStrip
        pipeline={pipeline as Parameters<typeof PipelineStrip>[0]['pipeline']}
        includePipeline={includePipeline}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <SumCard label={`${months}m revenue`} value={formatMoney(totals.revenue || 0)} tone="emerald" />
        <SumCard label={`${months}m expenses`} value={formatMoney(totals.expenses || 0)} />
        <SumCard
          label={`${months}m net`}
          value={formatMoney(totals.netIncome || 0)}
          tone={(totals.netIncome || 0) >= 0 ? 'emerald' : 'amber'}
        />
        <SumCard
          label={includePipeline ? 'Open pipeline' : `${months}m cash net`}
          value={formatMoney(
            includePipeline ? totals.pipelineOpen || 0 : totals.cashNet || 0
          )}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <ChartCard
          title="P&L trajectory"
          subtitle="Monthly revenue, expenses, and net from posted journals"
          height={300}
          className="lg:col-span-2"
        >
          <PnlTrendChart
            labels={labels}
            revenue={series.revenue || []}
            expenses={series.expenses || []}
            netIncome={series.netIncome || []}
          />
        </ChartCard>
        {includePipeline && (
          <ChartCard
            title="Pipeline by month"
            subtitle="Gross pipeline (won + open scheduled) vs probability-weighted"
            height={300}
            className="lg:col-span-2"
          >
            <PnlTrendChart
              labels={labels}
              revenue={series.pipeline || []}
              expenses={series.pipelineWeighted || []}
              netIncome={(series.pipeline || []).map(
                (p, i) => (series.pipelineWeighted?.[i] || 0)
              )}
            />
          </ChartCard>
        )}
        <ChartCard title="Revenue vs cost stack" subtitle="Monthly composition" height={300}>
          <PnlStackChart
            labels={labels}
            revenue={series.revenue || []}
            cogs={series.cogs || []}
            expenses={series.expenses || []}
          />
        </ChartCard>
        <ChartCard title="Cash in / out" subtitle="Bank lines (or payments fallback)" height={300}>
          <CashflowChart
            labels={labels}
            inflow={series.bankIn || []}
            outflow={series.bankOut || []}
            net={series.cashNet || []}
          />
        </ChartCard>
      </div>

      <SectionLabel>Monthly detail</SectionLabel>
      <SimpleTable
        headers={
          includePipeline
            ? ['Month', 'Revenue', 'COGS', 'Expenses', 'Net', 'Pipeline', 'Pipe wtd', 'Cash net', 'Journals']
            : ['Month', 'Revenue', 'COGS', 'Expenses', 'Net', 'Cash net', 'Journals']
        }
        rows={history.map((h) =>
          includePipeline
            ? [
                String(h.label),
                formatMoney(Number(h.revenue)),
                formatMoney(Number(h.cogs)),
                formatMoney(Number(h.expenses)),
                formatMoney(Number(h.netIncome)),
                formatMoney(Number(h.pipeline || 0)),
                formatMoney(Number(h.pipelineWeighted || 0)),
                formatMoney(Number(h.cashNet)),
                String(h.journalCount ?? 0),
              ]
            : [
                String(h.label),
                formatMoney(Number(h.revenue)),
                formatMoney(Number(h.cogs)),
                formatMoney(Number(h.expenses)),
                formatMoney(Number(h.netIncome)),
                formatMoney(Number(h.cashNet)),
                String(h.journalCount ?? 0),
              ]
        )}
      />

      {includePipeline && Array.isArray(pipeline?.topDeals) && (pipeline.topDeals as unknown[]).length > 0 && (
        <>
          <SectionLabel>Top open pipeline deals</SectionLabel>
          <SimpleTable
            headers={['Deal', 'Company', 'Stage', 'Amount', 'Prob %', 'Weighted', 'Expected close']}
            rows={(pipeline!.topDeals as Array<Record<string, unknown>>).map((d) => [
              String(d.name || '—'),
              String(d.company_name || '—'),
              String(d.stage || '—'),
              formatMoney(Number(d.amount || 0)),
              String(d.probability ?? '—'),
              formatMoney(Number(d.weighted || 0)),
              String(d.expected_close_date || '—').slice(0, 10),
            ])}
          />
        </>
      )}
    </>
  );
}

function ForecastReport({
  data,
  includePipeline,
}: {
  data: Record<string, unknown>;
  includePipeline: boolean;
}) {
  const series = data.series as {
    labels: string[];
    historyCount: number;
    revenue: Array<number | null>;
    revenueForecast: Array<number | null>;
    revenueWithPipelineForecast?: Array<number | null>;
    netIncome: Array<number | null>;
    netForecast: Array<number | null>;
    netWithPipelineForecast?: Array<number | null>;
    revenueLow?: Array<number | null>;
    revenueHigh?: Array<number | null>;
  } | null;
  const horizons = (data.horizons as Array<{
    months: number;
    endLabel: string;
    revenue: number;
    revenueWithPipeline?: number;
    cogs: number;
    expenses: number;
    grossProfit: number;
    netIncome: number;
    netWithPipeline?: number;
    cashNet: number;
    pipeline?: number;
    pipelineWeighted?: number;
    avgMonthlyNet: number;
    revenueLow: number;
    revenueHigh: number;
    netLow: number;
    netHigh: number;
  }>) || [];
  const method = String(data.method || '');
  const lastMonth = data.lastMonth as Record<string, number> | undefined;
  const totals = (data.totals as Record<string, number>) || {};
  const pipeline = (data.pipeline as Record<string, unknown>) || null;
  const periodMonths = Number((data.period as { months?: number })?.months || 12);
  const horizonLabel = horizons.map((h) => h.months).join(' · ') || '—';

  return (
    <>
      <PipelineStrip
        pipeline={pipeline as Parameters<typeof PipelineStrip>[0]['pipeline']}
        includePipeline={includePipeline}
      />

      <div className="mb-5 rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-sky-50/80 to-cyan-50/50 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#0077b6] mb-2">
              <TrendingUp className="w-3 h-3" />
              Multi-horizon forecast
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              {horizonLabel} month outlook
            </h3>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              Cumulative projections from the last {periodMonths} months of posted P&L and bank cash
              {includePipeline ? ' · layered with CRM pipeline by expected close' : ''}.
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div className="font-semibold text-slate-700">Trailing {periodMonths}m net</div>
            <div className="text-lg font-black tabular-nums text-slate-900">
              {formatMoney(totals.netIncome || 0)}
            </div>
            {includePipeline && (
              <div className="mt-1 text-[11px] text-violet-700 font-semibold">
                Pipeline open {formatMoney(totals.pipelineOpen || 0)}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {horizons.map((h) => {
            const netShow = includePipeline
              ? h.netWithPipeline ?? h.netIncome
              : h.netIncome;
            const revShow = includePipeline
              ? h.revenueWithPipeline ?? h.revenue
              : h.revenue;
            return (
              <div
                key={h.months}
                className="rounded-2xl border border-white/80 bg-white/90 p-3 shadow-sm"
              >
                <div className="text-[10px] font-black uppercase tracking-wider text-[#00b4d8]">
                  {h.months} month{h.months > 1 ? 's' : ''}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">to {h.endLabel}</div>
                <div
                  className={`mt-2 text-lg font-black tabular-nums ${
                    netShow >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {formatMoney(netShow)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Net{includePipeline ? ' + pipe' : ''} · {formatMoney(netShow / h.months)}/mo
                </div>
                <div className="mt-2 space-y-0.5 text-[10px] text-slate-500">
                  <div className="flex justify-between gap-2">
                    <span>Rev</span>
                    <span className="tabular-nums font-semibold text-slate-700">
                      {formatMoney(revShow)}
                    </span>
                  </div>
                  {includePipeline && (
                    <div className="flex justify-between gap-2">
                      <span>Pipe wtd</span>
                      <span className="tabular-nums font-semibold text-violet-700">
                        {formatMoney(h.pipelineWeighted || 0)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span>Cash</span>
                    <span className="tabular-nums font-semibold text-slate-700">
                      {formatMoney(h.cashNet)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {series && (
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <ChartCard
            title={includePipeline ? 'Revenue path (books + pipeline)' : 'Revenue & net path'}
            subtitle={
              includePipeline
                ? 'Solid = actual · dashed = books forecast · pipeline layers onto “with pipeline” series'
                : 'Solid = actual months · dashed = forecast · green band ≈ 80% revenue range'
            }
            height={320}
            className="lg:col-span-2"
          >
            <ForecastLineChart
              labels={series.labels}
              historyCount={series.historyCount}
              revenue={series.revenue}
              revenueForecast={
                includePipeline && series.revenueWithPipelineForecast
                  ? series.revenueWithPipelineForecast
                  : series.revenueForecast
              }
              netIncome={series.netIncome}
              netForecast={
                includePipeline && series.netWithPipelineForecast
                  ? series.netWithPipelineForecast
                  : series.netForecast
              }
              revenueLow={series.revenueLow}
              revenueHigh={series.revenueHigh}
            />
          </ChartCard>
          <ChartCard
            title="Horizon comparison"
            subtitle="Cumulative revenue, expenses, and net by planning window"
            height={300}
          >
            <HorizonBarsChart
              horizons={horizons.map((h) => ({
                months: h.months,
                revenue: includePipeline ? h.revenueWithPipeline ?? h.revenue : h.revenue,
                expenses: h.expenses,
                netIncome: includePipeline ? h.netWithPipeline ?? h.netIncome : h.netIncome,
              }))}
            />
          </ChartCard>
          <ChartCard
            title="Last closed-month shape"
            subtitle="Most recent month as a bridge reference"
            height={300}
          >
            <PeriodWaterfall
              revenue={Number(lastMonth?.revenue || 0)}
              cogs={Number(lastMonth?.cogs || 0)}
              expenses={Number(lastMonth?.expenses || 0)}
              netIncome={Number(lastMonth?.netIncome || 0)}
            />
          </ChartCard>
        </div>
      )}

      <SectionLabel>Horizon detail</SectionLabel>
      <SimpleTable
        headers={
          includePipeline
            ? [
                'Horizon',
                'Ends',
                'Books rev',
                'Rev + pipe',
                'Pipe wtd',
                'COGS',
                'Expenses',
                'Net books',
                'Net + pipe',
                'Cash net',
              ]
            : [
                'Horizon',
                'Ends',
                'Revenue',
                'Rev range',
                'COGS',
                'Expenses',
                'Gross profit',
                'Net income',
                'Net range',
                'Cash net',
              ]
        }
        rows={horizons.map((h) =>
          includePipeline
            ? [
                `${h.months}m`,
                h.endLabel,
                formatMoney(h.revenue),
                formatMoney(h.revenueWithPipeline ?? h.revenue),
                formatMoney(h.pipelineWeighted || 0),
                formatMoney(h.cogs),
                formatMoney(h.expenses),
                formatMoney(h.netIncome),
                formatMoney(h.netWithPipeline ?? h.netIncome),
                formatMoney(h.cashNet),
              ]
            : [
                `${h.months}m`,
                h.endLabel,
                formatMoney(h.revenue),
                `${formatMoney(h.revenueLow)} – ${formatMoney(h.revenueHigh)}`,
                formatMoney(h.cogs),
                formatMoney(h.expenses),
                formatMoney(h.grossProfit),
                formatMoney(h.netIncome),
                `${formatMoney(h.netLow)} – ${formatMoney(h.netHigh)}`,
                formatMoney(h.cashNet),
              ]
        )}
      />

      {includePipeline && Array.isArray(pipeline?.topDeals) && (pipeline.topDeals as unknown[]).length > 0 && (
        <>
          <SectionLabel>Pipeline feeding this forecast</SectionLabel>
          <SimpleTable
            headers={['Deal', 'Company', 'Stage', 'Amount', 'Prob %', 'Weighted', 'Expected close']}
            rows={(pipeline!.topDeals as Array<Record<string, unknown>>).map((d) => [
              String(d.name || '—'),
              String(d.company_name || '—'),
              String(d.stage || '—'),
              formatMoney(Number(d.amount || 0)),
              String(d.probability ?? '—'),
              formatMoney(Number(d.weighted || 0)),
              String(d.expected_close_date || '—').slice(0, 10),
            ])}
          />
        </>
      )}

      {method && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600 leading-relaxed">
          <Info className="w-4 h-4 shrink-0 text-[#00b4d8] mt-0.5" />
          <div>
            <span className="font-bold text-slate-800">Method · </span>
            {method}
          </div>
        </div>
      )}
    </>
  );
}

function MgmtSnapshot({ data }: { data: Record<string, unknown> }) {
  const summary = data.summary as Record<string, number> | undefined;
  const income = (data.income as Array<Record<string, unknown>>) || [];
  const expenses = (data.expenses as Array<Record<string, unknown>>) || [];
  if (!summary) {
    return (
      <Panel>
        <div className="px-6 py-12 text-center text-sm text-neutral-500">No management data</div>
      </Panel>
    );
  }
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <SumCard label="Revenue" value={formatMoney(summary.revenue)} tone="emerald" />
        <SumCard label="Gross profit" value={formatMoney(summary.grossProfit)} />
        <SumCard label="Expenses" value={formatMoney(summary.expenses)} />
        <SumCard
          label="Operating profit"
          value={formatMoney(summary.operatingProfit)}
          tone={summary.operatingProfit >= 0 ? 'emerald' : 'amber'}
        />
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Period bridge" height={280}>
          <PeriodWaterfall
            revenue={summary.revenue}
            cogs={summary.cogs}
            expenses={summary.expenses}
            netIncome={summary.netIncome}
          />
        </ChartCard>
        <ChartCard title="Income mix" height={280}>
          <MixDoughnut
            segments={income.slice(0, 8).map((r) => ({
              label: String(r.name).slice(0, 20),
              value: Number(r.amount),
            }))}
            centerLabel="Revenue"
            centerValue={formatMoney(summary.revenue)}
          />
        </ChartCard>
      </div>
      <SimpleTable
        headers={['Section', 'Code', 'Name', 'Amount']}
        rows={[
          ...income.map((r) => ['Income', String(r.code), String(r.name), formatMoney(Number(r.amount))]),
          ...expenses.map((r) => [
            'Expense',
            String(r.code),
            String(r.name),
            formatMoney(Number(r.amount)),
          ]),
        ]}
      />
    </>
  );
}

function SumCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'emerald' | 'amber';
}) {
  const cls =
    tone === 'emerald'
      ? 'border-emerald-100 bg-emerald-50/40'
      : tone === 'amber'
        ? 'border-amber-100 bg-amber-50/40'
        : 'border-neutral-200 bg-white';
  return (
    <div className={`rounded-3xl border p-4 ${cls}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
        {label}
      </div>
      <div className="text-lg font-black tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <Panel>
      {rows.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-neutral-500">
          No rows for this period. Post journals or create invoices to populate reports.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                {headers.map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-neutral-50/80">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-4 py-2.5 whitespace-nowrap ${
                        j >= Math.max(1, row.length - 4) ? 'tabular-nums' : ''
                      } ${j === 0 ? 'font-mono text-xs font-semibold text-slate-700' : 'text-slate-700'}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
