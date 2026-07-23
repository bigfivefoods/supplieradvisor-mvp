'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  Info,
  Sparkles,
  Briefcase,
  Percent,
  PieChart,
  Wallet,
  ArrowDownUp,
  BarChart3,
  Activity,
  Scale,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { formatMoney } from '@/lib/accounting/types';
import { horizonsFromMax } from '@/lib/accounting/forecast';
import { buildAccountingRatios, type RatioCard } from '@/lib/accounting/ratios';
import {
  AccountingHeader,
  AccountingPage,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import {
  AgingBarChart,
  BalanceCompositionChart,
  CashflowChart,
  ChartCard,
  ForecastLineChart,
  HorizonBarsChart,
  MarginTrendChart,
  MixDoughnut,
  PeriodWaterfall,
  PnlStackChart,
  PnlTrendChart,
  RatioBarChart,
  RatioGrid,
} from '@/components/accounting/AccountingCharts';

const REPORTS = [
  { id: 'forecast', label: 'Forecast', accent: true },
  { id: 'ratios', label: 'Ratios', accent: true },
  { id: 'trends', label: 'Trends' },
  { id: 'pnl', label: 'Profit & loss' },
  { id: 'budget_vs_actual', label: 'Budget vs actual', accent: true },
  { id: 'balance_sheet', label: 'Balance sheet' },
  { id: 'trial_balance', label: 'Trial balance' },
  { id: 'ar_aging', label: 'AR aging' },
  { id: 'ap_aging', label: 'AP aging' },
  { id: 'cashflow', label: 'Cash flow' },
  { id: 'management_accounts', label: 'Mgmt snapshot' },
] as const;

const HORIZON_PRESETS = [1, 3, 6, 9, 12, 18, 24] as const;

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
  const [period, setPeriod] = useState<PeriodSlicerValue>(() => initialPeriodSlicerValue('this_month'));
  const [horizonMonths, setHorizonMonths] = useState(12);
  const [selectedHorizons, setSelectedHorizons] = useState<number[]>([1, 3, 6, 9, 12]);
  const [includePipeline, setIncludePipeline] = useState(true);
  const [customHorizon, setCustomHorizon] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

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

  const isSeriesReport =
    report === 'trends' || report === 'forecast' || report === 'ratios';
  const historyMonths = period.historyMonths ?? 12;
  const from = period.from;
  const to = period.to;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) base.set('privyUserId', privyUserId);

      if (report === 'ratios') {
        // Composite pack: trends + BS + AR/AP for full ratio set
        const tParams = new URLSearchParams(base);
        tParams.set('report', 'trends');
        tParams.set('months', String(historyMonths));
        tParams.set('includePipeline', includePipeline ? '1' : '0');
        if (period.selectedMonthFroms.length > 0) {
          tParams.set('from', from);
          tParams.set('to', to);
        } else if (to) tParams.set('to', to);

        const bsParams = new URLSearchParams(base);
        bsParams.set('report', 'balance_sheet');
        if (from) bsParams.set('from', from);
        if (to) bsParams.set('to', to);

        const arParams = new URLSearchParams(base);
        arParams.set('report', 'ar_aging');
        const apParams = new URLSearchParams(base);
        apParams.set('report', 'ap_aging');

        const [tRes, bsRes, arRes, apRes] = await Promise.all([
          fetch(`/api/accounting/reports?${tParams}`),
          fetch(`/api/accounting/reports?${bsParams}`),
          fetch(`/api/accounting/reports?${arParams}`),
          fetch(`/api/accounting/reports?${apParams}`),
        ]);
        const [tJson, bsJson, arJson, apJson] = await Promise.all([
          tRes.json(),
          bsRes.json(),
          arRes.json(),
          apRes.json(),
        ]);
        if (!tRes.ok) throw new Error(tJson.error || 'Failed');
        setData({
          ...tJson,
          report: 'ratios',
          balanceSheet: bsJson.summary || null,
          arBuckets: arJson.buckets || null,
          arTotal: arJson.total || 0,
          apBuckets: apJson.buckets || null,
          apTotal: apJson.total || 0,
        });
      } else {
        const params = new URLSearchParams(base);
        params.set('report', report);

        if (isSeriesReport) {
          params.set('months', String(historyMonths));
          params.set('includePipeline', includePipeline ? '1' : '0');
          if (period.selectedMonthFroms.length > 0) {
            params.set('from', from);
            params.set('to', to);
          } else if (to) {
            params.set('to', to);
          }
          if (report === 'forecast') {
            params.set('horizons', selectedHorizons.join(','));
            params.set(
              'horizonMonths',
              String(Math.max(...selectedHorizons, horizonMonths))
            );
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
      }
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
    period.selectedMonthFroms.length,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AccountingPage>
      <AccountingHeader
        title="Reports &"
        titleAccent="analytics"
        description="Slice by one or more months, quarters, or FY · pipeline sales · forecast horizons (1–36 months)."
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

      <PeriodSlicer
        value={period}
        onChange={setPeriod}
        showTrailing
        footer={
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
                          horizonMonths === n
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
        }
      />

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

  if (report === 'ratios') {
    return <RatiosReport data={data} />;
  }

  if (report === 'trends') {
    return <TrendsReport data={data} includePipeline={includePipeline} />;
  }

  if (report === 'management_accounts') {
    return <MgmtSnapshot data={data} />;
  }

  if (report === 'budget_vs_actual') {
    return <BudgetVsActualReport data={data} />;
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
    const ratios = summary
      ? buildAccountingRatios({
          revenue: summary.revenue,
          cogs: summary.cogs,
          expenses: summary.expenses,
          grossProfit: summary.grossProfit,
          netIncome: summary.netIncome,
        }).filter((r) =>
          ['gross_margin', 'op_margin', 'net_margin', 'expense_ratio', 'cogs_ratio'].includes(
            r.id
          )
        )
      : [];
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
        {ratios.length > 0 && (
          <RatioGrid
            ratios={ratios}
            title="Profitability ratios"
            subtitle="Margins and cost structure for the selected period"
          />
        )}
        {summary && (
          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <ChartCard
              title="P&L bridge"
              subtitle="Revenue → COGS → OpEx → net"
              height={300}
              icon={BarChart3}
              badge="Statement"
            >
              <PeriodWaterfall
                revenue={summary.revenue}
                cogs={summary.cogs}
                expenses={summary.expenses}
                netIncome={summary.netIncome}
              />
            </ChartCard>
            <ChartCard
              title="Expense mix"
              subtitle="Operating expense accounts"
              height={300}
              icon={PieChart}
            >
              <MixDoughnut
                segments={byType.expense.slice(0, 8).map((r) => ({
                  label: String(r.name).slice(0, 22),
                  value: Number(r.amount),
                }))}
                centerLabel="OpEx"
                centerValue={formatMoney(summary.expenses)}
              />
            </ChartCard>
            <ChartCard
              title="Income mix"
              subtitle="Revenue accounts"
              height={280}
              icon={TrendingUp}
            >
              <MixDoughnut
                segments={byType.revenue.slice(0, 8).map((r) => ({
                  label: String(r.name).slice(0, 22),
                  value: Number(r.amount),
                }))}
                centerLabel="Revenue"
                centerValue={formatMoney(summary.revenue)}
              />
            </ChartCard>
            {ratios.length > 0 && (
              <ChartCard
                title="Margin snapshot"
                subtitle="Key % ratios for this period"
                height={280}
                icon={Percent}
              >
                <RatioBarChart
                  ratios={ratios
                    .filter((r) => r.raw != null)
                    .map((r) => ({ label: r.label, value: r.raw }))}
                />
              </ChartCard>
            )}
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
    const completeness =
      (data.completeness as Array<{
        key: string;
        label: string;
        ok: boolean;
        detail: string;
      }>) || [];
    const registers = data.registers as
      | {
          fixedAssets?: Array<Record<string, unknown>>;
          fixedAssetRegisterTotal?: number;
          fixedAssetUncapitalisedCount?: number;
          liabilities?: Array<Record<string, unknown>>;
          liabilityRegisterTotal?: number;
          bankRegisterTotal?: number;
        }
      | undefined;
    const allocationByBu =
      (data.allocationByBu as Array<{
        business_unit_id: number | null;
        assets: number;
        liabilities: number;
      }>) || [];
    const sectionOrder = [
      'current_assets',
      'non_current_assets',
      'current_liabilities',
      'non_current_liabilities',
      'equity',
    ];
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <SumCard
              label="Current assets"
              value={formatMoney(Number(summary.currentAssets || 0))}
              tone="emerald"
            />
            <SumCard
              label="Non-current assets"
              value={formatMoney(Number(summary.nonCurrentAssets || 0))}
            />
            <SumCard
              label="Current liabilities"
              value={formatMoney(Number(summary.currentLiabilities || 0))}
            />
            <SumCard
              label="Non-current liabilities"
              value={formatMoney(Number(summary.nonCurrentLiabilities || 0))}
            />
          </div>
        )}
        {completeness.length > 0 && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-bold text-slate-900 mb-1">
              Allocation completeness
            </div>
            <p className="text-[11px] text-neutral-500 mb-3">
              Assets and liabilities should sit on the GL balance sheet (PPE,
              inventory, bank, AP, loans). Capitalise fixed assets and post
              liability register items so nothing sits off-books.
            </p>
            <ul className="space-y-2">
              {completeness.map((c) => (
                <li
                  key={c.key}
                  className={`flex flex-wrap items-start gap-2 text-[12px] rounded-xl border px-3 py-2 ${
                    c.ok
                      ? 'border-emerald-100 bg-emerald-50/60 text-emerald-950'
                      : 'border-amber-100 bg-amber-50/70 text-amber-950'
                  }`}
                >
                  <span className="font-bold shrink-0">
                    {c.ok ? '✓' : '!'} {c.label}
                  </span>
                  <span className="text-[11px] opacity-90">{c.detail}</span>
                </li>
              ))}
            </ul>
            {(Number(registers?.fixedAssetUncapitalisedCount) > 0 ||
              Number(registers?.liabilityRegisterTotal) >= 0) && (
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <Link
                  href="/dashboard/accounting/fixed-assets"
                  className="font-semibold text-[#00b4d8] underline"
                >
                  Fixed assets → capitalise to BS
                </Link>
                <span className="text-neutral-400">·</span>
                <Link
                  href="/dashboard/accounting/chart-of-accounts"
                  className="font-semibold text-slate-600 underline"
                >
                  Chart of accounts
                </Link>
              </div>
            )}
          </div>
        )}
        {summary && (
          <>
            <RatioGrid
              ratios={buildAccountingRatios({
                assets: Number(summary.assets),
                liabilities: Number(summary.liabilities),
                equity: Number(summary.equity),
                netIncome: Number(summary.netIncome || 0),
              }).filter((r) =>
                ['current_ratio', 'debt_equity', 'roa', 'roe', 'working_capital'].includes(r.id)
              )}
              title="Balance sheet ratios"
              subtitle="Liquidity, leverage, and returns (period NI rolled into equity)"
            />
            <div className="grid lg:grid-cols-2 gap-4 mb-6">
              <ChartCard
                title="Balance sheet composition"
                subtitle="Assets · liabilities · equity"
                icon={Scale}
                badge="Equation"
              >
                <BalanceCompositionChart
                  assets={Number(summary.assets)}
                  liabilities={Number(summary.liabilities)}
                  equity={Number(summary.equity)}
                />
              </ChartCard>
              <ChartCard
                title="Top asset accounts"
                subtitle="Largest asset balances"
                icon={Wallet}
              >
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
          </>
        )}
        {sectionOrder.map((sec) => {
          const secRows = rows.filter((r) => r.section === sec);
          if (!secRows.length && sec !== 'equity') return null;
          const label =
            String(secRows[0]?.section_label || sec).replace(/_/g, ' ') || sec;
          const total = secRows.reduce((s, r) => s + Number(r.amount || 0), 0);
          const ni =
            sec === 'equity' ? Number(summary?.netIncome || 0) : 0;
          return (
            <div key={sec} className="mb-4">
              <div className="flex items-center justify-between mb-1 px-1">
                <SectionLabel>{label}</SectionLabel>
                <span className="text-xs font-bold text-slate-700">
                  {formatMoney(total + ni)}
                </span>
              </div>
              <SimpleTable
                headers={['Code', 'Name', 'Amount']}
                rows={[
                  ...secRows.map((r) => [
                    String(r.code),
                    String(r.name),
                    formatMoney(Number(r.amount)),
                  ]),
                  ...(sec === 'equity' && ni !== 0
                    ? [
                        [
                          'NI',
                          'Net income (period)',
                          formatMoney(ni),
                        ],
                      ]
                    : []),
                ]}
              />
            </div>
          );
        })}
        {allocationByBu.length > 0 && (
          <div className="mb-6">
            <SectionLabel>Allocated by business unit</SectionLabel>
            <p className="text-[11px] text-neutral-500 mb-2">
              From journal lines with cost dimensions (BU / cell / asset).
              Unallocated = no dimension on the line.
            </p>
            <SimpleTable
              headers={['Business unit', 'Assets', 'Liabilities']}
              rows={allocationByBu.map((r) => [
                r.business_unit_id != null
                  ? `BU #${r.business_unit_id}`
                  : 'Unallocated',
                formatMoney(r.assets),
                formatMoney(r.liabilities),
              ])}
            />
          </div>
        )}
        {registers && (
          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <div>
              <SectionLabel>Fixed asset register</SectionLabel>
              <p className="text-[11px] text-neutral-500 mb-2">
                Book value {formatMoney(Number(registers.fixedAssetRegisterTotal || 0))}
                {Number(registers.fixedAssetUncapitalisedCount) > 0
                  ? ` · ${registers.fixedAssetUncapitalisedCount} not on GL BS`
                  : ' · all capitalised'}
              </p>
              <SimpleTable
                headers={['Code', 'Name', 'Book', 'On BS']}
                rows={(registers.fixedAssets || []).slice(0, 20).map((a) => [
                  String(a.code || '—'),
                  String(a.name || ''),
                  formatMoney(Number(a.book_value || 0)),
                  a.on_balance_sheet ? 'Yes' : 'No',
                ])}
              />
            </div>
            <div>
              <SectionLabel>Liability register</SectionLabel>
              <p className="text-[11px] text-neutral-500 mb-2">
                Outstanding {formatMoney(Number(registers.liabilityRegisterTotal || 0))}
                {registers.bankRegisterTotal != null
                  ? ` · bank books ${formatMoney(Number(registers.bankRegisterTotal))}`
                  : ''}
              </p>
              <SimpleTable
                headers={['Name', 'Type', 'Outstanding', 'On BS']}
                rows={(registers.liabilities || []).slice(0, 20).map((l) => [
                  String(l.name || ''),
                  String(l.liability_type || ''),
                  formatMoney(Number(l.outstanding || 0)),
                  l.on_balance_sheet ? 'Yes' : 'No',
                ])}
              />
              {!(registers.liabilities || []).length && (
                <p className="text-[11px] text-neutral-500 mt-2">
                  No loans/deposits register yet. AP still posts via PO / journals
                  (Cr 2110). Create liabilities under Accounting when needed.
                </p>
              )}
            </div>
          </div>
        )}
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

function RatiosReport({ data }: { data: Record<string, unknown> }) {
  const labels = (data.labels as string[]) || [];
  const series = (data.series as Record<string, number[]>) || {};
  const totals = (data.totals as Record<string, number>) || {};
  const history = (data.history as Array<Record<string, unknown>>) || [];
  const ratios = ratiosFromTrends(data);
  const margins = marginSeries(history);
  const marginBars = ratios.filter((r) =>
    ['gross_margin', 'op_margin', 'net_margin', 'expense_ratio', 'cogs_ratio'].includes(r.id)
  );

  const groups: Array<{ id: string; title: string; ids: string[] }> = [
    {
      id: 'profitability',
      title: 'Profitability',
      ids: ['gross_margin', 'op_margin', 'net_margin', 'roa', 'roe'],
    },
    {
      id: 'liquidity',
      title: 'Liquidity',
      ids: ['current_ratio', 'quick_ratio', 'working_capital', 'ar_ap'],
    },
    {
      id: 'leverage',
      title: 'Leverage',
      ids: ['debt_equity'],
    },
    {
      id: 'efficiency',
      title: 'Efficiency',
      ids: ['expense_ratio', 'cogs_ratio'],
    },
    {
      id: 'growth',
      title: 'Growth',
      ids: ['rev_growth', 'net_growth'],
    },
  ];

  return (
    <>
      <div className="mb-5 rounded-[1.5rem] border border-teal-100 bg-gradient-to-br from-white via-teal-50/40 to-sky-50/50 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-teal-700 mb-2">
              <Percent className="w-3 h-3" />
              Financial ratio pack
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Leading accounting ratios
            </h3>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              Board-style KPIs from posted P&amp;L history, balance sheet, AR/AP, and cash —
              green = healthy, amber = watch, rose = pressure.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <SumCard label="Revenue (window)" value={formatMoney(totals.revenue || 0)} tone="emerald" />
          <SumCard label="Net income" value={formatMoney(totals.netIncome || 0)} />
          <SumCard label="Cash net" value={formatMoney(totals.cashNet || 0)} />
          <SumCard
            label="AR open"
            value={formatMoney(Number(data.arTotal || 0))}
            tone="amber"
          />
        </div>
      </div>

      {groups.map((g) => {
        const cards = ratios.filter((r) => g.ids.includes(r.id));
        if (!cards.length) return null;
        return (
          <RatioGrid
            key={g.id}
            ratios={cards}
            title={g.title}
            subtitle={
              g.id === 'liquidity'
                ? 'Uses BS + AR/AP when available; otherwise cash/AR proxies'
                : undefined
            }
          />
        );
      })}

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <ChartCard
          title="Margin & cost ratios"
          subtitle="Gross / net / expense / COGS %"
          height={300}
          icon={Percent}
        >
          <RatioBarChart
            ratios={marginBars.map((r) => ({ label: r.label, value: r.raw }))}
          />
        </ChartCard>
        <ChartCard
          title="Margin trend"
          subtitle="Gross vs net margin through history"
          height={300}
          icon={TrendingUp}
        >
          <MarginTrendChart
            labels={labels}
            grossMargin={margins.gross}
            netMargin={margins.net}
          />
        </ChartCard>
        <ChartCard
          title="P&L trajectory"
          subtitle="Revenue · expenses · net"
          height={300}
          className="lg:col-span-2"
          icon={Activity}
        >
          <PnlTrendChart
            labels={labels}
            revenue={series.revenue || []}
            expenses={series.expenses || []}
            netIncome={series.netIncome || []}
          />
        </ChartCard>
      </div>

      <p className="text-[11px] text-slate-400 text-center max-w-2xl mx-auto mb-4">
        Ratios are indicative management metrics. Post complete journals and a balanced balance
        sheet for the strongest signals. Not a substitute for statutory financial statements.
      </p>
    </>
  );
}

function ratiosFromTrends(data: Record<string, unknown>): RatioCard[] {
  const series = (data.series as Record<string, number[]>) || {};
  const totals = (data.totals as Record<string, number>) || {};
  const bs = data.balanceSheet as Record<string, number> | null | undefined;
  return buildAccountingRatios({
    revenue: totals.revenue,
    cogs: totals.cogs,
    expenses: totals.expenses,
    netIncome: totals.netIncome,
    cashNet: totals.cashNet,
    bankIn: totals.bankIn,
    bankOut: totals.bankOut,
    assets: bs ? Number(bs.assets) : undefined,
    liabilities: bs ? Number(bs.liabilities) : undefined,
    equity: bs ? Number(bs.equity) : undefined,
    arOpen: Number(data.arTotal || 0) || undefined,
    apOpen: Number(data.apTotal || 0) || undefined,
    revenueSeries: series.revenue,
    expenseSeries: series.expenses,
    netSeries: series.netIncome,
    cashSeries: series.cashNet,
  });
}

function marginSeries(history: Array<Record<string, unknown>>) {
  const gross: number[] = [];
  const net: number[] = [];
  for (const h of history) {
    const rev = Number(h.revenue || 0);
    const cogs = Number(h.cogs || 0);
    const ni = Number(h.netIncome || 0);
    gross.push(rev > 0 ? Math.round(((rev - cogs) / rev) * 1000) / 10 : 0);
    net.push(rev > 0 ? Math.round((ni / rev) * 1000) / 10 : 0);
  }
  return { gross, net };
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
  const ratios = ratiosFromTrends(data);
  const margins = marginSeries(history);

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

      <RatioGrid
        ratios={ratios.filter((r) =>
          [
            'gross_margin',
            'net_margin',
            'expense_ratio',
            'rev_growth',
            'net_growth',
            'cogs_ratio',
          ].includes(r.id)
        )}
        title="Trend ratios"
        subtitle="Profitability and momentum across the history window"
      />

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <ChartCard
          title="P&L trajectory"
          subtitle="Monthly revenue, expenses, and net — posted journals"
          height={320}
          className="lg:col-span-2"
          icon={Activity}
          badge="Primary"
        >
          <PnlTrendChart
            labels={labels}
            revenue={series.revenue || []}
            expenses={series.expenses || []}
            netIncome={series.netIncome || []}
          />
        </ChartCard>
        <ChartCard
          title="Margin trend"
          subtitle="Gross and net margin % by month"
          height={280}
          icon={Percent}
        >
          <MarginTrendChart
            labels={labels}
            grossMargin={margins.gross}
            netMargin={margins.net}
          />
        </ChartCard>
        <ChartCard
          title="Revenue vs cost stack"
          subtitle="Monthly composition (revenue up · costs down)"
          height={280}
          icon={BarChart3}
        >
          <PnlStackChart
            labels={labels}
            revenue={series.revenue || []}
            cogs={series.cogs || []}
            expenses={series.expenses || []}
          />
        </ChartCard>
        <ChartCard
          title="Cash movement"
          subtitle="Bank inflows / outflows · net dashed"
          height={280}
          icon={ArrowDownUp}
          className="lg:col-span-2"
        >
          <CashflowChart
            labels={labels}
            inflow={series.bankIn || []}
            outflow={series.bankOut || []}
            net={series.cashNet || []}
          />
        </ChartCard>
        {includePipeline && (
          <ChartCard
            title="Pipeline by month"
            subtitle="Gross vs probability-weighted CRM pipeline"
            height={280}
            className="lg:col-span-2"
            icon={Briefcase}
          >
            <PnlTrendChart
              labels={labels}
              revenue={series.pipeline || []}
              expenses={series.pipelineWeighted || []}
              netIncome={(series.pipeline || []).map(
                (_p, i) => series.pipelineWeighted?.[i] || 0
              )}
            />
          </ChartCard>
        )}
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
  const history = (data.history as Array<Record<string, unknown>>) || [];
  const ratios = buildAccountingRatios({
    revenue: totals.revenue,
    cogs: totals.cogs,
    expenses: totals.expenses,
    netIncome: totals.netIncome,
    cashNet: totals.cashNet,
    bankIn: totals.bankIn,
    bankOut: totals.bankOut,
    revenueSeries: history.map((h) => Number(h.revenue || 0)),
    netSeries: history.map((h) => Number(h.netIncome || 0)),
  });
  const margins = marginSeries(history);

  return (
    <>
      <PipelineStrip
        pipeline={pipeline as Parameters<typeof PipelineStrip>[0]['pipeline']}
        includePipeline={includePipeline}
      />

      <div className="mb-5 rounded-[1.5rem] border border-sky-100 bg-gradient-to-br from-white via-sky-50/70 to-teal-50/40 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-teal-700 mb-2">
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

      <RatioGrid
        ratios={ratios.filter((r) =>
          [
            'gross_margin',
            'net_margin',
            'expense_ratio',
            'rev_growth',
            'net_growth',
            'cogs_ratio',
          ].includes(r.id)
        )}
        title="Baseline ratios (history)"
        subtitle="Margins and growth that underwrite the forecast model"
      />

      {series && (
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <ChartCard
            title={includePipeline ? 'Revenue path (books + pipeline)' : 'Revenue & net path'}
            subtitle={
              includePipeline
                ? 'Solid = actual · dashed = forecast (+ pipeline when enabled)'
                : 'Solid = actual · dashed = forecast · band ≈ 80% revenue range'
            }
            height={340}
            className="lg:col-span-2"
            icon={Activity}
            badge="Primary"
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
            icon={BarChart3}
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
            title="Last month P&L bridge"
            subtitle="Most recent month shape (reference)"
            height={300}
            icon={PieChart}
          >
            <PeriodWaterfall
              revenue={Number(lastMonth?.revenue || 0)}
              cogs={Number(lastMonth?.cogs || 0)}
              expenses={Number(lastMonth?.expenses || 0)}
              netIncome={Number(lastMonth?.netIncome || 0)}
            />
          </ChartCard>
          <ChartCard
            title="Historic margin %"
            subtitle="Gross and net margin through the history window"
            height={280}
            icon={Percent}
            className="lg:col-span-2"
          >
            <MarginTrendChart
              labels={history.map((h) => String(h.label))}
              grossMargin={margins.gross}
              netMargin={margins.net}
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

function BudgetVsActualReport({ data }: { data: Record<string, unknown> }) {
  const summary = data.summary as {
    budgetRevenue?: number;
    actualRevenue?: number;
    budgetCogs?: number;
    actualCogs?: number;
    budgetExpenses?: number;
    actualExpenses?: number;
    budgetNet?: number;
    actualNet?: number;
    hasBudget?: boolean;
  } | null;
  const rows = (data.rows as Array<Record<string, unknown>>) || [];
  const period = data.period as { year?: number; from?: string; to?: string } | undefined;

  if (!summary?.hasBudget && rows.length === 0) {
    return (
      <Panel>
        <div className="px-6 py-12 text-center text-sm text-neutral-500 space-y-3">
          <p>No budget loaded for this period.</p>
          <Link
            href="/dashboard/accounting/budget"
            className="inline-flex font-bold text-[#00b4d8] underline"
          >
            Enter 12-month budget by COA →
          </Link>
        </div>
      </Panel>
    );
  }

  const revVar =
    Number(summary?.actualRevenue || 0) - Number(summary?.budgetRevenue || 0);
  const expVar =
    Number(summary?.actualExpenses || 0) - Number(summary?.budgetExpenses || 0);
  const netVar =
    Number(summary?.actualNet || 0) - Number(summary?.budgetNet || 0);

  return (
    <>
      <div className="mb-3 text-xs text-neutral-500">
        Plan vs actual
        {period?.year ? ` · FY ${period.year}` : ''}
        {period?.from ? ` · ${period.from} → ${period.to}` : ''}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <SumCard
          label="Revenue actual / budget"
          value={`${formatMoney(summary?.actualRevenue || 0)} / ${formatMoney(summary?.budgetRevenue || 0)}`}
          tone="emerald"
        />
        <SumCard
          label="Revenue variance"
          value={formatMoney(revVar)}
          tone={revVar >= 0 ? 'emerald' : 'amber'}
        />
        <SumCard
          label="Expenses actual / budget"
          value={`${formatMoney(summary?.actualExpenses || 0)} / ${formatMoney(summary?.budgetExpenses || 0)}`}
        />
        <SumCard
          label="Net variance"
          value={formatMoney(netVar)}
          tone={netVar >= 0 ? 'emerald' : 'amber'}
        />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <SumCard label="Budget net" value={formatMoney(summary?.budgetNet || 0)} />
        <SumCard label="Actual net" value={formatMoney(summary?.actualNet || 0)} />
        <SumCard
          label="Expense variance (act−bud)"
          value={formatMoney(expVar)}
          tone={expVar <= 0 ? 'emerald' : 'amber'}
        />
      </div>
      <SectionLabel>By account</SectionLabel>
      <SimpleTable
        headers={[
          'Code',
          'Name',
          'Type',
          'Budget',
          'Actual',
          'Variance',
          'Var %',
          'Fav?',
        ]}
        rows={rows.map((r) => [
          String(r.code),
          String(r.name),
          String(r.account_type),
          formatMoney(Number(r.budget || 0)),
          formatMoney(Number(r.actual || 0)),
          formatMoney(Number(r.variance || 0)),
          r.variancePct != null ? `${r.variancePct}%` : '—',
          r.favourable === true
            ? 'Yes'
            : r.favourable === false
              ? 'No'
              : '—',
        ])}
      />
      <p className="mt-4 text-[11px] text-neutral-500">
        Revenue over budget is favourable; expenses over budget is unfavourable.{' '}
        <Link href="/dashboard/accounting/budget" className="text-[#00b4d8] underline">
          Edit budget
        </Link>
      </p>
    </>
  );
}

function MgmtSnapshot({ data }: { data: Record<string, unknown> }) {
  const summary = data.summary as Record<string, number> | undefined;
  const income = (data.income as Array<Record<string, unknown>>) || [];
  const expenses = (data.expenses as Array<Record<string, unknown>>) || [];
  const bva = data.budgetVsActual as
    | {
        summary?: {
          hasBudget?: boolean;
          budgetRevenue?: number;
          actualRevenue?: number;
          budgetExpenses?: number;
          actualExpenses?: number;
          budgetNet?: number;
          actualNet?: number;
        };
        rows?: Array<Record<string, unknown>>;
      }
    | null
    | undefined;
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
      {bva?.summary?.hasBudget && (
        <>
          <SectionLabel>Budget (plan) vs actual</SectionLabel>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <SumCard
              label="Budget revenue"
              value={formatMoney(bva.summary.budgetRevenue || 0)}
            />
            <SumCard
              label="Rev variance"
              value={formatMoney(
                Number(bva.summary.actualRevenue || 0) -
                  Number(bva.summary.budgetRevenue || 0)
              )}
              tone={
                Number(bva.summary.actualRevenue || 0) >=
                Number(bva.summary.budgetRevenue || 0)
                  ? 'emerald'
                  : 'amber'
              }
            />
            <SumCard
              label="Budget expenses"
              value={formatMoney(bva.summary.budgetExpenses || 0)}
            />
            <SumCard
              label="Net plan vs actual"
              value={formatMoney(
                Number(bva.summary.actualNet || 0) -
                  Number(bva.summary.budgetNet || 0)
              )}
              tone={
                Number(bva.summary.actualNet || 0) >=
                Number(bva.summary.budgetNet || 0)
                  ? 'emerald'
                  : 'amber'
              }
            />
          </div>
          {(bva.rows || []).length > 0 && (
            <SimpleTable
              headers={['Code', 'Name', 'Budget', 'Actual', 'Variance']}
              rows={(bva.rows || []).slice(0, 40).map((r) => [
                String(r.code),
                String(r.name),
                formatMoney(Number(r.budget || 0)),
                formatMoney(Number(r.actual || 0)),
                formatMoney(Number(r.variance || 0)),
              ])}
            />
          )}
          <p className="mb-6 mt-2 text-[11px] text-neutral-500">
            <Link
              href="/dashboard/accounting/reports?report=budget_vs_actual"
              className="text-[#00b4d8] underline"
            >
              Full budget vs actual report
            </Link>
          </p>
        </>
      )}
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
