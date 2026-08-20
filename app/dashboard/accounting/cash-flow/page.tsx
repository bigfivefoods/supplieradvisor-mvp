'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Loader2,
  PieChart,
  Printer,
  RefreshCw,
  Wallet,
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
import { GaapDisclaimer } from '@/components/accounting/GaapDisclaimer';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import {
  CashBridgeChart,
  CashflowChart,
  ChartCard,
  MixDoughnut,
} from '@/components/accounting/AccountingCharts';
import type {
  CashFlowJournal,
  Ias7CashFlow,
  Ias7Line,
} from '@/lib/accounting/statement-types';

export default function CashFlowStatementPage() {
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
  const [fyStartMonth, setFyStartMonth] = useState(3);
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('full_fy', 3)
  );
  const [statement, setStatement] = useState<Ias7CashFlow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ companyId: String(companyId) });
        if (privyUserId) params.set('privyUserId', privyUserId);
        const res = await fetch(`/api/accounting/settings?${params}`);
        const data = await res.json();
        const sm = Number(data.settings?.fiscal_year_start_month || 3);
        if (!cancelled && sm >= 1 && sm <= 12) {
          setFyStartMonth(sm);
          setPeriod((prev) =>
            prev.preset === 'full_fy'
              ? initialPeriodSlicerValue('full_fy', sm)
              : prev
          );
        }
      } catch {
        /* soft */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, privyUserId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: period.from,
        to: period.to,
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/accounting/cash-flow?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to compile cash flows');
      setStatement(data.statement || null);
      if (data.statement?.warning) toast.message(data.statement.warning);
    } catch (err) {
      setStatement(null);
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, period.from, period.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const money = (n: number) => formatMoney(n, 'ZAR', { compact: false });

  return (
    <AccountingPage>
      <style>{`
        @media print {
          nav, aside, header, .print\\:hidden { display: none !important; }
          body { background: white !important; }
          section { break-inside: avoid; }
        }
        @page { margin: 16mm; }
      `}</style>
      <div className="print:hidden">
        <AccountingHeader
          title="Statement of"
          titleAccent="cash flows"
          description="IAS 7 / ASC 230. Direct method from the cash and bank general ledger, plus the required reconciliation of profit to operating cash. Annual budget overlays as an operating plan when set. Unaudited."
          action={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className="btn-secondary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print / PDF
              </button>
            </div>
          }
        />
        <div className="mb-4">
          <PeriodSlicer
            value={period}
            fyStartMonth={fyStartMonth}
            onChange={setPeriod}
          />
        </div>
        <GaapDisclaimer className="mb-4" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : !statement ? (
        <p className="text-sm text-slate-500">No cash-flow statement for this period.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Operating" value={money(statement.netOperating)} />
            <Stat label="Investing" value={money(statement.netInvesting)} />
            <Stat label="Financing" value={money(statement.netFinancing)} />
            <Stat
              label="Net change in cash"
              value={money(statement.netChange)}
            />
          </div>
          {statement.budget?.set ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Budget receipts (plan)"
                value={money(statement.budget.operatingInflow)}
              />
              <Stat
                label="Budget payments (plan)"
                value={money(statement.budget.operatingOutflow)}
              />
              <Stat
                label="Budget operating plan"
                value={money(statement.budget.netOperating)}
              />
              <Stat
                label="Actual vs budget"
                value={money(
                  statement.netOperating - statement.budget.netOperating
                )}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-500 print:hidden">
              No annual budget in this period.{' '}
              <Link
                href="/dashboard/accounting/budget"
                className="font-semibold text-[#0077b6] hover:underline"
              >
                Set the 12-month budget
              </Link>{' '}
              to overlay a plan on this statement.
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-3 print:hidden">
            <ChartCard
              title="Activity mix"
              subtitle="Share of cash movement by IAS 7 class"
              icon={PieChart}
              height={240}
            >
              <MixDoughnut
                segments={[
                  {
                    label: 'Operating',
                    value: Math.abs(statement.netOperating),
                    color: '#10b981',
                  },
                  {
                    label: 'Investing',
                    value: Math.abs(statement.netInvesting),
                    color: '#f59e0b',
                  },
                  {
                    label: 'Financing',
                    value: Math.abs(statement.netFinancing),
                    color: '#8b5cf6',
                  },
                ]}
                centerLabel="Net"
                centerValue={money(statement.netChange)}
              />
            </ChartCard>
            <ChartCard
              title="Cash bridge"
              subtitle="Opening cash through activities to closing"
              icon={Wallet}
              height={240}
            >
              <CashBridgeChart
                opening={statement.openingCash}
                operating={statement.netOperating}
                investing={statement.netInvesting}
                financing={statement.netFinancing}
                closing={statement.closingCash}
              />
            </ChartCard>
            <ChartCard
              title="Monthly cash"
              subtitle={
                statement.budget?.set
                  ? 'Inflow, outflow, net and operating budget plan'
                  : 'Inflow, outflow and net by month'
              }
              icon={BarChart3}
              height={240}
            >
              <CashflowChart
                labels={(statement.months || []).map((m) => m.month.slice(5))}
                inflow={(statement.months || []).map((m) => m.inflow)}
                outflow={(statement.months || []).map((m) => m.outflow)}
                net={(statement.months || []).map((m) => m.net)}
                budgetNet={
                  statement.budget?.set
                    ? (statement.months || []).map((m) => {
                        const hit = statement.budget?.months.find(
                          (b) => b.month === m.month
                        );
                        return hit?.net ?? 0;
                      })
                    : undefined
                }
              />
            </ChartCard>
          </div>

          {statement.budget?.set ? (
            <Panel className="p-4 sm:p-5">
              <SectionLabel>Budget overlay (operating plan)</SectionLabel>
              <p className="mb-3 text-xs text-slate-500">{statement.budget.note}</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-1.5">Month</th>
                      <th className="px-2 py-1.5 text-right">Budget receipts</th>
                      <th className="px-2 py-1.5 text-right">Budget payments</th>
                      <th className="px-2 py-1.5 text-right">Budget net</th>
                      <th className="px-2 py-1.5 text-right">Actual operating</th>
                      <th className="px-2 py-1.5 text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.budget.months.map((b) => {
                      const actual =
                        (statement.months || []).find((m) => m.month === b.month)
                          ?.operating ?? 0;
                      return (
                        <tr key={b.month} className="border-t border-slate-100">
                          <td className="px-2 py-1.5 whitespace-nowrap">{b.month}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {money(b.inflow)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {money(b.outflow)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {money(b.net)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {money(actual)}
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                            {money(actual - b.net)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-slate-300 font-black">
                      <td className="px-2 py-1.5">Period</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {money(statement.budget.operatingInflow)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {money(statement.budget.operatingOutflow)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {money(statement.budget.netOperating)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {money(statement.netOperating)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {money(
                          statement.netOperating - statement.budget.netOperating
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Variance is actual operating cash minus the P&amp;L budget mapped
                as an operating plan (revenue ≈ receipts, costs ≈ payments).{' '}
                <Link
                  href="/dashboard/accounting/budget"
                  className="font-semibold text-[#0077b6] hover:underline"
                >
                  Edit budget
                </Link>
              </p>
            </Panel>
          ) : null}

          <Panel className="p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Statement of cash flows · {statement.from} to {statement.to}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Direct method (IAS 7.18(a)). Expand a heading, then a line, to the
              posted journals. Amounts in ZAR.
            </p>
            <CashSection
              title="Cash flows from operating activities"
              sectionKey="operating"
              rows={statement.operating}
              total={statement.netOperating}
              money={money}
            />
            <CashSection
              title="Cash flows from investing activities"
              sectionKey="investing"
              rows={statement.investing}
              total={statement.netInvesting}
              money={money}
            />
            <CashSection
              title="Cash flows from financing activities"
              sectionKey="financing"
              rows={statement.financing}
              total={statement.netFinancing}
              money={money}
            />
            <div className="mt-4 space-y-1 border-t-2 border-slate-800 pt-3 text-sm">
              <Row
                name="Net increase / (decrease) in cash and cash equivalents"
                amount={statement.netChange}
                money={money}
                bold
              />
              <Row
                name="Cash and cash equivalents at beginning of period"
                amount={statement.openingCash}
                money={money}
              />
              <Row
                name="Cash and cash equivalents at end of period"
                amount={statement.closingCash}
                money={money}
                bold
              />
              <Row
                name={
                  statement.reconciled
                    ? 'Opening + net change agrees to closing cash'
                    : `Review — implied close ${money(statement.impliedClose)} vs ledger ${money(statement.closingCash)}`
                }
                amount={statement.impliedClose}
                money={money}
              />
            </div>
          </Panel>

          {statement.indirect ? (
            <Panel className="p-4 sm:p-5">
              <SectionLabel>Reconciliation of profit to operating cash</SectionLabel>
              <p className="mb-3 text-xs text-slate-500">
                Indirect method (IAS 7.18(b); ASC 230 requires this reconciliation
                when the direct method is presented).
              </p>
              <Row
                name="Profit / (loss) for the period"
                amount={statement.indirect.profit}
                money={money}
                bold
              />
              {(statement.indirect.adjustments || []).map((a) => (
                <Row
                  key={a.name}
                  name={a.name}
                  amount={a.amount}
                  money={money}
                />
              ))}
              <div className="mt-2 border-t border-slate-300 pt-2">
                <Row
                  name="Net cash from operating activities (indirect)"
                  amount={statement.indirect.netOperating}
                  money={money}
                  bold
                />
                <Row
                  name="Net cash from operating activities (direct)"
                  amount={statement.netOperating}
                  money={money}
                />
              </div>
            </Panel>
          ) : null}

          <Panel className="p-4 sm:p-5">
            <SectionLabel>Accounting policies — cash flows</SectionLabel>
            <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed text-slate-700">
              {(statement.policies || []).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </AccountingPage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-black tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}

function CashSection({
  title,
  sectionKey,
  rows,
  total,
  money,
}: {
  title: string;
  sectionKey: string;
  rows: Ias7Line[];
  total: number;
  money: (n: number) => string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-1 text-left"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-slate-800">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 print:hidden" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 print:hidden" />
          )}
          {title}
        </span>
        <span className="text-sm font-black tabular-nums">{money(total)}</span>
      </button>
      {open ? (
        <div className="ml-4 border-l border-slate-200 pl-3">
          {rows.length === 0 ? (
            <p className="py-1 text-xs text-slate-400">None in this period.</p>
          ) : (
            rows.map((r) => (
              <CashLine
                key={`${sectionKey}:${r.name}`}
                line={r}
                money={money}
              />
            ))
          )}
          <Row name={`Net ${title.toLowerCase()}`} amount={total} money={money} bold />
        </div>
      ) : null}
    </div>
  );
}

function CashLine({
  line,
  money,
}: {
  line: Ias7Line;
  money: (n: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const journals = line.journals || [];
  const canOpen = journals.length > 0;
  return (
    <div className="py-0.5">
      <button
        type="button"
        disabled={!canOpen}
        onClick={() => canOpen && setOpen((v) => !v)}
        className="flex w-full items-baseline justify-between gap-4 text-left text-sm disabled:cursor-default"
      >
        <span className="flex min-w-0 items-center gap-1 text-slate-700">
          {canOpen ? (
            open ? (
              <ChevronDown className="h-3 w-3 shrink-0 print:hidden" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 print:hidden" />
            )
          ) : (
            <span className="inline-block w-3 print:hidden" />
          )}
          <span>{line.name}</span>
          {canOpen ? (
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {journals.length} journal{journals.length === 1 ? '' : 's'}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 tabular-nums">{money(line.net)}</span>
      </button>
      {open && canOpen ? (
        <div className="mt-1 mb-2 overflow-x-auto rounded-xl border border-slate-100 bg-slate-50/80">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                <th className="px-2 py-1.5">Date</th>
                <th className="px-2 py-1.5">Ref</th>
                <th className="px-2 py-1.5">Narrative</th>
                <th className="px-2 py-1.5">Account</th>
                <th className="px-2 py-1.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {journals.map((j: CashFlowJournal, i) => (
                <tr
                  key={`${j.journal_id}-${j.account_code || i}-${j.amount}`}
                  className="border-t border-slate-100"
                >
                  <td className="whitespace-nowrap px-2 py-1.5">{j.date}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">
                    <Link
                      href="/dashboard/accounting/journal-entries"
                      className="font-semibold text-[#0077b6] hover:underline"
                    >
                      {j.entry_number || `#${j.journal_id}`}
                    </Link>
                  </td>
                  <td className="max-w-xs px-2 py-1.5">
                    {j.memo || j.source || '—'}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600">
                    {j.account_code
                      ? `${j.account_code} · ${j.account_name || ''}`
                      : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                    {money(j.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  name,
  amount,
  money,
  bold,
}: {
  name: string;
  amount: number;
  money: (n: number) => string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-0.5 text-sm ${
        bold ? 'font-black' : ''
      }`}
    >
      <span className={bold ? 'text-slate-900' : 'text-slate-700'}>{name}</span>
      <span className="shrink-0 tabular-nums">{money(amount)}</span>
    </div>
  );
}
