'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  Info,
  Sparkles,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { formatMoney } from '@/lib/accounting/types';
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
  { id: 'forecast', label: 'Forecast 1–12m', accent: true },
  { id: 'trends', label: 'Trends' },
  { id: 'pnl', label: 'Profit & loss' },
  { id: 'balance_sheet', label: 'Balance sheet' },
  { id: 'trial_balance', label: 'Trial balance' },
  { id: 'ar_aging', label: 'AR aging' },
  { id: 'ap_aging', label: 'AP aging' },
  { id: 'cashflow', label: 'Cash flow' },
  { id: 'management_accounts', label: 'Mgmt snapshot' },
] as const;

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
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        report,
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (report === 'trends' || report === 'forecast') params.set('months', '12');
      const res = await fetch(`/api/accounting/reports?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
      if (json.warning) toast.message(json.warning);
    } catch (err) {
      setData(null);
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, report, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AccountingPage>
      <AccountingHeader
        title="Reports &"
        titleAccent="analytics"
        description="Board-ready financial statements, aging, cash, multi-month trends, and 1·3·6·9·12 month forecasts from posted history."
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

      {['trial_balance', 'pnl', 'balance_sheet', 'cashflow', 'management_accounts'].includes(
        report
      ) && (
        <div className="flex flex-wrap gap-3 mb-6">
          <label className="text-xs font-semibold text-neutral-600">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="ml-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-neutral-600">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="ml-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <ReportBody report={report} data={data} />
      )}
    </AccountingPage>
  );
}

function ReportBody({
  report,
  data,
}: {
  report: string;
  data: Record<string, unknown> | null;
}) {
  if (!data) {
    return (
      <Panel>
        <div className="px-6 py-12 text-center text-sm text-neutral-500">No data</div>
      </Panel>
    );
  }

  if (report === 'forecast') {
    return <ForecastReport data={data} />;
  }

  if (report === 'trends') {
    return <TrendsReport data={data} />;
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

function TrendsReport({ data }: { data: Record<string, unknown> }) {
  const labels = (data.labels as string[]) || [];
  const series = (data.series as Record<string, number[]>) || {};
  const totals = (data.totals as Record<string, number>) || {};
  const history = (data.history as Array<Record<string, unknown>>) || [];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <SumCard label="12m revenue" value={formatMoney(totals.revenue || 0)} tone="emerald" />
        <SumCard label="12m expenses" value={formatMoney(totals.expenses || 0)} />
        <SumCard
          label="12m net"
          value={formatMoney(totals.netIncome || 0)}
          tone={(totals.netIncome || 0) >= 0 ? 'emerald' : 'amber'}
        />
        <SumCard label="12m cash net" value={formatMoney(totals.cashNet || 0)} />
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
        headers={['Month', 'Revenue', 'COGS', 'Expenses', 'Net', 'Cash net', 'Journals']}
        rows={history.map((h) => [
          String(h.label),
          formatMoney(Number(h.revenue)),
          formatMoney(Number(h.cogs)),
          formatMoney(Number(h.expenses)),
          formatMoney(Number(h.netIncome)),
          formatMoney(Number(h.cashNet)),
          String(h.journalCount ?? 0),
        ])}
      />
    </>
  );
}

function ForecastReport({ data }: { data: Record<string, unknown> }) {
  const series = data.series as {
    labels: string[];
    historyCount: number;
    revenue: Array<number | null>;
    revenueForecast: Array<number | null>;
    netIncome: Array<number | null>;
    netForecast: Array<number | null>;
    revenueLow?: Array<number | null>;
    revenueHigh?: Array<number | null>;
  } | null;
  const horizons = (data.horizons as Array<{
    months: number;
    endLabel: string;
    revenue: number;
    cogs: number;
    expenses: number;
    grossProfit: number;
    netIncome: number;
    cashNet: number;
    avgMonthlyNet: number;
    revenueLow: number;
    revenueHigh: number;
    netLow: number;
    netHigh: number;
  }>) || [];
  const method = String(data.method || '');
  const lastMonth = data.lastMonth as Record<string, number> | undefined;
  const totals = (data.totals as Record<string, number>) || {};

  return (
    <>
      <div className="mb-5 rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-sky-50/80 to-cyan-50/50 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#0077b6] mb-2">
              <TrendingUp className="w-3 h-3" />
              Multi-horizon forecast
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              1 · 3 · 6 · 9 · 12 month outlook
            </h3>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              Cumulative projections from the last 12 months of posted P&L and bank cash —
              transparent trend model, not a black box.
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div className="font-semibold text-slate-700">Trailing 12m net</div>
            <div className="text-lg font-black tabular-nums text-slate-900">
              {formatMoney(totals.netIncome || 0)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {horizons.map((h) => (
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
                  h.netIncome >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {formatMoney(h.netIncome)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Net · {formatMoney(h.avgMonthlyNet)}/mo
              </div>
              <div className="mt-2 space-y-0.5 text-[10px] text-slate-500">
                <div className="flex justify-between gap-2">
                  <span>Rev</span>
                  <span className="tabular-nums font-semibold text-slate-700">
                    {formatMoney(h.revenue)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Cash</span>
                  <span className="tabular-nums font-semibold text-slate-700">
                    {formatMoney(h.cashNet)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {series && (
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <ChartCard
            title="Revenue & net path"
            subtitle="Solid = actual months · dashed = forecast · green band ≈ 80% revenue range"
            height={320}
            className="lg:col-span-2"
          >
            <ForecastLineChart
              labels={series.labels}
              historyCount={series.historyCount}
              revenue={series.revenue}
              revenueForecast={series.revenueForecast}
              netIncome={series.netIncome}
              netForecast={series.netForecast}
              revenueLow={series.revenueLow}
              revenueHigh={series.revenueHigh}
            />
          </ChartCard>
          <ChartCard
            title="Horizon comparison"
            subtitle="Cumulative revenue, expenses, and net by planning window"
            height={300}
          >
            <HorizonBarsChart horizons={horizons} />
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
        headers={[
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
        ]}
        rows={horizons.map((h) => [
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
        ])}
      />

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
