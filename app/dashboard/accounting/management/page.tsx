'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  Upload,
  AlertTriangle,
  Plus,
  BookOpen,
  ExternalLink,
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
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import {
  CashflowChart,
  ChartCard,
  MixDoughnut,
  PeriodWaterfall,
  PnlTrendChart,
} from '@/components/accounting/AccountingCharts';

type MgmtSummary = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  operatingProfit: number;
  netIncome: number;
  journalCount: number;
  bankLines: number;
  bankIn: number;
  bankOut: number;
  unallocated: number;
  unallocatedIn: number;
  unallocatedOut: number;
  allocatedCount: number;
};

type LineRow = {
  id: number;
  code: string;
  name: string;
  account_type: string;
  amount: number;
};

type PeriodJournal = {
  id: number;
  entry_date?: string | null;
  document_number?: string | null;
  reference?: string | null;
  memo?: string | null;
  source?: string | null;
  status?: string | null;
  total_debit?: number;
  total_credit?: number;
};

export default function ManagementAccountsPage() {
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

  // Default to YTD (Mar–today FY) so bank-allocated journals from earlier months show.
  // "This month" is often empty mid-cycle after month-end allocations.
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('ytd')
  );

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<MgmtSummary | null>(null);
  const [income, setIncome] = useState<LineRow[]>([]);
  const [cogs, setCogs] = useState<LineRow[]>([]);
  const [expenses, setExpenses] = useState<LineRow[]>([]);
  const [journals, setJournals] = useState<PeriodJournal[]>([]);
  const [trendLabels, setTrendLabels] = useState<string[]>([]);
  const [trendSeries, setTrendSeries] = useState<{
    revenue: number[];
    expenses: number[];
    netIncome: number[];
    bankIn: number[];
    bankOut: number[];
    cashNet: number[];
  } | null>(null);

  const from = period.from;
  const to = period.to;
  const periodLabel = period.label;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        report: 'management_accounts',
        from,
        to,
      });
      if (privyUserId) params.set('privyUserId', privyUserId);

      const trendParams = new URLSearchParams({
        companyId: String(companyId),
        report: 'trends',
        months: '12',
      });
      if (privyUserId) trendParams.set('privyUserId', privyUserId);

      const [res, trendRes] = await Promise.all([
        fetch(`/api/accounting/reports?${params}`),
        fetch(`/api/accounting/reports?${trendParams}`),
      ]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.warning || 'Failed');
      setSummary(data.summary || null);
      setIncome(data.income || []);
      setCogs(data.cogs || []);
      setExpenses(data.expenses || []);
      setJournals(Array.isArray(data.journals) ? data.journals : []);
      if (data.warning) {
        // Empty period is informational; query failures are errors
        if (/failed|error|column/i.test(String(data.warning))) {
          toast.error(data.warning);
        } else {
          toast.message(data.warning);
        }
      }

      if (trendRes.ok) {
        const t = await trendRes.json();
        setTrendLabels((t.labels as string[]) || []);
        setTrendSeries((t.series as typeof trendSeries) || null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AccountingPage>
      <AccountingHeader
        title="Management"
        titleAccent="accounts"
        description="Period P&L from posted journals (including bank allocations). Multi-select months or quarters · FY Mar–Feb. Journals for this period are listed below."
        action={
          <>
            <Link
              href="/dashboard/accounting/journal-entries"
              className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New journal
            </Link>
            <Link
              href="/dashboard/accounting/journal-entries"
              className="btn-secondary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" /> All journals
            </Link>
            <Link
              href="/dashboard/accounting/bank-reconciliation"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <Upload className="w-4 h-4" /> Bank import
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </>
        }
      />

      <PeriodSlicer value={period} onChange={setPeriod} />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          {(summary?.unallocated || 0) > 0 && (
            <Link
              href="/dashboard/accounting/bank-reconciliation"
              className="mb-6 flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950 hover:bg-amber-100/80"
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">
                  {summary?.unallocated} bank line
                  {summary?.unallocated === 1 ? '' : 's'} still unallocated
                </div>
                <div className="text-xs mt-1 opacity-90">
                  In {formatMoney(summary?.unallocatedIn ?? 0)} · Out{' '}
                  {formatMoney(summary?.unallocatedOut ?? 0)} — allocate to income/expense so P&L
                  is complete.
                </div>
              </div>
            </Link>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Kpi label="Revenue" value={formatMoney(summary?.revenue ?? 0)} tone="emerald" />
            <Kpi label="Gross profit" value={formatMoney(summary?.grossProfit ?? 0)} />
            <Kpi label="Expenses" value={formatMoney(summary?.expenses ?? 0)} />
            <Kpi
              label="Operating profit"
              value={formatMoney(summary?.operatingProfit ?? 0)}
              tone={(summary?.operatingProfit ?? 0) >= 0 ? 'emerald' : 'amber'}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-3 mb-6">
            <Kpi label="Bank in (period)" value={formatMoney(summary?.bankIn ?? 0)} />
            <Kpi label="Bank out (period)" value={formatMoney(summary?.bankOut ?? 0)} />
            <Link href="/dashboard/accounting/journal-entries" className="block">
              <Kpi
                label="Journals posted"
                value={String(summary?.journalCount ?? 0)}
                sub={`${summary?.allocatedCount ?? 0} bank-allocated · open journals →`}
              />
            </Link>
          </div>

          {/* Period journals — double-entry source of management P&L */}
          <SectionLabel
            action={
              <Link
                href="/dashboard/accounting/journal-entries"
                className="text-xs font-semibold text-[#00b4d8] hover:underline inline-flex items-center gap-1"
              >
                Journal workspace <ExternalLink className="w-3 h-3" />
              </Link>
            }
          >
            Journals this period
          </SectionLabel>
          <Panel className="mb-8">
            {journals.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-neutral-500 mb-4">
                  No posted journals in {periodLabel}. Post entries or allocate bank lines so
                  management accounts can build.
                </p>
                <Link
                  href="/dashboard/accounting/journal-entries"
                  className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Create journal
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Ref</th>
                      <th className="px-4 py-3">Memo</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3 text-right">Debit</th>
                      <th className="px-4 py-3 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journals.map((j) => (
                      <tr
                        key={j.id}
                        className="border-b border-neutral-50 hover:bg-sky-50/40"
                      >
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">
                          {j.entry_date
                            ? new Date(j.entry_date).toLocaleDateString('en-ZA')
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                          {j.document_number || j.reference || `#${j.id}`}
                        </td>
                        <td className="px-4 py-2.5 text-slate-800 max-w-[280px] truncate">
                          {j.memo || '—'}
                        </td>
                        <td className="px-4 py-2.5 capitalize text-xs text-neutral-500">
                          {String(j.source || 'manual').replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-800">
                          {formatMoney(j.total_debit ?? 0)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-800">
                          {formatMoney(j.total_credit ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-3 text-[11px] text-neutral-500 border-t border-neutral-100 flex flex-wrap justify-between gap-2">
                  <span>
                    {journals.length} posted journal
                    {journals.length === 1 ? '' : 's'} feed this period&apos;s P&amp;L
                  </span>
                  <Link
                    href="/dashboard/accounting/journal-entries"
                    className="font-semibold text-[#00b4d8] hover:underline"
                  >
                    Open full journal entries →
                  </Link>
                </div>
              </div>
            )}
          </Panel>

          {/* Visual analytics */}
          <SectionLabel>Visual management pack</SectionLabel>
          <div className="grid lg:grid-cols-2 gap-4 mb-8">
            <ChartCard
              title="Period P&L bridge"
              subtitle={`${periodLabel} — revenue through net`}
              height={280}
            >
              <PeriodWaterfall
                revenue={summary?.revenue ?? 0}
                cogs={summary?.cogs ?? 0}
                expenses={summary?.expenses ?? 0}
                netIncome={summary?.netIncome ?? 0}
              />
            </ChartCard>
            <ChartCard title="Expense mix" subtitle="Operating accounts this period" height={280}>
              <MixDoughnut
                segments={expenses.slice(0, 10).map((r) => ({
                  label: r.name.slice(0, 22),
                  value: r.amount,
                }))}
                centerLabel="OpEx"
                centerValue={formatMoney(summary?.expenses ?? 0)}
              />
            </ChartCard>
            {trendSeries && trendLabels.length > 0 && (
              <>
                <ChartCard
                  title="12-month P&L trend"
                  subtitle="Posted monthly history (context beyond this period)"
                  height={280}
                  className="lg:col-span-2"
                >
                  <PnlTrendChart
                    labels={trendLabels}
                    revenue={trendSeries.revenue}
                    expenses={trendSeries.expenses}
                    netIncome={trendSeries.netIncome}
                  />
                </ChartCard>
                <ChartCard
                  title="12-month cash trend"
                  subtitle="Bank inflows / outflows · net dashed"
                  height={260}
                  className="lg:col-span-2"
                >
                  <CashflowChart
                    labels={trendLabels}
                    inflow={trendSeries.bankIn}
                    outflow={trendSeries.bankOut}
                    net={trendSeries.cashNet}
                  />
                </ChartCard>
              </>
            )}
            {income.length > 0 && (
              <ChartCard title="Income mix" subtitle="Revenue accounts this period" height={280}>
                <MixDoughnut
                  segments={income.slice(0, 10).map((r) => ({
                    label: r.name.slice(0, 22),
                    value: r.amount,
                  }))}
                  centerLabel="Revenue"
                  centerValue={formatMoney(summary?.revenue ?? 0)}
                />
              </ChartCard>
            )}
          </div>

          <SectionLabel
            action={
              <a
                href="/dashboard/accounting/reports"
                className="text-xs font-semibold text-[#00b4d8] hover:underline"
              >
                Full reports & 1–12m forecast →
              </a>
            }
          >
            Account lines
          </SectionLabel>

          <SectionLabel>Income</SectionLabel>
          <AccountTable rows={income} empty="No income posted in this period" />

          {cogs.length > 0 && (
            <>
              <SectionLabel>Cost of sales</SectionLabel>
              <AccountTable rows={cogs} empty="" />
            </>
          )}

          <SectionLabel>Operating expenses</SectionLabel>
          <AccountTable rows={expenses} empty="No expenses posted in this period" />

          <Panel className="mt-6">
            <div className="px-5 py-5 space-y-2 text-sm">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                {periodLabel}
              </div>
              <Row label="Revenue" value={formatMoney(summary?.revenue ?? 0)} />
              <Row label="Cost of sales" value={formatMoney(summary?.cogs ?? 0)} />
              <Row label="Gross profit" value={formatMoney(summary?.grossProfit ?? 0)} bold />
              <Row label="Operating expenses" value={formatMoney(summary?.expenses ?? 0)} />
              <div className="border-t border-neutral-100 pt-2">
                <Row
                  label="Net / operating profit"
                  value={formatMoney(summary?.netIncome ?? 0)}
                  bold
                  accent
                />
              </div>
            </div>
          </Panel>

          <p className="mt-6 text-[11px] text-neutral-400 text-center max-w-xl mx-auto">
            Financial year: 1 March – 28/29 February. Built from posted double-entry journals.
            Import bank PDF → mass-allocate to GL → figures update here.
          </p>
        </>
      )}
    </AccountingPage>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
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
      <div className="text-xl font-black tabular-nums text-slate-900">{value}</div>
      {sub && <div className="text-[11px] text-neutral-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function AccountTable({ rows, empty }: { rows: LineRow[]; empty: string }) {
  if (rows.length === 0) {
    return (
      <Panel className="mb-6">
        <div className="px-6 py-8 text-center text-sm text-neutral-500">{empty}</div>
      </Panel>
    );
  }
  return (
    <Panel className="mb-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
              <th className="px-4 py-3 font-semibold">Code</th>
              <th className="px-4 py-3 font-semibold">Account</th>
              <th className="px-4 py-3 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-neutral-50/80">
                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-700">
                  {r.code}
                </td>
                <td className="px-4 py-2.5 text-slate-800">{r.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                  {formatMoney(r.amount)}
                </td>
              </tr>
            ))}
            <tr className="bg-neutral-50/80">
              <td colSpan={2} className="px-4 py-2.5 font-bold text-slate-900">
                Total
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-black">
                {formatMoney(rows.reduce((s, r) => s + Number(r.amount), 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className={bold ? 'font-bold text-slate-900' : 'text-neutral-600'}>{label}</span>
      <span
        className={`tabular-nums ${
          accent ? 'font-black text-[#0077b6] text-lg' : bold ? 'font-bold' : 'font-medium'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
