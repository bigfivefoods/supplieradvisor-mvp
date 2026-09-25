'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { accountTypeLabel, formatMoney } from '@/lib/accounting/types';
import {
  AccountingHeader,
  AccountingPage,
  AccountingStat,
  CompanyRequired,
} from '@/components/accounting/AccountingShell';
import { Panel } from '@/components/relationship/RelationshipChrome';
import PeriodSlicer from '@/components/accounting/PeriodSlicer';
import { useAccountingPeriod } from '@/lib/accounting/use-period';
import { FinanceWorkspaceNote } from '@/components/accounting/FinanceWorkspaceNote';
import { CashflowChart, ChartCard } from '@/components/accounting/AccountingCharts';
import type {
  ManagementCashflow,
  ManagementCashTxn,
} from '@/lib/accounting/management-cashflow';

type ChartPick = {
  id: number;
  code: string;
  name: string;
  is_header?: boolean | null;
};

export default function ManagementCashflowPage() {
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
  const { fyStartMonth, period, setPeriod } = useAccountingPeriod(
    companyId,
    privyUserId,
    'full_fy'
  );
  const [statement, setStatement] = useState<ManagementCashflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [txnQuery, setTxnQuery] = useState('');
  const [shownTxns, setShownTxns] = useState(40);
  const [uncodedOnly, setUncodedOnly] = useState(false);
  const [chart, setChart] = useState<ChartPick[]>([]);
  const [codingId, setCodingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: period.from,
        to: period.to,
      });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/accounting/management-cashflow?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to build cash flow');
      setStatement(data.statement || null);
      if (data.statement?.warning) toast.message(data.statement.warning);
      const coaParams = new URLSearchParams({
        companyId: String(companyId),
        balances: '0',
        limit: '500',
      });
      if (privyUserId) coaParams.set('privyUserId', privyUserId);
      const coaRes = await fetch(`/api/accounting/chart-of-accounts?${coaParams}`);
      const coa = await coaRes.json().catch(() => ({}));
      if (coaRes.ok) {
        setChart(
          ((coa as { accounts?: ChartPick[] }).accounts || []).filter(
            (account) => !account.is_header
          )
        );
      }
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

  useEffect(() => {
    setShownTxns(40);
    setTxnQuery('');
  }, [period.from, period.to]);

  const saveComment = useCallback(
    async (txn: ManagementCashTxn, comment: string) => {
      const res = await fetch('/api/accounting/management-cashflow', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          id: txn.id,
          comment,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || 'Could not save comment'
        );
      }
      const saved = String((data as { comment?: string }).comment ?? comment);
      setStatement((prev) =>
        prev
          ? {
              ...prev,
              transactions: prev.transactions.map((row) =>
                row.id === txn.id ? { ...row, comment: saved } : row
              ),
            }
          : prev
      );
      return saved;
    },
    [companyId, privyUserId]
  );

  const codeLine = useCallback(
    async (txn: ManagementCashTxn, glAccountId: number) => {
      setCodingId(txn.id);
      try {
        const res = await fetch('/api/accounting/bank/allocate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            action: 'allocate',
            bank_transaction_id: txn.id,
            gl_account_id: glAccountId,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            (data as { error?: string }).error || 'Could not code this line'
          );
        }
        toast.success('Bank line coded to the chart');
        await load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not code this line');
      } finally {
        setCodingId(null);
      }
    },
    [companyId, privyUserId, load]
  );

  const visibleTxns = useMemo(() => {
    const rows = (statement?.transactions || []).filter((row) =>
      uncodedOnly ? row.account_id == null : true
    );
    const q = txnQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.date} ${row.description} ${row.code} ${row.name} ${row.comment}`
        .toLowerCase()
        .includes(q)
    );
  }, [statement, txnQuery, uncodedOnly]);

  const currency = statement?.currency || 'ZAR';
  const money = (n: number) => formatMoney(n, currency, { compact: false });
  const tone = (n: number) =>
    n < -0.005 ? 'text-rose-700' : 'text-emerald-800';

  return (
    <AccountingPage>
      <AccountingHeader
        title="Management"
        titleAccent="cash flow"
        description="Actual cash from imported bank transactions, compared with the 12-month budget. The statutory statement stays under Cash flow."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />
      <PeriodSlicer
        value={period}
        fyStartMonth={fyStartMonth}
        onChange={setPeriod}
        className="mb-3"
      />
      <FinanceWorkspaceNote className="mb-4" />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : !statement ? (
        <p className="text-sm text-slate-500">No cash flow for this period.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <AccountingStat label="Bank in" value={money(statement.actualIn)} />
            <AccountingStat label="Bank out" value={money(statement.actualOut)} />
            <AccountingStat label="Bank net" value={money(statement.actualNet)} />
            <AccountingStat
              label="Versus budget"
              value={money(statement.variance)}
              warn={!statement.favourable}
              sub={
                statement.budgetSet
                  ? `Plan ${money(statement.budgetNet)}`
                  : 'No budget in this period'
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <AccountingStat
              label="Ledger cash"
              value={
                statement.ledgerCashMovement == null
                  ? '—'
                  : money(statement.ledgerCashMovement)
              }
              sub="Posted bank and cash accounts"
            />
            <AccountingStat
              label="Bank minus ledger"
              value={statement.cashGap == null ? '—' : money(statement.cashGap)}
              warn={statement.cashGap != null && Math.abs(statement.cashGap) >= 0.05}
            />
            <AccountingStat
              label="Unallocated bank"
              value={money(statement.unallocatedNet)}
              sub={
                statement.unallocatedCount
                  ? `${statement.unallocatedCount.toLocaleString('en-ZA')} lines not coded`
                  : 'Every line is coded'
              }
              warn={statement.unallocatedCount > 0}
            />
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            {statement.txnCount.toLocaleString('en-ZA')} bank line
            {statement.txnCount === 1 ? '' : 's'}
            {statement.unallocatedCount
              ? ` · ${statement.unallocatedCount.toLocaleString('en-ZA')} not coded to an account`
              : ''}
            {statement.excludedCount
              ? ` · ${statement.excludedCount.toLocaleString('en-ZA')} excluded`
              : ''}
            . {statement.note}{' '}
            <Link
              href="/dashboard/accounting/budget"
              className="font-semibold text-[#0077b6] hover:underline"
            >
              Edit budget
            </Link>
            {' · '}
            <Link
              href="/dashboard/accounting/cash-flow"
              className="font-semibold text-[#0077b6] hover:underline"
            >
              IAS 7 statement
            </Link>
            {' · '}
            <Link
              href="/dashboard/accounting/bank-reconciliation"
              className="font-semibold text-[#0077b6] hover:underline"
            >
              Bank
            </Link>
          </p>

          <ChartCard
            title="Monthly cash"
            subtitle="Bank inflow, outflow and net, with the budget plan"
            icon={BarChart3}
            height={260}
          >
            <CashflowChart
              labels={statement.months.map((m) => m.label)}
              inflow={statement.months.map((m) => m.actualIn)}
              outflow={statement.months.map((m) => m.actualOut)}
              net={statement.months.map((m) => m.actualNet)}
              budgetNet={
                statement.budgetSet
                  ? statement.months.map((m) => m.budgetNet)
                  : undefined
              }
            />
          </ChartCard>

          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                    <th className="px-4 py-3 font-semibold">Month</th>
                    <th className="px-4 py-3 font-semibold text-right">Bank in</th>
                    <th className="px-4 py-3 font-semibold text-right">Bank out</th>
                    <th className="px-4 py-3 font-semibold text-right">Bank net</th>
                    <th className="px-4 py-3 font-semibold text-right">Budget in</th>
                    <th className="px-4 py-3 font-semibold text-right">Budget out</th>
                    <th className="px-4 py-3 font-semibold text-right">Budget net</th>
                    <th className="px-4 py-3 font-semibold text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {statement.months.map((row) => (
                    <tr key={row.month} className="hover:bg-neutral-50/80">
                      <td className="px-4 py-3 font-medium text-slate-800">{row.label}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(row.actualIn)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(row.actualOut)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {money(row.actualNet)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                        {money(row.budgetIn)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                        {money(row.budgetOut)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                        {money(row.budgetNet)}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${tone(row.variance)}`}>
                        {money(row.variance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel>
            <div className="px-4 py-3 border-b border-neutral-100">
              <h2 className="text-sm font-bold text-slate-900">By account</h2>
              <p className="text-[11px] text-slate-500">
                Bank lines coded to a chart account, next to that account&apos;s budget. Unallocated lines have not been coded yet.
              </p>
            </div>
            {statement.accounts.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                No bank lines or budget amounts in this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                      <th className="px-4 py-3 font-semibold">Account</th>
                      <th className="px-4 py-3 font-semibold text-right">Bank in</th>
                      <th className="px-4 py-3 font-semibold text-right">Bank out</th>
                      <th className="px-4 py-3 font-semibold text-right">Budget in</th>
                      <th className="px-4 py-3 font-semibold text-right">Budget out</th>
                      <th className="px-4 py-3 font-semibold text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {statement.accounts.map((row) => (
                      <tr key={row.account_id ?? 'unallocated'} className="hover:bg-neutral-50/80">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {row.code || '—'}
                          </span>
                          <span className="ml-2 text-slate-800">{row.name}</span>
                          {row.account_type ? (
                            <span className="ml-2 text-[11px] text-neutral-400">
                              {accountTypeLabel(row.account_type)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(row.actualIn)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(row.actualOut)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                          {money(row.budgetIn)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                          {money(row.budgetOut)}
                        </td>
                        <td className={`px-4 py-3 text-right tabular-nums font-semibold ${tone(row.variance)}`}>
                          {money(row.variance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel>
            <div id="cash-txns" className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Transactions</h2>
                <p className="text-[11px] text-slate-500">
                  Comment on a line, and code any unallocated line to a chart account. Coding posts it into the ledger.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-600">
                <input
                  type="checkbox"
                  checked={uncodedOnly}
                  onChange={(e) => {
                    setUncodedOnly(e.target.checked);
                    setShownTxns(40);
                  }}
                />
                Uncoded only
              </label>
              <label className="block text-xs font-semibold text-neutral-600 sm:w-64">
                Find a line
                <input
                  value={txnQuery}
                  onChange={(e) => {
                    setTxnQuery(e.target.value);
                    setShownTxns(40);
                  }}
                  placeholder="Date, description, account, comment"
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm font-normal"
                />
              </label>
            </div>
            {visibleTxns.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {statement.transactions.length === 0
                  ? 'No bank lines in this period.'
                  : 'No lines match that search.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="px-4 py-3 font-semibold">Account</th>
                      <th className="px-4 py-3 font-semibold text-right">Amount</th>
                      <th className="px-4 py-3 font-semibold w-[280px]">Comment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {visibleTxns.slice(0, shownTxns).map((row) => (
                      <tr key={row.id} className="align-top hover:bg-neutral-50/80">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.date}</td>
                        <td className="px-4 py-3 text-slate-800">
                          {row.description || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.account_id == null ? (
                            <select
                              aria-label={`Code ${row.description || row.date}`}
                              defaultValue=""
                              disabled={codingId === row.id || chart.length === 0}
                              onChange={(e) => {
                                const id = Number(e.target.value);
                                e.target.value = '';
                                if (Number.isFinite(id) && id > 0) void codeLine(row, id);
                              }}
                              className="w-full max-w-[240px] rounded-xl border border-neutral-200 px-2 py-1.5 text-sm"
                            >
                              <option value="">
                                {codingId === row.id ? 'Coding…' : 'Code to account'}
                              </option>
                              {chart.map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.code} {account.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <>
                              <span className="font-mono text-xs">{row.code || '—'}</span>
                              <span className="ml-2">{row.name}</span>
                            </>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${tone(row.amount)}`}>
                          {money(row.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <CommentField
                            value={row.comment}
                            onSave={(comment) => saveComment(row, comment)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visibleTxns.length > shownTxns ? (
                  <div className="border-t border-neutral-100 px-4 py-3">
                    <button
                      type="button"
                      className="btn-secondary !py-2 !px-4 text-sm"
                      onClick={() => setShownTxns((n) => n + 40)}
                    >
                      Show more ({visibleTxns.length - shownTxns} left)
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </Panel>
        </div>
      )}
    </AccountingPage>
  );
}

function CommentField({
  value,
  onSave,
}: {
  value: string;
  onSave: (comment: string) => Promise<string>;
}) {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setText(value);
  }, [value]);

  async function commit() {
    if (text.trim() === value.trim()) return;
    setSaving(true);
    try {
      const saved = await onSave(text);
      setText(saved);
      toast.success('Comment saved');
    } catch (err) {
      setText(value);
      toast.error(err instanceof Error ? err.message : 'Could not save comment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <textarea
      value={text}
      rows={2}
      disabled={saving}
      placeholder="Why this cash moved"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => void commit()}
      className="w-full min-w-[220px] resize-y rounded-xl border border-neutral-200 px-2 py-1.5 text-sm disabled:opacity-60"
    />
  );
}
